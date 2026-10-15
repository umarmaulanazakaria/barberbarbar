import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ambilPembayaranBooking, daftarBooking } from "../lib/booking";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { rupiah } from "../lib/format";
import { waktuBooking } from "../lib/tampilan-booking";
import type { PermohonanRefund } from "../types-booking";
import { Card, Empty, ErrorState, LoadingState, StatusBadge } from "./ui";

export default function RingkasanBookingDashboard() {
  const { user } = useAuth();
  const bookings = useQuery({ queryKey: ["bookings"], queryFn: daftarBooking, refetchInterval: 30000 });
  const terbaru = [...(bookings.data ?? [])].sort((a, b) => new Date(b.dibuatPada).getTime() - new Date(a.dibuatPada).getTime()).slice(0, 5);
  const pembayaran = useQueries({ queries: terbaru.map(b => ({ queryKey: ["booking-payments", b.id], queryFn: () => ambilPembayaranBooking(b.id), refetchInterval: 30000 })) });
  const refund = useQuery({ queryKey: ["refund-requests"], queryFn: async () => (await api.get<{ data: PermohonanRefund[] }>("/refund-requests")).data.data, enabled: user?.role === "ADMIN" });
  const membership = useQuery({ queryKey: ["membership-requests"], queryFn: async () => (await api.get<{ data: { status: string }[] }>("/membership-requests")).data.data, enabled: user?.role === "ADMIN" });
  return <Card className="mb-4 space-y-3 p-4"><Link to="/bookings" className="font-bold text-indigo-700">Booking Pelanggan</Link>{bookings.isPending ? <LoadingState /> : bookings.isError ? <ErrorState onRetry={() => void bookings.refetch()} /> : <><div className="flex flex-wrap gap-4 text-sm"><span>Menunggu konfirmasi: <b>{bookings.data.filter(b => b.status === "PENDING_CONFIRMATION").length}</b></span><span>Dikonfirmasi: <b>{bookings.data.filter(b => b.status === "CONFIRMED").length}</b></span><span>Check-in: <b>{bookings.data.filter(b => b.status === "CHECKED_IN").length}</b></span></div><h3 className="text-sm font-bold">Lima booking terbaru</h3>{!terbaru.length && <Empty text="Belum ada booking." />}{terbaru.map((b, i) => <div className="flex flex-wrap justify-between gap-2 border-t pt-2 text-sm" key={b.id}><div><Link to={`/bookings/${b.id}`} className="font-bold text-indigo-700">{b.pelanggan.nama} · {b.nomorBooking}</Link><p className="text-xs">{waktuBooking(b.mulaiPada)}</p><StatusBadge value={b.status} /></div><div>{pembayaran[i].isPending ? "Memuat pembayaran…" : pembayaran[i].isError ? <button className="text-red-700" onClick={() => void pembayaran[i].refetch()}>Pembayaran gagal dimuat · coba lagi</button> : <><StatusBadge value={pembayaran[i].data!.statusPembayaran} /><p>DP {pembayaran[i].data!.dpTerverifikasi ? "terverifikasi" : "belum terverifikasi"} · sisa {rupiah(pembayaran[i].data!.balance)}</p></>}</div></div>)}</>}
    {user?.role === "ADMIN" && <div className="flex flex-wrap gap-4 border-t pt-3 text-sm"><Link to="/membership">Pengajuan membership: {membership.isError ? "Gagal dimuat" : membership.isPending ? "Memuat…" : membership.data.filter(m => m.status === "PENDING_APPROVAL").length}</Link><Link to="/refunds">Pengembalian dana menunggu admin: {refund.isError ? "Gagal dimuat" : refund.isPending ? "Memuat…" : refund.data.filter(r => r.status === "PENDING_APPROVAL").length} · sedang diproses: {refund.data?.filter(r => r.status === "PROCESSING").length ?? "—"}</Link></div>}
  </Card>;
}
