import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import DrawerKatalog from "./DrawerKatalog";
import { Button, ErrorState, LoadingState } from "./ui";
import { api, pesanError } from "../lib/api";
import { rupiah } from "../lib/format";
import { waktuWib } from "../lib/pesanan-terpadu";
import { statusDokumen, sumberDokumen, metodeDokumen, unduhDokumen, type Dokumen, type Struk } from "../lib/dokumen-keuangan";
import "./Keuangan.css";

export default function DetailDokumenKeuangan({ id, strukId, otomatis = false, kunciCetak, onClose }: { id: string; strukId?: string; otomatis?: boolean; kunciCetak?: string; onClose: () => void }) {
  const data = useQuery({ queryKey: ["dokumen", id], queryFn: async () => (await api.get<Dokumen>(`/management/finance/documents/${id}`)).data });
  const [pilihan, aturPilihan] = useState(strukId ?? ""), [galat, aturGalat] = useState("");
  const iframe = useRef<HTMLIFrameElement>(null), dicoba = useRef(false);
  const d = data.data, s = d?.struk.find(t => t.id === pilihan);
  const cetak = () => { try { iframe.current?.contentWindow?.focus(); iframe.current?.contentWindow?.print(); } catch { aturGalat("Dialog cetak tidak dibuka. Gunakan Cetak Struk atau Unduh PDF."); } };
  const setelahMuat = () => {
    if (!otomatis || !s || dicoba.current || !kunciCetak) return;
    dicoba.current = true;
    // Penanda ditulis sebelum memanggil print. Tidak diulang ketika dialog diblokir/dibatalkan.
    const jalankan = () => { try { const k = `${kunciCetak}:${s.id}`; if (localStorage.getItem(k)) return; localStorage.setItem(k, "1"); cetak(); } catch { aturGalat("Penyimpanan browser tidak tersedia; cetak manual agar dialog tidak berulang."); } };
    if (navigator.locks) void navigator.locks.request(`${kunciCetak}:${s.id}`, jalankan); else jalankan();
  };
  return <div className="keuangan-detail"><DrawerKatalog open utama title={s?.tujuan ?? "Detail Invoice"} onClose={onClose}>
    {data.isPending ? <LoadingState text="Memuat dokumen resmi..."/> : data.isError ? <ErrorState text="Dokumen belum dapat dimuat." onRetry={() => void data.refetch()}/> : d && <>
      <p className="keuangan-keterangan">{d.final ? "Dokumen transaksi resmi" : "Tagihan berjalan; invoice final belum diterbitkan."}</p>
      {d.catatan && <p className="cp-warning">{d.catatan}</p>}
      <div className="keuangan-dokumen"><h3>BARBER BARBAR</h3><strong>{s?.nomor ?? d.nomor}</strong><p>{s?.tujuan ?? statusDokumen[d.status]}</p><dl><dt>Pelanggan</dt><dd>{d.pelanggan}</dd><dt>Sumber</dt><dd>{sumberDokumen(d.sumber)} · {d.referensi}</dd><dt>Waktu · WIB</dt><dd>{waktuWib(s?.tanggal ?? d.tanggal)}</dd><dt>Status transaksi</dt><dd>{d.keadaan}</dd></dl>
      {s ? <><p>{metodeDokumen(s.metode)}</p><h2>{rupiah(s.nominal)}</h2><p>Nominal pembayaran ini</p>{s.diterima !== null && <p>Diterima {rupiah(s.diterima)} · Kembalian {rupiah(s.kembalian)}</p>}{s.periode && <p>Periode {s.periode}</p>}{s.tujuan === "Bukti pembayaran DP" && <p>Bukti DP ini bukan invoice lunas.</p>}</> : <><ul>{d.items.map((i, n) => <li key={n}>{i.nama} ×{i.qty}<b>{rupiah(i.nominal)}</b></li>)}</ul><dl><dt>Total tagihan</dt><dd>{rupiah(d.total)}</dd><dt>Dibayar bersih</dt><dd>{rupiah(d.dibayar)}</dd><dt>Refund terverifikasi</dt><dd>{rupiah(d.refund)}</dd><dt>Sisa tagihan</dt><dd>{rupiah(d.balance)}</dd></dl><strong>{statusDokumen[d.status]}</strong>{d.status === "FREE" && <p>Manfaat Member Rp0, bukan uang masuk.</p>}</>}
      </div><div className="keuangan-tombol"><Button onClick={cetak}>{s ? "Cetak Struk" : "Cetak Dokumen"}</Button><Button variant="secondary" onClick={() => void unduhDokumen(d, s).catch(e => aturGalat(pesanError(e)))}>Unduh PDF</Button></div>
      <p className="keuangan-keterangan">Jika dialog otomatis diblokir browser, gunakan tombol cetak manual. Struk tetap tersedia di sini.</p>{galat && <p role="alert">{galat}</p>}
      <h4>Dokumen & bukti pembayaran</h4><Button variant="secondary" onClick={() => aturPilihan("")}>{d.final ? "Invoice" : "Rincian tagihan"}</Button>{d.struk.map(t => <button className="keuangan-struk" key={t.id} onClick={() => aturPilihan(t.id)}><strong>{t.tujuan} · {rupiah(t.nominal)}</strong><span>{t.nomor} · {metodeDokumen(t.metode)} · {waktuWib(t.tanggal)}</span></button>)}
    </>}
  </DrawerKatalog>{d && createPortal(<iframe ref={iframe} title="Dokumen cetak resmi" className="keuangan-print-frame" srcDoc={htmlCetak(d, s)} onLoad={setelahMuat}/>, document.body)}</div>;
}
const aman = (v: string) => v.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
function htmlCetak(d: Dokumen, s?: Struk) {
  const baris = s ? [s.tujuan, s.nomor, d.pelanggan, d.referensi, waktuWib(s.tanggal), metodeDokumen(s.metode), `Pembayaran ini: ${rupiah(s.nominal)}`,
    ...(s.diterima === null ? [] : [`Diterima: ${rupiah(s.diterima)}`, `Kembalian: ${rupiah(s.kembalian)}`]), s.periode ?? "", s.tujuan === "Bukti pembayaran DP" ? "Bukti DP bukan invoice lunas." : "Pembayaran terverifikasi."] :
    [d.final ? "INVOICE" : "TAGIHAN BELUM FINAL", d.nomor, d.pelanggan, d.referensi, waktuWib(d.tanggal), ...d.items.map(i => `${i.nama} x${i.qty} ${rupiah(i.nominal)}`), `Total: ${rupiah(d.total)}`, `Dibayar bersih: ${rupiah(d.dibayar)}`, `Refund: ${rupiah(d.refund)}`, `Sisa: ${rupiah(d.balance)}`, statusDokumen[d.status], ...d.struk.map(t => `${t.nomor} ${metodeDokumen(t.metode)} ${rupiah(t.nominal)}`)];
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${aman(s?.nomor ?? d.nomor)}</title><style>@page{margin:5mm}body{font:12px Arial;color:#111;margin:0 auto;max-width:72mm;overflow-wrap:anywhere}h2{text-align:center;font-size:16px}p{margin:7px 0}footer{border-top:1px dashed;margin-top:12px;padding-top:10px;text-align:center}</style></head><body><h2>BARBER BARBAR</h2>${[...baris, ...(d.catatan ? [d.catatan] : [])].map(b => `<p>${aman(b)}</p>`).join("")}<footer>Terima kasih atas kunjungan Anda.</footer></body></html>`;
}
