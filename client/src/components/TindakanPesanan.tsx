import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, pesanError } from "../lib/api";
import { rupiah } from "../lib/format";
import { waktuWib } from "../lib/pesanan-terpadu";
import { useAuth } from "../context/AuthContext";
import type { Barber } from "../types";
import { Button, Input, Select } from "./ui";
import "./TindakanPesanan.css";

type Transaksi = { id: number; metode: "CASH" | "TRANSFER" | "QRIS"; status: string; nominal: number; referensi: string | null;
  urlQris: string | null; kedaluwarsaPada: string | null; statusProvider: string | null; faseProvider: string | null;
  dibuatPada: string; dibayarPada: string | null; pengguna: { name: string }; };
type DataPembayaran = { transaksi: Transaksi[] };
type KonteksDp = { dp: { nominal: number; deadline: string | null; statusProvider: string; urlPembayaran: string | null } };
type PermintaanBayar = { metode: "CASH" | "TRANSFER" | "QRIS"; kunciIdempotensi: string; tagihanDiharapkan: number; diterima?: true; jumlahDiterima?: number; referensi?: string };

export default function TindakanPesanan({ jenis, id, pesananId, status, barberAwal, balance, dpSah, lunas, onQrisLunas }: {
  jenis: "BOOKING" | "WALK_IN"; id: number; pesananId: number | null | undefined; status: string;
  barberAwal: number | null | undefined; balance: number | undefined; dpSah: boolean; lunas: boolean; onQrisLunas: () => void;
}) {
  const klien = useQueryClient(), { user } = useAuth(), guard = useRef(false), diamati = useRef<number | null>(null);
  const [barberId, aturBarber] = useState(barberAwal ?? 0), dipilihManual = useRef(false);
  const [metode, aturMetode] = useState<"CASH" | "TRANSFER" | "QRIS">("CASH"), [uang, aturUang] = useState(""), [referensi, aturReferensi] = useState("");
  const [diterima, aturDiterima] = useState(false), [sibuk, aturSibuk] = useState(false), [galat, aturGalat] = useState("");
  const [tertunda, aturTertunda] = useState<PermintaanBayar | null>(null), [hasil, aturHasil] = useState("");
  const mulai = status === (jenis === "BOOKING" ? "CHECKED_IN" : "WAITING");
  const barbers = useQuery({ queryKey: ["barbers"], queryFn: async () => (await api.get<Barber[]>("/barbers")).data, enabled: mulai });
  const dp = useQuery({ queryKey: ["booking-payments", id, "dashboard-context"], queryFn: async () => (await api.get<KonteksDp>(`/management/actions/BOOKING/${id}/context`)).data, enabled: jenis === "BOOKING", refetchInterval: 10000 });
  const payments = useQuery({ queryKey: ["orders", "operator-payments", pesananId], queryFn: async () => (await api.get<DataPembayaran>(`/management/payments/${pesananId}`)).data, enabled: !!pesananId, refetchInterval: 5000 });
  const aktif = payments.data?.transaksi.find(t => t.status === "PENDING"), terakhir = payments.data?.transaksi[0];
  const refresh = async () => { for (const key of ["orders", "order", "dashboard", "booking", "booking-payments", "invoices"]) await klien.invalidateQueries({ queryKey: [key] }); };
  useEffect(() => { if (!dipilihManual.current) aturBarber(barberAwal ?? 0); }, [barberAwal]);
  useEffect(() => { if (aktif?.metode === "QRIS") { aturMetode("QRIS"); diamati.current = aktif.id; } }, [aktif?.id, aktif?.metode]);
  useEffect(() => {
    if (!diamati.current) return;
    if (payments.data?.transaksi.some(t => t.id === diamati.current && t.metode === "QRIS" && t.status === "SUCCEEDED") && lunas) onQrisLunas();
  }, [payments.data, lunas, onQrisLunas]);
  const sinkron = async () => {
    if (!aktif || guard.current) return;
    guard.current = true; aturSibuk(true); aturGalat("");
    try { await api.post(`/management/payments/${pesananId}/${aktif.id}/sync`, {}); await refresh(); }
    catch (e) { aturGalat(pesanError(e)); } finally { guard.current = false; aturSibuk(false); }
  };
  useEffect(() => {
    if (aktif?.metode !== "QRIS") return;
    const t = setInterval(() => { if (document.visibilityState === "visible" && navigator.onLine) void sinkron(); }, 15000);
    return () => clearInterval(t);
  }, [aktif?.id, pesananId]);
  const aksi = async (jalur: string, body: object, pesan: string, method: "post" | "patch" = "post") => {
    if (guard.current) return;
    guard.current = true; aturSibuk(true); aturGalat(""); aturHasil("");
    try { await api[method](jalur, body); await refresh(); aturHasil(pesan); }
    catch (e) { aturGalat(pesanError(e)); } finally { guard.current = false; aturSibuk(false); }
  };
  const bayar = async () => {
    if (guard.current || !pesananId || !balance || aktif || !payments.isSuccess) return;
    const data: PermintaanBayar = tertunda ?? { metode, kunciIdempotensi: crypto.randomUUID(), tagihanDiharapkan: balance,
      ...(metode === "QRIS" ? {} : { diterima: true, jumlahDiterima: metode === "CASH" ? Number(uang || balance) : balance, ...(metode === "TRANSFER" ? { referensi: referensi.trim() } : {}) }) };
    guard.current = true; aturSibuk(true); aturGalat(""); aturTertunda(data);
    try {
      const r = (await api.post<{ transaksi: Transaksi }>(`/management/payments/${pesananId}`, data)).data;
      if (data.metode === "QRIS") diamati.current = r.transaksi.id;
      aturTertunda(null); aturDiterima(false); aturHasil(data.metode === "QRIS" ? "Permintaan QRIS tercatat. Periksa status provider di bawah." : "Pembayaran tercatat melalui backend."); await refresh();
    } catch (e) { const pasti = axios.isAxiosError(e) && e.response && e.response.status < 500 && ![401,403,408,429].includes(e.response.status) && e.response.data?.kode !== "IDEMPOTENSI_BERBEDA"; if (pasti) { aturTertunda(null); aturDiterima(false); } aturGalat(pasti ? pesanError(e) : `${pesanError(e)} Periksa status terbaru sebelum mengirim ulang; kunci permintaan tetap sama.`); await refresh(); }
    finally { guard.current = false; aturSibuk(false); }
  };
  const bisaBayar = status === "COMPLETED" && balance !== undefined && balance > 0 && !lunas && (jenis !== "BOOKING" || dpSah);
  const qris = aktif?.metode === "QRIS" ? aktif : metode === "QRIS" && terakhir?.metode === "QRIS" ? terakhir : undefined;
  return <>
    <section className="quick-section dt-actions"><h3>Detail & Tindakan</h3>
      {galat && <p className="dt-error" role="alert">{galat}</p>}{hasil && <p className="dt-success" role="status">{hasil}</p>}
      {jenis === "BOOKING" && ["AWAITING_DP", "CONFIRMED"].includes(status) && !dpSah && <div className="dt-dp"><h4>Menunggu DP terverifikasi</h4>{dp.data ? <><dl><div><dt>Nominal DP</dt><dd>{rupiah(dp.data.dp.nominal)}</dd></div><div><dt>Deadline · WIB</dt><dd>{dp.data.dp.deadline ? waktuWib(dp.data.dp.deadline) : "Tidak tersedia"}</dd></div><div><dt>Status Midtrans</dt><dd>{dp.data.dp.statusProvider}</dd></div></dl>{dp.data.dp.urlPembayaran && <Button variant="secondary" disabled={sibuk} onClick={async () => { try { await navigator.clipboard.writeText(dp.data!.dp.urlPembayaran!); aturHasil("Tautan pembayaran disalin."); } catch { aturGalat("Browser tidak mengizinkan penyalinan tautan."); } }}>Salin Tautan Pembayaran</Button>}</> : <p>Status DP belum dapat dimuat.</p>}<Button variant="secondary" disabled={sibuk} onClick={() => void aksi(`/management/actions/BOOKING/${id}/sync-dp`, {}, "Status DP diperiksa melalui Midtrans.")}>Periksa Midtrans</Button><p>DP hanya terbayar setelah verifikasi provider. Check-in tidak tersedia sebelum DP sah.</p></div>}
      {jenis === "BOOKING" && status === "CONFIRMED" && dpSah && <><p>Check-in mencatat kedatangan pelanggan dan belum memulai pelayanan.</p><Button disabled={sibuk} onClick={() => void aksi(`/bookings/${id}/check-in`, {}, "Pelanggan sudah check-in. Pilih barber sebelum mulai layanan.")}>Konfirmasi Check-in</Button></>}
      {mulai && <><label htmlFor="dt-barber">Barber yang melayani</label><Select id="dt-barber" value={barberId} disabled={sibuk} onChange={e => { dipilihManual.current = true; aturBarber(Number(e.target.value)); }}><option value={0}>Pilih barber</option>{barbers.data?.filter(b => b.aktif).map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}</Select><p>{jenis === "BOOKING" && user?.role === "ADMIN" ? "Barber reservasi menjadi default. Pergantian oleh Admin dicatat saat layanan dimulai." : "Ketersediaan barber diperiksa backend saat layanan dimulai."}</p><Button disabled={sibuk || !barberId || jenis === "BOOKING" && !dpSah || !barbers.isSuccess} onClick={() => void aksi(jenis === "BOOKING" ? `/management/actions/BOOKING/${id}/start` : `/orders/${id}/status`, jenis === "BOOKING" ? { barberId } : { barberId, status: "IN_SERVICE" }, "Pelayanan dimulai dengan barber terpilih.", jenis === "BOOKING" ? "post" : "patch")}>Mulai Layanan</Button></>}
      {status === "IN_SERVICE" && <Button disabled={sibuk} onClick={() => void aksi(jenis === "BOOKING" ? `/bookings/${id}/complete` : `/orders/${id}/status`, jenis === "BOOKING" ? {} : { status: "COMPLETED" }, "Pelayanan selesai. Drawer tetap terbuka untuk pembayaran.", jenis === "BOOKING" ? "post" : "patch")}>Selesaikan Layanan</Button>}
      {bisaBayar && <div className="dt-payment"><h4>{jenis === "BOOKING" ? "Terima Pelunasan" : "Terima Pembayaran"}</h4><p>Seluruh sisa tagihan <strong>{rupiah(balance)}</strong>. Pembayaran sebagian tidak tersedia.</p>
        {payments.isError ? <p className="dt-error">Status transaksi belum dapat dipastikan. <button onClick={() => void payments.refetch()}>Periksa lagi</button></p> : <><div className="dt-methods">{(["CASH", "TRANSFER", "QRIS"] as const).map(m => <button key={m} aria-pressed={metode === m} disabled={sibuk || !!aktif || !!tertunda} onClick={() => { aturMetode(m); aturDiterima(false); }}>{m === "CASH" ? "Tunai" : m === "TRANSFER" ? "Transfer Manual" : "QRIS Midtrans"}</button>)}</div>
          {qris && <div className="dt-qris"><strong>{rupiah(qris.nominal)}</strong><p>Status: {qris.statusProvider ?? qris.status}</p>{qris.status === "PENDING" && qris.urlQris && <img src={qris.urlQris} alt="QRIS pembayaran dari Midtrans" referrerPolicy="no-referrer" onLoad={() => { diamati.current = qris.id; }} />}{qris.kedaluwarsaPada && <p>Kedaluwarsa · WIB: {waktuWib(qris.kedaluwarsaPada)}</p>}<p>{qris.status === "PENDING" ? "Menunggu konfirmasi Midtrans. Menutup drawer tidak membatalkan transaksi." : "Transaksi sudah final. Percobaan baru memakai identitas transaksi baru."}</p>{qris.status === "PENDING" && <Button variant="secondary" disabled={sibuk} onClick={() => void sinkron()}>Periksa Status QRIS</Button>}</div>}
          {!aktif && <><fieldset disabled={sibuk || !!tertunda}>{metode === "CASH" && <><label htmlFor="dt-uang">Uang diterima</label><Input id="dt-uang" type="number" min={balance} max={2147483647} step={1} value={uang} placeholder={String(balance)} onChange={e => aturUang(e.target.value)} /><p>Kembalian: {rupiah(Math.max(0, Number(uang || balance) - balance))}</p></>}{metode === "TRANSFER" && <><label htmlFor="dt-referensi">Referensi / keterangan transaksi</label><Input id="dt-referensi" maxLength={300} value={referensi} onChange={e => aturReferensi(e.target.value)} placeholder="Referensi dana masuk yang sudah diperiksa" /></>}{metode !== "QRIS" && <label className="dt-confirm"><input type="checkbox" checked={diterima} onChange={e => aturDiterima(e.target.checked)} />{metode === "CASH" ? "Saya sudah menerima uang fisik sesuai nominal di atas." : "Saya sudah memeriksa dan menerima dana transfer seluruh sisa tagihan."}</label>}</fieldset><Button disabled={sibuk || !payments.isSuccess || !tertunda && metode !== "QRIS" && (!diterima || metode === "CASH" && (!Number.isSafeInteger(Number(uang || balance)) || Number(uang || balance) < balance) || metode === "TRANSFER" && referensi.trim().length < 3)} onClick={() => void bayar()}>{sibuk ? "Memproses…" : tertunda ? "Kirim Ulang Permintaan yang Sama" : metode === "QRIS" ? "Tampilkan QRIS Midtrans" : metode === "CASH" ? "Catat Pembayaran Tunai" : "Konfirmasi Transfer Diterima"}</Button></>}
        </>}
      </div>}
      {aktif?.faseProvider === "REVIEW" && <p className="dt-error">Pembayaran provider memerlukan pemeriksaan Admin. Tidak ada kredit tambahan yang dicatat otomatis.</p>}{lunas && <p className="dt-success">Pembayaran lunas berdasarkan pencatatan backend.</p>}
    </section>
    {!!payments.data?.transaksi.length && <section className="quick-section"><h3>Riwayat pembayaran</h3><ol className="quick-timeline">{payments.data.transaksi.map(t => <li key={t.id}><strong>{t.metode === "TRANSFER" ? "Transfer Manual" : t.metode} · {rupiah(t.nominal)}</strong><p>{t.status} · {t.pengguna.name}</p>{t.referensi && <p>{t.referensi}</p>}<time>{waktuWib(t.dibayarPada ?? t.dibuatPada)}</time></li>)}</ol></section>}
  </>;
}
