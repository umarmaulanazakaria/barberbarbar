import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import NewOrderModal from "../components/NewOrderModal";
import OrderDetailModal from "../components/OrderDetailModal";
import {
  Button,
  Card,
  Empty,
  ErrorState,
  LoadingState,
  PageTitle,
  StatusBadge,
} from "../components/ui";
import { api } from "../lib/api";
import { waktu } from "../lib/format";
import type { Pesanan, StatusPesanan } from "../types";

export default function OrdersPage() {
  const [tab, setTab] = useState<"ALL" | StatusPesanan>("ALL");
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const {
    data = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["orders", "active"],
    queryFn: async () => (await api.get<Pesanan[]>("/orders/active")).data,
    refetchInterval: 10000,
  });

  const shown = useMemo(
    () => (tab === "ALL" ? data : data.filter((order) => order.status === tab)),
    [data, tab],
  );

  const count = (status: StatusPesanan) => data.filter((order) => order.status === status).length;

  return (
    <>
      <PageTitle
        title="Orders"
        subtitle="Manage check-in and service workflow"
        action={<Button onClick={() => setNewOrderOpen(true)}>+ New Order</Button>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><div className="text-xs text-slate-500">Waiting</div><div className="text-2xl font-black">{count("WAITING")}</div></Card>
        <Card className="p-4"><div className="text-xs text-slate-500">In Service</div><div className="text-2xl font-black">{count("IN_SERVICE")}</div></Card>
        <Card className="p-4"><div className="text-xs text-slate-500">Completed (Unpaid)</div><div className="text-2xl font-black">{data.filter((order) => order.status === "COMPLETED" && order.statusPembayaran === "UNPAID").length}</div></Card>
      </div>

      <Card>
        <div className="flex gap-2 border-b p-3">
          {(["ALL", "WAITING", "IN_SERVICE", "COMPLETED"] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setTab(status)}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${tab === status ? "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200" : "text-slate-500 hover:bg-slate-50"}`}
            >
              {status === "ALL" ? "All" : status === "IN_SERVICE" ? "In Service" : status[0] + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingState text="Loading active orders..." />
          ) : isError ? (
            <ErrorState text="Failed to load orders." onRetry={() => void refetch()} />
          ) : shown.length === 0 ? (
            <Empty text="No active orders" />
          ) : (
            <table className="w-full min-w-[800px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Order No.</th><th>Customer</th><th>Barber</th><th>Items</th><th>Status</th><th>Payment</th><th>Check-in</th></tr></thead>
              <tbody>
                {shown.map((order) => (
                  <tr
                    key={order.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open order ${order.nomorPesanan}`}
                    onClick={() => setSelectedOrderId(order.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedOrderId(order.id);
                      }
                    }}
                    className="group cursor-pointer border-t border-slate-100 transition-all duration-200 hover:bg-indigo-50/70 hover:shadow-[inset_4px_0_0_#4f46e5] focus-visible:bg-indigo-50/70 focus-visible:outline-none focus-visible:shadow-[inset_4px_0_0_#4f46e5] active:bg-indigo-100/70"
                  >
                    <td className="px-4 py-3 font-bold text-indigo-600"><span className="inline-flex transition-transform duration-200 group-hover:translate-x-1 group-focus-visible:translate-x-1">{order.nomorPesanan}</span></td>
                    <td>{order.pelanggan.nama}</td><td>{order.barber.nama}</td><td>{order.items.reduce((sum, item) => sum + item.qty, 0)} items</td><td><StatusBadge value={order.status} /></td><td><StatusBadge value={order.statusPembayaran} /></td><td>{waktu(order.checkInTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <NewOrderModal open={newOrderOpen} onClose={() => setNewOrderOpen(false)} onCreated={(orderId) => setSelectedOrderId(orderId)} />
      <OrderDetailModal orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </>
  );
}
