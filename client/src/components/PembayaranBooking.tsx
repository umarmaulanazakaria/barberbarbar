import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, pesanError } from "../lib/api";
import { ambilPembayaranBooking, izinBooking } from "../lib/booking";
import type { Booking } from "../types-booking";
import type { MetodePembayaran } from "../types";
import { rupiah, waktu } from "../lib/format";
import { useToast } from "../context/ToastContext";
import { Button, Card, ErrorState, Input, Label, LoadingState, Select, StatusBadge, Textarea } from "./ui";
import ConfirmDialog from "./ConfirmDialog";
import axios from "axios";
import { statusRamah, pesanPembayaranPercobaan } from '../lib/teks';

export default function PembayaranBooking({ booking }: { booking: Booking }) {
  const klien = useQueryClient(), toast = useToast();
  const ringkasan = useQuery({ queryKey: ["booking-payments", booking.id], queryFn: () => ambilPembayaranBooking(booking.id), refetchInterval: 15000 });
  const [jumlah, setJumlah] = useState("");
  const [metode, setMetode] = useState<MetodePembayaran>("CASH");
  const [catatan, setCatatan] = useState("");
  const [konfirmasi, setKonfirmasi] = useState(false);
  // Retry setelah network error memakai identitas DAN body yang sama, bukan payment baru.
  const percobaan = useRef<{ kunciIdempotensi: string; metode: MetodePembayaran; jumlahDiterima: number; catatan?: string } | null>(null);
  const bayar = useMutation({ mutationFn: async () => {
    const data = ringkasan.data;
    if (!data || !izinBooking(booking, data).lunasi) throw new Error("Pelunasan belum tersedia");
    if (!percobaan.current) percobaan.current = { kunciIdempotensi: crypto.randomUUID(), metode, jumlahDiterima: jumlah === "" ? data.balance : Number(jumlah), ...(catatan.trim() ? { catatan: catatan.trim() } : {}) };
    return api.post(`/bookings/${booking.id}/payments/settlement`, percobaan.current);
  }, onSuccess: () => { percobaan.current = null; setKonfirmasi(false); toast.success("Pelunasan tersimpan."); }, onError: e => {
    // Respons validasi eksplisit memastikan request ini tidak dicatat sebagai pembayaran.
    // Respons ambigu/network tetap mempertahankan kunci dan body untuk retry aman.
    if (axios.isAxiosError(e) && [400, 401, 403, 404].includes(e.response?.status ?? 0)) percobaan.current = null;
    setKonfirmasi(false); toast.error(pesanError(e));
  }, onSettled: async () => {
    await Promise.all(["booking-payments", "orders", "order", "invoices", "reports", "dashboard"].map(akar => klien.invalidateQueries({ queryKey: akar === "booking-payments" ? [akar, booking.id] : [akar] })));
  }});
  const finalisasi = useMutation({ mutationFn: () => api.post(`/bookings/${booking.id}/payments/finalize-invoice`, {}), onSuccess: () => toast.success("Invoice final tersedia."), onError: e => toast.error(pesanError(e)), onSettled: () => klien.invalidateQueries({ queryKey: ["booking-payments", booking.id] }) });
  if (ringkasan.isPending) return <LoadingState text="Memuat pembayaran…" />;
  if (ringkasan.isError) return <ErrorState text={pesanError(ringkasan.error)} onRetry={() => void ringkasan.refetch()} />;
  const data = ringkasan.data, boleh = izinBooking(booking, data).lunasi;
  const nominal = jumlah === "" ? data.balance : Number(jumlah);
  const sah = Number.isSafeInteger(nominal) && nominal >= data.balance && nominal <= 2147483647;
  const terkunci = bayar.isPending || percobaan.current !== null;
  return <Card aria-busy={bayar.isPending || ringkasan.isFetching} className="admin-keuangan space-y-3 p-4">
    <h2 className="font-bold">Pembayaran booking</h2>{data.pembayaranPercobaan === true && <p className="text-xs text-slate-500">Online: {pesanPembayaranPercobaan}</p>}<StatusBadge value={data.statusPembayaran} />
    <dl className="grid grid-cols-2 gap-2 text-sm"><dt>Subtotal tagihan</dt><dd>{rupiah(data.subtotal)}</dd><dt>Diskon booking ({booking.discountPercent}%)</dt><dd>{rupiah(data.diskon)}</dd><dt>Total</dt><dd>{rupiah(data.total)}</dd><dt>DP awal</dt><dd>{rupiah(data.nominalDpAwal)} · {data.dpTerverifikasi ? "Terverifikasi" : "Belum terverifikasi"}</dd><dt>Pembayaran bersih</dt><dd>{rupiah(data.jumlahDibayar)}</dd><dt>Sisa tagihan</dt><dd className="font-bold">{rupiah(data.balance)}</dd><dt>Kelebihan</dt><dd>{rupiah(data.kelebihan)}</dd></dl>
    <p className="text-xs text-slate-500">Uang muka dibayar online. Layanan selesai belum berarti tagihan lunas. Tagihan yang melewati batas waktu tetap dapat dibayar.</p>
    {data.invoice ? <div className="rounded bg-emerald-50 p-3"><b>Invoice final: {data.invoice.nomorInvoice}</b><p>{rupiah(data.invoice.total)} · {waktu(data.invoice.dibuatPada)}</p></div> : <p>Invoice sementara · belum final</p>}
    {data.statusPembayaran === "PAID" && !data.invoice && <Button disabled={finalisasi.isPending} onClick={() => finalisasi.mutate()}>Finalisasi invoice</Button>}
    <ul className="space-y-2 text-xs">{data.transaksi.map(t => <li key={t.id} className="rounded border p-2">{statusRamah(t.tujuan)} · {statusRamah(t.kanal)} · {rupiah(t.nominal)} · <StatusBadge value={t.status} /><p>{waktu(t.dibuatPada)} {t.dibayarPada && `· Dibayar ${waktu(t.dibayarPada)}`}</p></li>)}</ul>
    {boleh && <><Label>Metode pelunasan kasir</Label><Select aria-label="Metode pelunasan" disabled={terkunci} value={metode} onChange={e => setMetode(e.target.value as MetodePembayaran)}>{["CASH", "QRIS", "CARD", "TRANSFER", "OTHER"].map(m => <option key={m} value={m}>{statusRamah(m)}</option>)}</Select><Label>Jumlah diterima</Label><Input aria-label="Jumlah diterima" type="number" min={data.balance} max={2147483647} step={1} placeholder={String(data.balance)} value={jumlah} disabled={terkunci} onChange={e => setJumlah(e.target.value)} /><Label>Catatan pelunasan</Label><Textarea maxLength={500} value={catatan} disabled={terkunci} onChange={e => setCatatan(e.target.value)} />
      {percobaan.current && <p className="text-xs">Hasil pembayaran sebelumnya belum dapat dipastikan. Periksa status sebelum mencoba kembali.</p>}
      <Button disabled={!sah || bayar.isPending || ringkasan.isFetching} onClick={() => setKonfirmasi(true)}>{bayar.isPending ? "Memproses…" : percobaan.current ? "Periksa / ulangi pelunasan yang sama" : "Lunasi melalui kasir"}</Button></>}
    <ConfirmDialog open={konfirmasi} title="Konfirmasi pelunasan" description={`Pelunasan tagihan ${booking.nomorBooking}. Sisa tagihan ${rupiah(data.balance)}.`} loading={bayar.isPending} onCancel={() => setKonfirmasi(false)} onConfirm={() => bayar.mutate()} />
  </Card>;
}
