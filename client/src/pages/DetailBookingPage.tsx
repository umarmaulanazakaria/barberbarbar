import VerifikasiMemberBooking from "../components/VerifikasiMemberBooking";
import PengaitanProfilBooking from "../components/PengaitanProfilBooking";
import { statusRamah, rincianRamah } from '../lib/teks';
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, pesanError } from "../lib/api";
import { ambilBooking, ambilPembayaranBooking, batasKonfirmasi, izinBooking } from "../lib/booking";
import { waktuBooking } from "../lib/tampilan-booking";
import { rupiah } from "../lib/format";
import { useToast } from "../context/ToastContext";
import type { Barber, Layanan, Pesanan } from "../types";
import { Button, Card, Empty, ErrorState, Input, Label, LoadingState, PageTitle, Select, StatusBadge, Textarea } from "../components/ui";
import PembayaranBooking from "../components/PembayaranBooking";
import PemulihanTracking from "../components/PemulihanTracking";
import ConfirmDialog from "../components/ConfirmDialog";

export default function DetailBookingPage() {
  const id = Number(useParams().id);
  if (!Number.isSafeInteger(id) || id < 1) return <ErrorState text="ID booking tidak valid." />;
  return <DetailBooking key={id} id={id} />;
}
function DetailBooking({ id }: { id: number }) {
  const klien = useQueryClient(), toast = useToast();
  const booking = useQuery({ queryKey: ["booking", id], queryFn: () => ambilBooking(id), refetchInterval: 15000 });
  const pembayaran = useQuery({ queryKey: ["booking-payments", id], queryFn: () => ambilPembayaranBooking(id), refetchInterval: 15000 });
  const barbers = useQuery({ queryKey: ["barbers"], queryFn: async () => (await api.get<Barber[]>("/barbers")).data });
  const layanan = useQuery({ queryKey: ["services"], queryFn: async () => (await api.get<Layanan[]>("/layanan")).data });
  const pesananId = booking.data?.pesananId;
  const pesanan = useQuery({ queryKey: ["order", pesananId], queryFn: async () => (await api.get<Pesanan>(`/orders/${pesananId}`)).data, enabled: !!pesananId });
  const [alasan, setAlasan] = useState(""), [barber, setBarber] = useState(0);
  const [usulan, setUsulan] = useState(0), [alasanUsulan, setAlasanUsulan] = useState("");
  const [items, setItems] = useState<{ layananId: number; qty: number }[] | null>(null);
  const [aksi, setAksi] = useState<"confirm" | "reject" | "check-in" | "start" | "complete" | "barber-proposals" | "services" | null>(null);
  const [sekarang, setSekarang] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setSekarang(Date.now()), 1000); return () => clearInterval(t); }, []);
  const keputusan = useMutation({ mutationFn: async () => {
    const b = booking.data;
    if (!b || !aksi) throw new Error("Booking belum tersedia");
    const izin = izinBooking(b, pembayaran.data);
    if ((aksi === "confirm" && !izin.konfirmasi) || (aksi === "reject" && !izin.tolak) || (aksi === "check-in" && !izin.checkIn) || (aksi === "start" && !izin.mulai) || (aksi === "complete" && !izin.selesai) || (aksi === "barber-proposals" && !izin.usulkan) || (aksi === "services" && !izin.ubahLayanan)) throw new Error("Operasi tidak tersedia pada status ini");
    const body = aksi === "reject" ? { alasan: alasan.trim() } : aksi === "start" ? { barberId: b.barberDisetujuiId ?? b.barberPilihanId ?? barber } : aksi === "barber-proposals" ? { barberId: usulan, alasan: alasanUsulan.trim() } : aksi === "services" ? { items } : {};
    return aksi === "services" ? api.put(`/bookings/${id}/services`, body) : api.post(`/bookings/${id}/${aksi}`, body);
  }, onSuccess: () => { setAksi(null); setItems(null); toast.success("Perubahan booking tersimpan."); }, onError: e => { setAksi(null); toast.error(pesanError(e)); }, onSettled: async () => {
    await Promise.all([["booking", id], ["booking-payments", id], ["bookings"], ["order"], ["orders"], ["dashboard"]].map(key => klien.invalidateQueries({ queryKey: key })));
  }});
  if (booking.isPending) return <LoadingState />;
  if (booking.isError) return <ErrorState text={pesanError(booking.error)} onRetry={() => void booking.refetch()} />;
  const b = booking.data, izin = izinBooking(b, pembayaran.data, sekarang), busy = keputusan.isPending || booking.isFetching;
  const namaBarber = (nilai: number | null) => nilai === null ? "Siapa saja" : barbers.data?.find(x => x.id === nilai)?.nama ?? `Barber #${nilai}`;
  const pilihan = b.barberDisetujuiId ?? b.barberPilihanId;
  // Refetch latar tidak membekukan edit lokal. Simpan/tindakan server tetap
  // mengikuti busy dan seluruh prasyarat backend yang sama.
  const daftarItems = items ?? (pesanan.data?.items ?? b.items).map(i => ({ layananId: i.layananId, qty: i.qty }));
  const validItems = daftarItems.length > 0 && daftarItems.every(i => Number.isInteger(i.qty) && i.qty >= 1 && i.qty <= 20 && layanan.data?.some(l => l.id === i.layananId && l.aktif)) && new Set(daftarItems.map(i => i.layananId)).size === daftarItems.length;
  return <><PageTitle title="Detail Booking" subtitle={b.nomorBooking} action={<Link to="/orders?jenis=BOOKING">Kembali ke daftar</Link>} /><div aria-busy={busy} className="grid items-start gap-4 xl:grid-cols-2"><div className="space-y-4">
    <Card className="admin-detail-overview space-y-3 p-4"><span className="admin-eyebrow">INFORMASI KUNJUNGAN</span><h2 className="font-bold">{b.pelanggan.nama}</h2><StatusBadge value={b.status} />{["PENDING_CONFIRMATION","CONFIRMED","CHECKED_IN"].includes(b.status) && (pembayaran.data?.jumlahDibayar ?? 0) > 0 && <p className="rounded-lg border border-amber-700 bg-amber-50 p-3 text-sm text-amber-700">Pembatalan/penolakan booking berbayar belum tersedia. Pembayaran tetap tercatat; hubungi pengelola untuk peninjauan.</p>}<div className="admin-jadwal"><span>Jadwal layanan</span><strong>{waktuBooking(b.mulaiPada)}</strong><p>Sampai {waktuBooking(b.selesaiPada)} ? {b.durasiMenit} menit</p></div><dl className="admin-meta"><div><dt>Preferensi barber</dt><dd>{namaBarber(b.barberPilihanId)}</dd></div><div><dt>Barber disetujui</dt><dd>{namaBarber(b.barberDisetujuiId ?? b.barberPilihanId)}</dd></div><div><dt>Barber final</dt><dd>{b.barberFinalId ? namaBarber(b.barberFinalId) : "Belum ditetapkan"}</dd></div></dl><p>{b.catatan}</p>{b.alasanPenolakan && <p>Alasan penolakan: {b.alasanPenolakan}</p>}
      <h3 className="font-bold">Layanan saat booking</h3>{b.items.map(i => <div className="admin-detail-item" key={i.layananId}><span>{i.namaLayanan}<small>{i.qty} x {rupiah(i.harga)}</small></span><strong>{rupiah(i.subtotal)}</strong></div>)}<p>Total awal {rupiah(b.total)} · Diskon {b.discountPercent}%</p>
      {b.status === "PENDING_CONFIRMATION" && <p className="text-sm">Batas konfirmasi: {waktuBooking(new Date(batasKonfirmasi(b)).toISOString())}{sekarang >= batasKonfirmasi(b) && " · Terlewati; periksa status terbaru"}</p>}
      {b.deadlineDp && <p className="text-sm">Batas DP: {waktuBooking(b.deadlineDp)}</p>}{b.deadlinePelunasan && <p className="text-sm">Batas pelunasan: {waktuBooking(b.deadlinePelunasan)}</p>}
      {izin.konfirmasi && <Button disabled={busy} onClick={() => setAksi("confirm")}>Konfirmasi booking</Button>}
      {izin.tolak && <div><Label htmlFor="bidang-detailbookingpage-1">Alasan penolakan (wajib)</Label><Textarea id="bidang-detailbookingpage-1" aria-label="Alasan penolakan" maxLength={500} value={alasan} onChange={e => setAlasan(e.target.value)} disabled={busy} /><Button variant="danger" disabled={busy || !alasan.trim()} onClick={() => setAksi("reject")}>Tolak booking</Button></div>}
      {b.status === "CONFIRMED" && <Button disabled={busy || !izin.checkIn} onClick={() => setAksi("check-in")}>Check-in customer</Button>}
      {b.status === "CHECKED_IN" && <div><Label htmlFor="bidang-detailbookingpage-2">Barber final</Label><Select id="bidang-detailbookingpage-2" aria-label="Barber final" disabled={busy || pilihan !== null || barbers.isError || barbers.isPending} value={pilihan ?? barber} onChange={e => setBarber(Number(e.target.value))}><option value={0}>Pilih barber aktif</option>{barbers.data?.filter(x => x.aktif || x.id === pilihan).map(x => <option key={x.id} value={x.id} disabled={!x.aktif}>{x.nama}</option>)}</Select><Button disabled={busy || !izin.mulai || !barbers.data?.some(x => x.aktif && x.id === (pilihan ?? barber))} onClick={() => setAksi("start")}>Mulai layanan</Button></div>}
      {["CONFIRMED", "CHECKED_IN"].includes(b.status) && !(pembayaran.data?.syaratDpTerpenuhi || pembayaran.data?.dpTerverifikasi) && <p className="text-sm text-amber-700">Menunggu DP terverifikasi. Check-in dan mulai layanan diblokir.</p>}
      {barbers.isError && <ErrorState text="Daftar barber gagal dimuat." onRetry={() => void barbers.refetch()} />}
      {izin.usulkan && <div className="space-y-2"><Label htmlFor="bidang-detailbookingpage-3">Usulkan barber pengganti</Label><Select id="bidang-detailbookingpage-3" aria-label="Barber pengganti" value={usulan} disabled={busy} onChange={e => setUsulan(Number(e.target.value))}><option value={0}>Pilih pengganti</option>{barbers.data?.filter(x => x.aktif && x.id !== pilihan).map(x => <option key={x.id} value={x.id}>{x.nama}</option>)}</Select><Textarea aria-label="Alasan penggantian" maxLength={500} placeholder="Alasan penggantian (wajib)" value={alasanUsulan} onChange={e => setAlasanUsulan(e.target.value)} /><Button disabled={busy || !usulan || !alasanUsulan.trim()} onClick={() => setAksi("barber-proposals")}>Kirim usulan kepada customer</Button></div>}
      {b.usulanBarber.map(u => <div key={u.id} className="rounded border p-2 text-sm">{namaBarber(u.barberId)} · <StatusBadge value={u.status} /><p>{u.alasan}</p>{u.status === "PENDING" && <p>Menunggu persetujuan pelanggan atas barber pengganti.</p>}</div>)}
    </Card>
    {b.status === "IN_SERVICE" && <Card className="space-y-3 p-4"><h2 className="font-bold">Layanan aktual pesanan</h2>{pesanan.isPending ? <LoadingState /> : pesanan.isError ? <ErrorState onRetry={() => void pesanan.refetch()} /> : <>{daftarItems.map((item, i) => <div key={i} className="flex gap-2"><Select aria-label={`Layanan ${i + 1}`} value={item.layananId} disabled={keputusan.isPending} onChange={e => setItems(daftarItems.map((x, n) => n === i ? { ...x, layananId: Number(e.target.value) } : x))}>{layanan.data?.map(l => <option value={l.id} key={l.id} disabled={!l.aktif || daftarItems.some((x, n) => n !== i && x.layananId === l.id)}>{l.nama} · {rupiah(l.harga)}{!l.aktif && " (nonaktif)"}</option>)}</Select><Input aria-label={`Jumlah layanan ${i + 1}`} className="max-w-20" type="number" min={1} max={20} value={item.qty} disabled={keputusan.isPending} onChange={e => setItems(daftarItems.map((x, n) => n === i ? { ...x, qty: Number(e.target.value) } : x))} /><Button variant="danger" disabled={keputusan.isPending || daftarItems.length <= 1} onClick={() => setItems(daftarItems.filter((_, n) => n !== i))}>Hapus</Button></div>)}<Button variant="secondary" disabled={keputusan.isPending || !layanan.data?.some(l => l.aktif && !daftarItems.some(i => i.layananId === l.id))} onClick={() => { const l = layanan.data?.find(l => l.aktif && !daftarItems.some(i => i.layananId === l.id)); if (l) setItems([...daftarItems, { layananId: l.id, qty: 1 }]); }}>Tambah layanan</Button><Button disabled={busy || !izin.ubahLayanan || !items || !validItems} onClick={() => setAksi("services")}>Simpan layanan</Button><Button variant="secondary" disabled={keputusan.isPending || !items} onClick={() => setItems(null)}>Batalkan edit</Button><p className="text-xs">Diskon booking tetap berlaku. Tagihan akan disesuaikan dengan layanan yang dipilih.</p></>}{layanan.isError && <ErrorState onRetry={() => void layanan.refetch()} />}<Button variant="success" disabled={busy || !izin.selesai || items !== null} onClick={() => setAksi("complete")}>Selesaikan layanan</Button></Card>}
    <details className="ui-card admin-disclosure"><summary>Riwayat booking</summary>{!b.riwayat.length ? <Empty /> : b.riwayat.map((r, i) => <div key={i} className="border-b pb-2 text-sm"><b>{statusRamah(r.aksi)}</b> · {statusRamah(r.statusSebelum)} → {statusRamah(r.statusSetelah)}<p>{waktuBooking(r.dibuatPada)}</p>{r.rincian !== null && <pre className="whitespace-pre-wrap break-all text-xs text-slate-500">{rincianRamah(r.rincian)}</pre>}</div>)}</details>
    </div><div className="space-y-4"><VerifikasiMemberBooking id={id} status={b.status}/><PengaitanProfilBooking id={id}/><PembayaranBooking key={id} booking={b} /><PemulihanTracking key={id} id={id} tamu={!!b.aksesTamu}/></div></div><ConfirmDialog open={aksi !== null} title="Konfirmasi tindakan booking" description={`Jalankan ${statusRamah(aksi === "confirm" ? "CONFIRM" : aksi === "reject" ? "REJECT" : aksi === "check-in" ? "CHECK_IN" : aksi === "start" ? "START" : aksi === "complete" ? "COMPLETE" : aksi === "services" ? "UPDATE_SERVICES" : "PROPOSE_BARBER")} untuk ${b.nomorBooking}? Status dan syarat booking akan diperiksa sebelum perubahan disimpan.`} variant="primary" loading={keputusan.isPending} onCancel={() => setAksi(null)} onConfirm={() => keputusan.mutate()} /></>;
}
