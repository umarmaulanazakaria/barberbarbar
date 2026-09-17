import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { api, pesanError } from "../lib/api";
import { rupiah, tanggal, waktu } from "../lib/format";
import type { Pesanan, StatusPesanan } from "../types";
import { Button, Card, PageTitle, StatusBadge } from "../components/ui";
export default function OrderDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data: o } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => (await api.get<Pesanan>(`/orders/${id}`)).data,
  });
  const mut = useMutation({
    mutationFn: async (status: StatusPesanan) =>
      api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => alert(pesanError(e)),
  });
  if (!o) return <div>Loading...</div>;
  const duration = o.items.reduce((s, i) => s + i.durasiMenit * i.qty, 0);
  return (
    <>
      <PageTitle
        title="Order Detail"
        subtitle={o.nomorPesanan}
        action={
          <Link to="/orders">
            <Button variant="secondary">Back</Button>
          </Link>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1.6fr_.8fr]">
        <Card className="p-5">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs text-slate-400">Order No.</div>
              <div className="text-xl font-black">{o.nomorPesanan}</div>
            </div>
            <div className="flex gap-2">
              <StatusBadge value={o.status} />
              <StatusBadge value={o.statusPembayaran} />
            </div>
          </div>
          <div className="mb-5 grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-3">
            <div>
              <div className="text-[10px] text-slate-400">Customer</div>
              <b className="text-sm">{o.pelanggan.nama}</b>
              <div className="text-xs text-slate-500">
                {o.pelanggan.nomorTelepon}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Barber</div>
              <b className="text-sm">{o.barber.nama}</b>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Check-in</div>
              <b className="text-sm">{waktu(o.checkInTime)}</b>
              <div className="text-xs text-slate-500">
                {tanggal(o.checkInTime)}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="py-2 text-left">Service</th>
                  <th>Duration</th>
                  <th>Price</th>
                  <th>Qty</th>
                  <th className="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="py-3 font-semibold">{i.namaLayanan}</td>
                    <td className="text-center">{i.durasiMenit} min</td>
                    <td className="text-center">{rupiah(i.harga)}</td>
                    <td className="text-center">{i.qty}</td>
                    <td className="text-right">{rupiah(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ml-auto mt-4 max-w-xs space-y-1 text-right text-xs">
            <div>
              Subtotal <b>{rupiah(o.subtotal)}</b>
            </div>
            {o.diskon > 0 && (
              <div className="text-emerald-600">
                Discount {o.discountPercent}% <b>-{rupiah(o.diskon)}</b>
              </div>
            )}
            <div className="text-base font-black text-indigo-700">
              Total {rupiah(o.total)}
            </div>
          </div>
          {o.catatan && (
            <div className="mt-5 rounded-lg border p-3 text-xs">
              <b>Notes</b>
              <div className="mt-1 text-slate-500">{o.catatan}</div>
            </div>
          )}
        </Card>
        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-4 text-sm font-bold">Status (Service)</div>
            <div className="mb-4 flex items-center justify-between text-[10px]">
              <span
                className={
                  o.status === "WAITING"
                    ? "font-bold text-indigo-600"
                    : "text-slate-400"
                }
              >
                Waiting
              </span>
              <span>→</span>
              <span
                className={
                  o.status === "IN_SERVICE"
                    ? "font-bold text-amber-600"
                    : "text-slate-400"
                }
              >
                In Service
              </span>
              <span>→</span>
              <span
                className={
                  o.status === "COMPLETED"
                    ? "font-bold text-emerald-600"
                    : "text-slate-400"
                }
              >
                Completed
              </span>
            </div>
            {o.status === "WAITING" && (
              <Button
                className="w-full"
                onClick={() => mut.mutate("IN_SERVICE")}
              >
                Start Service
              </Button>
            )}
            {o.status === "IN_SERVICE" && (
              <Button
                variant="success"
                className="w-full"
                onClick={() => mut.mutate("COMPLETED")}
              >
                Mark as Completed
              </Button>
            )}
            {o.status === "COMPLETED" && o.statusPembayaran === "UNPAID" && (
              <Link to={`/orders/${o.id}/payment`}>
                <Button className="w-full">Go to Payment</Button>
              </Link>
            )}
            {o.statusPembayaran === "PAID" && (
              <div className="rounded-lg bg-emerald-50 p-3 text-center text-xs font-bold text-emerald-600">
                Payment completed
              </div>
            )}
            <Button
              variant="secondary"
              className="mt-2 w-full"
              onClick={() => window.print()}
            >
              <Printer size={15} />
              Print Service Ticket
            </Button>
          </Card>
          <Card className="p-5">
            <div className="mb-3 text-sm font-bold">Order Summary</div>
            <div className="space-y-2 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Total items</span>
                <b className="text-slate-800">
                  {o.items.reduce((s, i) => s + i.qty, 0)}
                </b>
              </div>
              <div className="flex justify-between">
                <span>Total duration</span>
                <b className="text-slate-800">{duration} min</b>
              </div>
              <div className="flex justify-between">
                <span>Payment</span>
                <StatusBadge value={o.statusPembayaran} />
              </div>
            </div>
          </Card>
        </div>
      </div>
      <div className="print-only ticket-print">
        <div className="mx-auto max-w-sm text-xs">
          <div className="text-center">
            <ScissorsLogo />
            <h2 className="text-lg font-black">BARBERSHOP</h2>
            <div>SERVICE TICKET</div>
          </div>
          <hr className="my-4" />
          <div>
            Order No.: <b>{o.nomorPesanan}</b>
          </div>
          <div>
            Customer: <b>{o.pelanggan.nama}</b>
          </div>
          <div>
            Barber: <b>{o.barber.nama}</b>
          </div>
          <div>
            Date:{" "}
            <b>
              {tanggal(o.checkInTime)} {waktu(o.checkInTime)}
            </b>
          </div>
          <hr className="my-4" />
          {o.items.map((i) => (
            <div key={i.id} className="flex justify-between py-1">
              <span>
                {i.namaLayanan} x{i.qty}
              </span>
              <b>{rupiah(i.subtotal)}</b>
            </div>
          ))}
          <hr className="my-4" />
          <div className="flex justify-between">
            <b>Total Duration</b>
            <b>{duration} min</b>
          </div>
          <div className="flex justify-between text-sm">
            <b>Total</b>
            <b>{rupiah(o.total)}</b>
          </div>
          <div className="mt-8 text-center">
            Thank you
            <br />
            See you next time.
          </div>
        </div>
      </div>
    </>
  );
}
function ScissorsLogo() {
  return <div className="text-2xl">✂</div>;
}
