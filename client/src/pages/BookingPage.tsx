import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { daftarBooking } from "../lib/booking";
import { pesanError } from "../lib/api";
import { rupiah } from "../lib/format";
import { Button, Card, Empty, ErrorState, Input, LoadingState, PageTitle, Select, StatusBadge } from "../components/ui";
import { statusBooking, waktuBooking } from "../lib/tampilan-booking";

export default function BookingPage() {
  const [filter, setFilter] = useState(""), [cari, setCari] = useState("");
  const daftar = useQuery({ queryKey: ["bookings"], queryFn: daftarBooking, refetchInterval: 30000 });
  const hasil = daftar.data?.filter(b => (!filter || b.status === filter) && `${b.nomorBooking} ${b.pelanggan.nama}`.toLocaleLowerCase("id-ID").includes(cari.toLocaleLowerCase("id-ID"))) ?? [];
  return <><PageTitle title="Booking Pelanggan" subtitle="Konfirmasi, operasional dan pembayaran booking" action={<Button variant="secondary" disabled={daftar.isFetching} onClick={() => void daftar.refetch()}>Perbarui</Button>} />
    <div className="mb-4 grid gap-2 sm:grid-cols-2"><Input aria-label="Cari booking" placeholder="Cari nomor booking / pelanggan" value={cari} onChange={e => setCari(e.target.value)} /><Select aria-label="Filter status booking" value={filter} onChange={e => setFilter(e.target.value)}><option value="">Semua status</option>{statusBooking.map(s => <option key={s}>{s}</option>)}</Select></div>
    <Card>{daftar.isPending ? <LoadingState /> : daftar.isError ? <ErrorState text={pesanError(daftar.error)} onRetry={() => void daftar.refetch()} /> : !hasil.length ? <Empty text="Belum ada booking sesuai filter." /> : <ul className="divide-y">{hasil.map(b => <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><Link className="font-bold text-indigo-700" to={`/bookings/${b.id}`}>{b.pelanggan.nama} · {b.nomorBooking}</Link><p className="text-xs text-slate-500">{waktuBooking(b.mulaiPada)} · {b.durasiMenit} menit · {rupiah(b.total)}</p>{b.riwayat.some(r => r.aksi.startsWith("TIMEOUT")) && <p className="text-xs text-red-600">Dibatalkan otomatis karena batas waktu.</p>}{b.riwayat.some(r => r.aksi === "RESCHEDULE") && <p className="text-xs">Jadwal pernah diubah.</p>}</div><StatusBadge value={b.status} /></li>)}</ul>}</Card></>;
}
