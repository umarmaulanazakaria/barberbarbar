import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { ReportData } from "../types";
import { rupiah, tanggal } from "../lib/format";
import { Card, Input, PageTitle, StatusBadge } from "../components/ui";

const revenueDateKey = (value: string) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const revenueDateLabel = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });

export default function ReportsPage() {
  const [mulai, setMulai] = useState("");
  const [selesai, setSelesai] = useState("");

  const { data } = useQuery({
    queryKey: ["reports", mulai, selesai],
    queryFn: async () =>
      (
        await api.get<ReportData>("/dashboard/reports", {
          params: {
            mulai: mulai || undefined,
            selesai: selesai || undefined,
          },
        })
      ).data,
  });

  const revenueChart = useMemo(() => {
    const grouped = new Map<string, number>();

    for (const order of data?.pesanan ?? []) {
      if (order.statusPembayaran !== "PAID") continue;

      const paidAt = order.pembayaran?.dibayarPada ?? order.dibuatPada;
      const key = revenueDateKey(paidAt);
      grouped.set(key, (grouped.get(key) ?? 0) + order.total);
    }

    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({
        date,
        label: revenueDateLabel(date),
        value,
      }));
  }, [data]);

  const maxRevenue = Math.max(...revenueChart.map((item) => item.value), 1);
  const chartWidth = Math.max(720, revenueChart.length * 105);
  const chartHeight = 260;
  const leftPadding = 38;
  const rightPadding = 28;
  const topPadding = 22;
  const bottomPadding = 48;
  const plotHeight = chartHeight - topPadding - bottomPadding;
  const plotWidth = chartWidth - leftPadding - rightPadding;

  const points = revenueChart.map((item, index) => {
    const x =
      revenueChart.length === 1
        ? leftPadding + plotWidth / 2
        : leftPadding + (index / (revenueChart.length - 1)) * plotWidth;
    const y = topPadding + (1 - item.value / maxRevenue) * plotHeight;

    return { ...item, x, y };
  });

  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");

  const areaPoints = points.length
    ? [
        `${points[0].x},${topPadding + plotHeight}`,
        ...points.map((point) => `${point.x},${point.y}`),
        `${points.at(-1)!.x},${topPadding + plotHeight}`,
      ].join(" ")
    : "";

  return (
    <>
      <PageTitle title="Reports" subtitle="Operational and revenue summary" />

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          className="max-w-44"
          type="date"
          value={mulai}
          onChange={(event) => setMulai(event.target.value)}
        />
        <Input
          className="max-w-44"
          type="date"
          value={selesai}
          onChange={(event) => setSelesai(event.target.value)}
        />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Orders", data?.jumlahPesanan ?? 0],
          ["Completed", data?.selesai ?? 0],
          ["Unpaid", data?.belumDibayar ?? 0],
          ["Cancelled", data?.dibatalkan ?? 0],
          ["Revenue", rupiah(data?.revenue ?? 0)],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="mt-1 text-xl font-black">{value}</div>
          </Card>
        ))}
      </div>

      <Card className="mb-4 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-black text-slate-900">Revenue Trend</h2>
            <p className="mt-1 text-xs text-slate-500">
              Paid revenue by day for the selected period
            </p>
          </div>
          <div className="rounded-lg bg-indigo-50 px-3 py-2 text-right">
            <div className="text-[11px] font-medium uppercase tracking-wide text-indigo-500">
              Total Revenue
            </div>
            <div className="mt-0.5 text-sm font-black text-indigo-700">
              {rupiah(data?.revenue ?? 0)}
            </div>
          </div>
        </div>

        {revenueChart.length === 0 ? (
          <div className="flex min-h-56 items-center justify-center px-6 py-10 text-sm text-slate-400">
            No paid revenue in this period.
          </div>
        ) : (
          <div className="overflow-x-auto px-4 pb-4 pt-5 sm:px-5">
            <div style={{ minWidth: chartWidth }}>
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="h-[260px] w-full overflow-visible"
                role="img"
                aria-label="Daily paid revenue line chart"
              >
                <defs>
                  <linearGradient id="revenueArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.20" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = topPadding + ratio * plotHeight;
                  const value = maxRevenue * (1 - ratio);

                  return (
                    <g key={ratio}>
                      <line
                        x1={leftPadding}
                        x2={chartWidth - rightPadding}
                        y1={y}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeDasharray="4 6"
                      />
                      <text
                        x={leftPadding - 8}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-slate-400 text-[9px]"
                      >
                        {value >= 1000 ? `${Math.round(value / 1000)}k` : Math.round(value)}
                      </text>
                    </g>
                  );
                })}

                {points.length > 1 && (
                  <polygon points={areaPoints} fill="url(#revenueArea)" />
                )}

                {points.length > 1 && (
                  <polyline
                    points={linePoints}
                    fill="none"
                    stroke="#4f46e5"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {points.map((point) => (
                  <g key={point.date} className="group">
                    <line
                      x1={point.x}
                      x2={point.x}
                      y1={point.y}
                      y2={topPadding + plotHeight}
                      stroke="#c7d2fe"
                      strokeDasharray="3 5"
                      opacity="0"
                      className="transition-opacity group-hover:opacity-100"
                    />
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="5"
                      fill="#ffffff"
                      stroke="#4f46e5"
                      strokeWidth="3"
                      className="cursor-pointer transition-all group-hover:r-[7]"
                    >
                      <title>{`${point.label}: ${rupiah(point.value)}`}</title>
                    </circle>
                    <text
                      x={point.x}
                      y={chartHeight - 18}
                      textAnchor="middle"
                      className="fill-slate-500 text-[10px] font-semibold"
                    >
                      {point.label}
                    </text>
                    <text
                      x={point.x}
                      y={Math.max(14, point.y - 12)}
                      textAnchor="middle"
                      className="fill-indigo-600 text-[9px] font-bold opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      {rupiah(point.value)}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-3">Order</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Barber</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {data?.pesanan.map((order) => (
                <tr className="border-t" key={order.id}>
                  <td className="p-3 font-bold">{order.nomorPesanan}</td>
                  <td>{tanggal(order.dibuatPada)}</td>
                  <td>{order.pelanggan.nama}</td>
                  <td>{order.barber.nama}</td>
                  <td>
                    <StatusBadge value={order.status} />
                  </td>
                  <td>
                    <StatusBadge value={order.statusPembayaran} />
                  </td>
                  <td>{rupiah(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
