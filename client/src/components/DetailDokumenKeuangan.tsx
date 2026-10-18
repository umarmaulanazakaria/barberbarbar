import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import DrawerKatalog from "./DrawerKatalog";
import { Button, ErrorState, LoadingState, Select } from "./ui";
import { api, pesanError } from "../lib/api";
import { rupiah } from "../lib/format";
import { waktuWib } from "../lib/pesanan-terpadu";
import { metodeDokumen, unduhDokumen, type Dokumen, type FormatDokumen } from "../lib/dokumen-keuangan";
import "./Keuangan.css";
import { gayaDokumen, isiDokumen, htmlCetakDokumen } from "../lib/tampilan-dokumen-keuangan";

export default function DetailDokumenKeuangan({ id, strukId, strukTanggal, otomatis = false, kunciCetak, onClose }: { id: string; strukId?: string; strukTanggal?: string; otomatis?: boolean; kunciCetak?: string; onClose: () => void }) {
  const data = useQuery({ queryKey: ["dokumen", id], queryFn: async () => (await api.get<Dokumen>(`/management/finance/documents/${id}`)).data });
  const [pilihan, aturPilihan] = useState(strukId ?? ""), [galat, aturGalat] = useState("");
  const [format, aturFormat] = useState<FormatDokumen>(strukId ? "80" : "A4");
  const iframe = useRef<HTMLIFrameElement>(null), dicoba = useRef(false);
  const d = data.data, s = d?.struk.find(t => t.id === pilihan);
  const cetak = () => { try { iframe.current?.contentWindow?.focus(); iframe.current?.contentWindow?.print(); } catch { aturGalat("Dialog cetak tidak dibuka. Gunakan Cetak Struk atau Unduh PDF."); } };
  const setelahMuat = () => {
    if (!otomatis || !s || dicoba.current || !kunciCetak || strukTanggal && s.tanggal !== strukTanggal) return;
    dicoba.current = true;
    // Penanda ditulis sebelum memanggil print. Tidak diulang ketika dialog diblokir/dibatalkan.
    const jalankan = () => { try { const k = `${kunciCetak}:${s.id}@${s.tanggal}`; if (localStorage.getItem(k)) return; localStorage.setItem(k, "1"); cetak(); } catch { aturGalat("Penyimpanan browser tidak tersedia; cetak manual agar dialog tidak berulang."); } };
    if (navigator.locks) void navigator.locks.request(`${kunciCetak}:${s.id}@${s.tanggal}`, jalankan); else jalankan();
  };
  return <div className="keuangan-detail"><DrawerKatalog open utama title={s?.tujuan ?? "Detail Invoice"} onClose={onClose}>
    {data.isPending ? <LoadingState text="Memuat dokumen resmi..."/> : data.isError ? <ErrorState text="Dokumen belum dapat dimuat." onRetry={() => void data.refetch()}/> : d && <>
      <p className="keuangan-keterangan">{d.final ? "Dokumen transaksi resmi" : "Tagihan berjalan; invoice final belum diterbitkan."}</p>
      {d.catatan && <p className="cp-warning">{d.catatan}</p>}
      <label className="keuangan-format">Ukuran dokumen<Select aria-label="Ukuran kertas invoice atau struk" value={format} onChange={e => aturFormat(e.target.value as FormatDokumen)}><option value="A4">Invoice A4</option><option value="80">Struk thermal 80 mm</option><option value="58">Struk thermal 58 mm</option></Select></label>
      <style>{gayaDokumen}</style><div className="keuangan-preview" dangerouslySetInnerHTML={{ __html: isiDokumen(d, s, format) }}/>
      <div className="keuangan-tombol"><Button onClick={cetak}>{s ? "Cetak Ulang Struk" : "Cetak Dokumen"}</Button><Button variant="secondary" onClick={() => void unduhDokumen(d, s, format).catch(e => aturGalat(pesanError(e)))}>Unduh PDF</Button></div>
      <p className="keuangan-keterangan">Jika dialog otomatis diblokir browser, gunakan tombol cetak manual. Struk tetap tersedia di sini.</p>{galat && <p role="alert">{galat}</p>}
      <h4>Dokumen & bukti pembayaran</h4><Button variant="secondary" onClick={() => { aturPilihan(""); aturFormat("A4"); }}>{d.final ? "Invoice" : "Rincian tagihan"}</Button>{d.struk.map(t => <button className="keuangan-struk" key={t.id} onClick={() => { aturPilihan(t.id); aturFormat("80"); }}><strong>{t.tujuan} · {rupiah(t.nominal)}</strong><span>{t.nomor} · {metodeDokumen(t.metode)} · {waktuWib(t.tanggal)}</span></button>)}
    </>}
  </DrawerKatalog>{d && createPortal(<iframe ref={iframe} title="Dokumen cetak resmi" className="keuangan-print-frame" srcDoc={htmlCetakDokumen(d, s, format)} onLoad={setelahMuat}/>, document.body)}</div>;
}
