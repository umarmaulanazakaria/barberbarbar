import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import OrderDetailModal from "../components/OrderDetailModal";
import { Card, Empty, ErrorState, Input, LoadingState, PageTitle, SearchableSelect, StatusBadge } from "../components/ui";
import { api } from "../lib/api";
import { rupiah, tanggal } from "../lib/format";
import type { Invoice } from "../types";

export default function InvoicesPage() {
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");

  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => (await api.get<Invoice[]>("/invoices")).data,
  });

  const filteredInvoices = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("id-ID");

    return data.filter((invoice) => {
      if (methodFilter !== "ALL" && invoice.metode !== methodFilter) return false;
      if (!keyword) return true;

      return [
        invoice.nomorInvoice,
        invoice.pesanan.nomorPesanan,
        invoice.pesanan.pelanggan.nama,
        invoice.pesanan.pelanggan.nomorTelepon,
        invoice.metode,
      ]
        .join(" ")
        .toLocaleLowerCase("id-ID")
        .includes(keyword);
    });
  }, [data, search, methodFilter]);

  return (
    <>
      <PageTitle title="Invoices" subtitle="Paid invoice list" />
      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search invoice, order, customer..."
              className="pl-9"
            />
          </div>
          <SearchableSelect
            value={methodFilter}
            onChange={(value) => setMethodFilter(String(value))}
            placeholder="Filter payment"
            searchPlaceholder="Search payment method..."
            ariaLabel="Filter invoice payment method"
            options={[
              { value: "ALL", label: "All payment methods" },
              { value: "CASH", label: "Cash" },
              { value: "QRIS", label: "QRIS" },
              { value: "CARD", label: "Card" },
              { value: "TRANSFER", label: "Transfer" },
              { value: "OTHER", label: "Other" },
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingState text="Loading invoices..." />
          ) : isError ? (
            <ErrorState text="Failed to load invoices." onRetry={() => void refetch()} />
          ) : !filteredInvoices.length ? (
            <Empty text={search || methodFilter !== "ALL" ? "No invoices match your filters" : "No paid invoices yet"} />
          ) : (
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Invoice No.</th><th>Order No.</th><th>Customer</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open invoice ${invoice.nomorInvoice}`}
                    onClick={() => setSelectedOrderId(invoice.pesanan.id)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedOrderId(invoice.pesanan.id); } }}
                    className="group cursor-pointer border-t border-slate-100 transition-all duration-200 hover:bg-indigo-50/70 hover:shadow-[inset_4px_0_0_#4f46e5] focus-visible:bg-indigo-50/70 focus-visible:outline-none focus-visible:shadow-[inset_4px_0_0_#4f46e5] active:bg-indigo-100/70"
                  >
                    <td className="px-4 py-3 font-bold text-indigo-600"><span className="inline-flex transition-transform duration-200 group-hover:translate-x-1 group-focus-visible:translate-x-1">{invoice.nomorInvoice}</span></td>
                    <td>{invoice.pesanan.nomorPesanan}</td><td>{invoice.pesanan.pelanggan.nama}</td><td>{tanggal(invoice.dibayarPada)}</td><td className="font-bold">{rupiah(invoice.pesanan.total)}</td><td>{invoice.metode}</td><td><StatusBadge value="PAID" /></td>
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
