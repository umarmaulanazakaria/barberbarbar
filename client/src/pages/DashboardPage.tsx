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
import { ambilPesananTerpadu, useHariOperasional } from "../lib/pesanan-terpadu";
import TabelPesananTerpadu from "../components/TabelPesananTerpadu";
import { rupiah } from "../lib/format";
import {
  Button,
  Card,
  ErrorState,
  LoadingState,
  PageTitle,
} from "../components/ui";

export default function DashboardPage() {
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const [serverTime, aturServerTime] = useState<string>();
  const hari = useHariOperasional(serverTime);
  const { data: terpadu, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard", "terpadu", hari],
    queryFn: async () => { const d = await ambilPesananTerpadu({periode:"HARI_INI",batas:7,ringkasan:"true"}); aturServerTime(d.serverTime); return d; },
    refetchInterval: 15000,
  });

  const data = terpadu?.metrik;
  const cards = [
    ["Menunggu", data?.waiting ?? 0, Clock3],
    ["Sedang Dilayani", data?.inService ?? 0, Scissors],
    ["Layanan Selesai, Belum Lunas", data?.completedUnpaid ?? 0, WalletCards],
    ["Pembayaran Hari Ini", data?.paidToday ?? 0, UserRoundCheck],
  ] as const;

  return (
    <>
      <PageTitle
        title="Dashboard"
        subtitle="Ringkasan operasional barbershop hari ini"
        action={
          <Button onClick={() => setNewOrderOpen(true)}>+ Pesanan Baru</Button>
        }
      />

      {isLoading ? (
        <Card>
          <LoadingState text="Memuat dashboard..." />
        </Card>
      ) : isError ? (
        <Card>
          <ErrorState
            text="Dashboard belum dapat dimuat."
            onRetry={() => void refetch()}
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(([label, value, Icon]) => (
              <Card key={label} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Icon size={19} />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">{label}</div>
                    <div className="text-2xl font-black text-slate-900">
                      {value}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_.8fr]">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <div className="font-bold">Pesanan Terbaru</div>
                  <div className="text-xs text-slate-400">Jadwal pelayanan hari ini (WIB)</div>
                </div>
                <Link
                  to="/orders"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-100 hover:shadow-sm active:translate-y-0"
                >
                  Lihat semua <ArrowRight size={14} />
                </Link>
              </div>

              <TabelPesananTerpadu data={terpadu?.data ?? []} />
            </Card>

            <div className="space-y-4">
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                    <WalletCards size={19} />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Pendapatan Hari Ini</div>
                    <div className="text-xl font-black text-slate-900">
                      {rupiah(data?.revenueToday ?? 0)}
                    </div>
                  </div>
                </div>
              </Card>
              <Card className="p-5">
                <div className="mb-4 flex items-center gap-2 font-bold">
                  <UsersRound size={17} />
                  Ringkasan
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <b>{data?.pelanggan ?? 0}</b>
                    <div className="text-[10px] text-slate-400">Pelanggan</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <b>{data?.barberAktif ?? 0}</b>
                    <div className="text-[10px] text-slate-400">Barber</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <b>{data?.layananAktif ?? 0}</b>
                    <div className="text-[10px] text-slate-400">Layanan</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      <NewOrderModal
        open={newOrderOpen}
        onClose={() => setNewOrderOpen(false)}
        onCreated={(orderId) => setSelectedOrderId(orderId)}
      />
      <OrderDetailModal
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
      />
    </>
  );
}
