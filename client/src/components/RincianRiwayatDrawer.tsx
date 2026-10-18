import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { X, FileText } from "lucide-react";
import { ambilDetailRiwayat, judulStatusArsip, labelPembayaranArsip, type JenisArsip } from "../lib/riwayat-pesanan";
import { waktuWib } from "../lib/pesanan-terpadu";
import { rupiah } from "../lib/format";
import { statusRamah } from "../lib/teks";
import { useFokusDialog } from "../lib/fokus-dialog";
import { Button, Empty, ErrorState, LoadingState } from "./ui";

export default function RincianRiwayatDrawer() {
  const [params, aturParams] = useSearchParams();
  const jenis: JenisArsip = params.has("rincianBooking") ? "BOOKING" : "WALK_IN";
  const id = Number(params.get("rincianBooking") ?? params.get("rincianPesanan") ?? params.get("pesananId"));
  const terbuka = Number.isSafeInteger(id) && id > 0;
  const panel = useFokusDialog(terbuka);
  const tutup = useCallback(() => aturParams(p => { const q = new URLSearchParams(p); for (const key of ["rincianBooking", "rincianPesanan", "pesananId"]) q.delete(key); return q; }, { replace: true }), [aturParams]);
  const detail = useQuery({ queryKey: ["orders", "arsip", jenis, id], queryFn: ({ signal }) => ambilDetailRiwayat(jenis, id, signal), enabled: terbuka, refetchInterval: 15000 });
  useEffect(() => {
    if (!terbuka) return;
    const shell = document.querySelector<HTMLElement>(".admin-shell"), semula = shell?.inert, overflow = document.body.style.overflow;
    if (shell) shell.inert = true;
    document.body.style.overflow = "hidden";
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); tutup(); } };
    window.addEventListener("keydown", escape);
    return () => { if (shell) shell.inert = semula ?? false; document.body.style.overflow = overflow; window.removeEventListener("keydown", escape); };
  }, [terbuka, tutup]);
  if (!terbuka) return null;
  const d = detail.data;
  return createPortal(<><div className="quick-backdrop" aria-hidden="true" onClick={tutup} /><div className="quick-drawer rh-drawer" ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Detail riwayat pesanan">
    <header className="quick-header"><div><p>DETAIL PESANAN · ARSIP</p><h2>{d?.nomor ?? "Detail pesanan"}</h2>{d && <span className={`rh-badge rh-status ${d.statusAkhir.toLowerCase()}`}>{judulStatusArsip[d.statusAkhir]}</span>}</div><button className="quick-close" aria-label="Tutup detail riwayat" onClick={tutup}><X size={19} /></button></header>
    <div className="quick-body">{detail.isPending ? <LoadingState text="Memuat arsip pesanan…" /> : detail.isError ? <ErrorState text="Arsip belum dapat dimuat atau pesanan belum ditutup." onRetry={() => void detail.refetch()} /> : d && <>
      <section className="quick-section"><h3>Pelanggan & Pesanan</h3><dl className="quick-meta"><div><dt>Nama pelanggan</dt><dd>{d.pelanggan}</dd></div><div className="rh-contact"><dt>Nomor telepon</dt><dd>{d.nomorTelepon}</dd></div><div><dt>Jenis</dt><dd>{d.jenis === "BOOKING" ? "Booking" : "Walk-in"}</dd></div><div><dt>Jadwal / Datang</dt><dd>{waktuWib(d.jadwal)}</dd></div><div><dt>Waktu penutupan</dt><dd>{d.penutupan ? waktuWib(d.penutupan) : "Belum tercatat"}</dd></div><div><dt>Status akhir</dt><dd>{judulStatusArsip[d.statusAkhir]}</dd></div>{["REJECTED", "NO_SHOW"].includes(d.statusBackend) && <div><dt>Keterangan status</dt><dd>{statusRamah(d.statusBackend)}</dd></div>}</dl>{d.alasan && <p className="quick-help">{d.alasan}</p>}</section>
      <section className="quick-section"><h3>Layanan & Barber</h3><p className="rh-barber">Barber: <strong>{d.barber ?? "Belum ditentukan"}</strong></p>{d.items.length ? d.items.map((i, index) => <div className="quick-item" key={index}><div>{i.namaLayanan}<small>{i.qty} × {rupiah(i.harga)}</small></div><strong>{rupiah(i.subtotal)}</strong></div>) : <p className="quick-help">Data layanan tidak tersedia.</p>}</section>
      <section className="quick-section"><h3>Ringkasan Pembayaran</h3><dl className="quick-money"><div><dt>Total tagihan</dt><dd>{rupiah(d.pembayaran.total)}</dd></div><div><dt>Pembayaran terverifikasi</dt><dd>{rupiah(d.pembayaran.jumlahDibayar)}</dd></div><div className="balance"><dt>Sisa tagihan</dt><dd>{rupiah(d.pembayaran.balance)}</dd></div></dl><span className={`rh-badge rh-payment ${d.pembayaran.statusPembayaran === "PAID" ? "paid" : "unpaid"}`}>{labelPembayaranArsip[d.pembayaran.statusPembayaran] ?? statusRamah(d.pembayaran.statusPembayaran)}</span><p className="quick-help">Status pelayanan dan pembayaran dicatat terpisah. Penanganan tagihan melalui Dashboard.</p></section>
      <section className="quick-section"><h3>Riwayat Status</h3>{d.riwayat.length ? <ol className="quick-timeline">{d.riwayat.map(h => <li key={h.id}><strong>{statusRamah(h.aksi)}</strong><p>{h.sebelum ? `${statusRamah(h.sebelum)} → ` : ""}{statusRamah(h.setelah)}</p><time dateTime={h.waktu}>{waktuWib(h.waktu)}</time></li>)}</ol> : <Empty text="Riwayat status belum tercatat." />}</section>
      <section className="quick-section"><h3>Dokumen</h3>{d.pembayaran.invoice ? <details className="rh-invoice"><summary><FileText size={16} />Lihat invoice resmi</summary><dl className="quick-meta"><div><dt>Nomor invoice</dt><dd>{d.pembayaran.invoice.nomorInvoice}</dd></div><div><dt>Diterbitkan</dt><dd>{waktuWib(d.pembayaran.invoice.dibuatPada)}</dd></div><div><dt>Total invoice</dt><dd>{rupiah(d.pembayaran.invoice.total)}</dd></div></dl></details> : <p className="quick-help">Invoice resmi belum tersedia.</p>}</section>
      {d.catatan && <section className="quick-section"><h3>Catatan pesanan</h3><p>{d.catatan}</p></section>}</>}
    </div><footer className="quick-footer"><Button variant="secondary" onClick={tutup}>Kembali ke Riwayat Pesanan</Button></footer>
  </div></>, document.body);
}
