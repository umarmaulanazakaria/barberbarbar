import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Clock3,
  Scissors,
  UserRoundCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import NewOrderModal from "../components/NewOrderModal";
import OrderDetailModal from "../components/OrderDetailModal";
import { api } from "../lib/api";
import type { DashboardData } from "../types";
import { rupiah, waktu } from "../lib/format";
import { Button, Card, Empty, ErrorState, LoadingState, PageTitle, StatusBadge } from "../components/ui";

export default function DashboardPage() {
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<DashboardData>("/dashboard")).data,
    refetchInterval: 15000,
  });

  const cards = [
    ["Waiting", data?.waiting ?? 0, Clock3],
    ["In Service", data?.inService ?? 0, Scissors],
    ["Completed (Unpaid)", data?.completedUnpaid ?? 0, WalletCards],
    ["Paid Today", data?.paidToday ?? 0, UserRoundCheck],
  ] as const;

  return (
    <>
      <PageTitle
        title="Dashboard"
        subtitle="Overview of today's barbershop operations"
        action={<Button onClick={() => setNewOrderOpen(true)}>+ New Order</Button>}
      />

      {isLoading ? (
        <Card><LoadingState text="Loading dashboard..." /></Card>
      ) : isError ? (
        <Card><ErrorState text="Failed to load dashboard." onRetry={() => void refetch()} /></Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(([label, value, Icon]) => (
              <Card key={label} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><Icon size={19} /></div>
                  <div><div className="text-xs text-slate-500">{label}</div><div className="text-2xl font-black text-slate-900">{value}</div></div>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_.8fr]">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div><div className="font-bold">Recent Orders</div><div className="text-xs text-slate-400">Latest activity</div></div>
                <Link to="/orders" className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-100 hover:shadow-sm active:translate-y-0">
                  View all <ArrowRight size={14} />
                </Link>
              </div>

              <div className="overflow-x-auto">
                {!data?.pesananTerbaru.length ? (
                  <Empty text="No recent orders yet" />
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Order</th><th>Customer</th><th>Barber</th><th>Status</th><th>Payment</th><th>Check-in</th></tr></thead>
                    <tbody>
                      {data.pesananTerbaru.map((o) => (
                        <tr
                          key={o.id}
                          role="link"
                          tabIndex={0}
                          aria-label={`Open order ${o.nomorPesanan}`}
                          onClick={() => setSelectedOrderId(o.id)}
                          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedOrderId(o.id); } }}
                          className="group cursor-pointer border-t border-slate-100 transition-all duration-200 hover:bg-indigo-50/70 hover:shadow-[inset_4px_0_0_#4f46e5] focus-visible:bg-indigo-50/70 focus-visible:outline-none focus-visible:shadow-[inset_4px_0_0_#4f46e5] active:bg-indigo-100/70"
                        >
                          <td className="px-4 py-3 font-bold text-indigo-600"><span className="inline-flex transition-transform duration-200 group-hover:translate-x-1 group-focus-visible:translate-x-1">{o.nomorPesanan}</span></td>
                          <td>{o.pelanggan.nama}</td><td>{o.barber.nama}</td><td><StatusBadge value={o.status} /></td><td><StatusBadge value={o.statusPembayaran} /></td><td>{waktu(o.checkInTime)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            <div className="space-y-4">
              <Card className="p-5"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><WalletCards size={19} /></div><div><div className="text-xs text-slate-500">Revenue Today</div><div className="text-xl font-black text-slate-900">{rupiah(data?.revenueToday ?? 0)}</div></div></div></Card>
              <Card className="p-5">
                <div className="mb-4 flex items-center gap-2 font-bold"><UsersRound size={17} />Overview</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 p-3"><b>{data?.pelanggan ?? 0}</b><div className="text-[10px] text-slate-400">Customers</div></div>
                  <div className="rounded-lg bg-slate-50 p-3"><b>{data?.barberAktif ?? 0}</b><div className="text-[10px] text-slate-400">Barbers</div></div>
                  <div className="rounded-lg bg-slate-50 p-3"><b>{data?.layananAktif ?? 0}</b><div className="text-[10px] text-slate-400">Services</div></div>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      <NewOrderModal open={newOrderOpen} onClose={() => setNewOrderOpen(false)} onCreated={(orderId) => setSelectedOrderId(orderId)} />
      <OrderDetailModal orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </>
  );
}
