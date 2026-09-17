import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  Banknote,
  CreditCard,
  Landmark,
  QrCode,
  WalletCards,
} from "lucide-react";
import { api, pesanError } from "../lib/api";
import { rupiah } from "../lib/format";
import type { MetodePembayaran, Pesanan } from "../types";
import {
  Button,
  Card,
  Input,
  Label,
  PageTitle,
  Textarea,
} from "../components/ui";
const methods = [
  ["CASH", "Cash", Banknote],
  ["QRIS", "QRIS", QrCode],
  ["CARD", "Card", CreditCard],
  ["TRANSFER", "Transfer", Landmark],
  ["OTHER", "Other", WalletCards],
] as const;
export default function PaymentPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: o } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => (await api.get<Pesanan>(`/orders/${id}`)).data,
  });
  const [method, setMethod] = useState<MetodePembayaran>("CASH");
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const mut = useMutation({
    mutationFn: () =>
      api.post(`/orders/${id}/payment`, {
        metode: method,
        jumlahDiterima: amount,
        catatan: notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries();
      nav("/invoices");
    },
    onError: (e) => alert(pesanError(e)),
  });
  if (!o) return <div>Loading...</div>;
  const change = Math.max(0, amount - o.total);
  return (
    <>
      <PageTitle
        title="Payment"
        subtitle={`Payment for order ${o.nomorPesanan}`}
      />
      <Card className="mx-auto grid max-w-4xl gap-0 overflow-hidden md:grid-cols-2">
        <div className="border-b p-6 md:border-b-0 md:border-r">
          <div className="mb-4 text-xs font-bold text-slate-500">
            Order Summary
          </div>
          <div className="mb-4">
            <b>{o.pelanggan.nama}</b>
            <div className="text-xs text-slate-400">
              {o.pelanggan.nomorTelepon}
            </div>
          </div>
          <div className="space-y-3 text-xs">
            {o.items.map((i) => (
              <div key={i.id} className="flex justify-between">
                <span>
                  {i.namaLayanan}{" "}
                  <span className="text-slate-400">x{i.qty}</span>
                </span>
                <b>{rupiah(i.subtotal)}</b>
              </div>
            ))}
            <hr />
            <div className="flex justify-between">
              <span>Subtotal</span>
              <b>{rupiah(o.subtotal)}</b>
            </div>
            {o.diskon > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <b>-{rupiah(o.diskon)}</b>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-indigo-700">
              <span>TOTAL</span>
              <span>{rupiah(o.total)}</span>
            </div>
          </div>
        </div>
        <div className="p-6">
          <Label>Payment Method</Label>
          <div className="mb-5 grid grid-cols-3 gap-2">
            {methods.map(([v, label, Icon]) => (
              <button
                key={v}
                onClick={() => setMethod(v)}
                className={`rounded-lg border p-3 text-center text-xs font-semibold ${method === v ? "border-indigo-500 bg-indigo-50 text-indigo-600" : "border-slate-200"}`}
              >
                <Icon className="mx-auto mb-1" size={17} />
                {label}
              </button>
            ))}
          </div>
          <div className="mb-4">
            <Label>Amount Received</Label>
            <Input
              type="number"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder={String(o.total)}
            />
          </div>
          <div className="mb-4 rounded-lg bg-emerald-50 p-3">
            <div className="text-xs text-emerald-600">Change</div>
            <div className="text-xl font-black text-emerald-700">
              {rupiah(change)}
            </div>
          </div>
          <div>
            <Label>Notes (Optional)</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="mt-5 flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => nav(-1)}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              className="flex-1"
              disabled={amount < o.total || mut.isPending}
              onClick={() => mut.mutate()}
            >
              {mut.isPending ? "Processing..." : "Mark as Paid"}
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
