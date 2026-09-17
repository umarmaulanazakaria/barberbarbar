import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import OrderDetailModal from "../components/OrderDetailModal";
import { Card, Empty, ErrorState, Input, LoadingState, PageTitle } from "../components/ui";
import { api } from "../lib/api";
import { rupiah, tanggal } from "../lib/format";
import type { Pesanan } from "../types";

export default function HistoryPage() {
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["orders", "history"],
    queryFn: async () => (await api.get<Pesanan[]>("/orders/history")).data,
  });

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("id-ID");
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;

    return data.filter((order) => {
      const orderDate = new Date(order.diperbaruiPada);
      if (from && orderDate < from) return false;
      if (to && orderDate > to) return false;
      if (!keyword) return true;

      return [
        order.nomorPesanan,
        order.pelanggan.nama,
        order.pelanggan.nomorTelepon,
        order.barber.nama,
        order.pembayaran?.metode ?? "",
        ...order.items.map((item) => item.namaLayanan),
      ]
        .join(" ")
        .toLocaleLowerCase("id-ID")
        .includes(keyword);
    });
  }, [data, search, dateFrom, dateTo]);

  return (
    <>
      <PageTitle title="Order History" subtitle="Completed and paid order history" />
      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[1fr_180px_180px]">
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order, customer, barber, service..."
              className="pl-9"
            />
          </div>
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-label="History from date" />
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} aria-label="History to date" />
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingState text="Loading order history..." />
          ) : isError ? (
            <ErrorState text="Failed to load order history." onRetry={() => void refetch()} />
          ) : !filteredOrders.length ? (
            <Empty text={search || dateFrom || dateTo ? "No order history matches your filters" : "No completed order history yet"} />
          ) : (
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Order No.</th><th>Customer</th><th>Barber</th><th>Date</th><th>Items</th><th>Total</th><th>Payment</th></tr></thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open order ${order.nomorPesanan}`}
                    onClick={() => setSelectedOrderId(order.id)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedOrderId(order.id); } }}
                    className="group cursor-pointer border-t border-slate-100 transition-all duration-200 hover:bg-indigo-50/70 hover:shadow-[inset_4px_0_0_#4f46e5] focus-visible:bg-indigo-50/70 focus-visible:outline-none focus-visible:shadow-[inset_4px_0_0_#4f46e5] active:bg-indigo-100/70"
                  >
                    <td className="px-4 py-3 font-bold text-indigo-600"><span className="inline-flex transition-transform duration-200 group-hover:translate-x-1 group-focus-visible:translate-x-1">{order.nomorPesanan}</span></td>
                    <td>{order.pelanggan.nama}</td><td>{order.barber.nama}</td><td>{tanggal(order.diperbaruiPada)}</td><td>{order.items.reduce((total, item) => total + item.qty, 0)} items</td><td className="font-bold">{rupiah(order.total)}</td><td>{order.pembayaran?.metode ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
      <OrderDetailModal orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </>
  );
}
