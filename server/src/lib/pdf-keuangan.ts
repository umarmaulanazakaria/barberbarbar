import { logoPdf } from "./logo-pdf.js";
import type { DokumenKeuangan, StrukKeuangan } from "../services/dokumen-keuangan.service.js";
export type FormatPdf = "A4" | "58" | "80";
const uang = (v: number) => `Rp ${v.toLocaleString("id-ID")}`;
const tanggal = (v: string) => new Date(v).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB";
const status = { UNPAID: "BELUM DIBAYAR", DP_PAID: "DP DIBAYAR", PAID: "LUNAS", FREE: "LAYANAN GRATIS" };
const aman = (v: string) => v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "?").replace(/([\\()])/g, "\\$1");
const pecah = (v: string, batas: number) => {
  const hasil: string[] = []; let aktif = "";
  for (const kata of v.replace(/[\r\n\t]/g, " ").split(/\s+/)) {
    let k = kata;
    if (aktif.length + k.length + 1 > batas && aktif) { hasil.push(aktif); aktif = ""; }
    while (k.length > batas) { hasil.push(k.slice(0, batas)); k = k.slice(batas); }
    aktif += (aktif ? " " : "") + k;
  }
  if (aktif || !hasil.length) hasil.push(aktif); return hasil;
};
// Layout vektor bermerek, tabel dan pergantian halaman; sumber nominal tetap proyeksi ledger.
export function pdfKeuangan(d: DokumenKeuangan, s: StrukKeuangan | undefined, format: FormatPdf): Buffer {
  const thermal = format !== "A4", w = format === "58" ? 164.41 : format === "80" ? 226.77 : 595.28;
  const h = thermal ? 650 : 841.89, m = thermal ? 10 : 34, ukuran = format === "58" ? 7.3 : thermal ? 8.5 : 10;
  const navy = "0.055 0.094 0.17", ungu = "0.42 0.28 0.79", abu = "0.38 0.42 0.49";
  const halaman: string[] = []; let stream = "", y = 0;
  const rect = (x: number, top: number, lebar: number, tinggi: number, warna: string) => { stream += `${warna} rg ${x} ${h - top - tinggi} ${lebar} ${tinggi} re f\n`; };
  const teks = (v: string, x: number, top: number, size = ukuran, tebal = false, warna = navy) => { stream += `BT /${tebal ? "F2" : "F1"} ${size} Tf ${warna} rg 1 0 0 1 ${x} ${h - top - size} Tm (${aman(v)}) Tj ET\n`; };
  const garis = () => { rect(m, y, w - m * 2, 0.4, "0.84 0.86 0.90"); y += 9; };
  const kanan = (v: string, top: number, size = ukuran, tebal = false, warna = navy) => {
    // Angka Helvetica masing-masing 556/1000 em; penyesuaian Rp/spasi/titik.
    const lebar = [...aman(v)].reduce((n, c) => n + (/\d/.test(c) ? 556 : c === "R" ? 722 : c === "p" ? 556 : " .,".includes(c) ? 278 : 600), 0) * size / 1000;
    teks(v, w - m - lebar, top, size, tebal, warna);
  };
  const footer = () => { const top = h - 36; rect(m, top - 8, w - m * 2, 0.6, thermal ? abu : ungu); teks("BARBER BARBAR - Terima kasih atas kunjungan Anda.", m, top, thermal ? 5.7 : 8, false, abu); teks(`Dokumen resmi | Halaman ${halaman.length + 1}`, m, top + 12, thermal ? 5.7 : 8, false, abu); };
  const baru = () => {
    if (stream) { footer(); halaman.push(stream); stream = ""; }
    if (!thermal) {
      rect(0, 0, w, 92, navy); rect(0, 92, w, 4, ungu); rect(m, 15, 174, 58, "1 1 1");
      stream += `q 168 0 0 56 ${m + 3} ${h - 72} cm /Logo Do Q\n`;
      teks(s ? "BUKTI PEMBAYARAN" : d.final ? "INVOICE" : "TAGIHAN", 330, 29, 17, true, "1 1 1");
      teks("Not Cutting Heads, Just Hair", 330, 54, 8, false, "0.8 0.8 0.95"); teks(s?.nomor ?? d.nomor, 330, 72, 7, false, "1 1 1"); y = 112;
    } else {
      const lebar = Math.min(145, w - m * 2), tinggi = lebar / 3;
      stream += `q ${lebar} 0 0 ${tinggi} ${(w - lebar) / 2} ${h - m - tinggi} cm /Logo Do Q\n`;
      y = m + tinggi + 5; teks("Not Cutting Heads, Just Hair", m, y, ukuran - 1); y += 18; garis();
    }
  };
  const ruang = (tinggi: number) => { if (y + tinggi > h - 55) baru(); };
  const paragraf = (v: string, tebal = false, size = ukuran, warna = navy) => {
    for (const baris of pecah(v, Math.max(12, Math.floor((w - m * 2) / (size * 0.62))))) { ruang(size + 6); teks(baris, m, y, size, tebal, warna); y += size + 5; }
    y += 3;
  };
  const baris = (label: string, nilai: string, tebal = false) => {
    const cadangan = thermal ? 66 : 145;
    const labels = pecah(label, Math.max(8, Math.floor((w - m * 2 - cadangan) / (ukuran * 0.62))));
    ruang(labels.length * (ukuran + 5) + 5);
    labels.forEach((l, i) => teks(l, m, y + i * (ukuran + 5), ukuran, tebal)); kanan(nilai, y, ukuran, tebal); y += labels.length * (ukuran + 5) + 5;
  };
  baru();
  paragraf(s?.tujuan.toUpperCase() ?? (d.final ? "INVOICE TRANSAKSI" : "RINCIAN TAGIHAN - BELUM FINAL"), true, ukuran + 2, thermal ? navy : ungu);
  paragraf(s?.nomor ?? d.nomor, true);
  paragraf(`Tanggal: ${tanggal(s?.tanggal ?? d.tanggal)}`);
  paragraf(`Pelanggan: ${d.pelanggan}`);
  paragraf(`Sumber: ${d.sumber === "WALK_IN" ? "Walk-in" : d.sumber} / ${d.referensi}`);
  paragraf(s?.tujuan === "Bukti pembayaran DP" ? "BUKTI DP - BUKAN INVOICE LUNAS" : status[d.status], true, ukuran, thermal ? navy : ungu);
  if (d.refund > 0) paragraf(`REFUND TERVERIFIKASI: ${uang(d.refund)}`, true);
  garis(); paragraf("RINCIAN LAYANAN / PAKET", true);
  for (const i of d.items) { baris(`${i.nama} x${i.qty}`, uang(i.nominal)); paragraf(`Tarif reguler @${uang(i.hargaReguler)}`, false, ukuran - 1, abu); }
  garis(); baris("Subtotal reguler", uang(d.subtotal));
  if (d.diskon > 0) baris("Manfaat Member / diskon", `-${uang(d.diskon)}`);
  baris("Total tagihan", uang(d.total), true);
  if (s) {
    paragraf(`Metode: ${s.metode === "CASH" ? "Tunai" : s.metode === "TRANSFER" ? "Transfer Manual" : s.metode === "QRIS" ? "QRIS Midtrans" : s.metode}`);
    ruang(36);
    if (!thermal) rect(m, y - 3, w - m * 2, 30, navy);
    teks("PEMBAYARAN INI", m + (thermal ? 0 : 10), y + 3, ukuran, true, thermal ? navy : "1 1 1");
    kanan(uang(s.nominal), y + 3, ukuran + (thermal ? 1 : 3), true, thermal ? navy : "1 1 1"); y += 40;
    if (s.diterima !== null) { baris("Diterima", uang(s.diterima)); baris("Kembalian", uang(s.kembalian)); }
    if (s.periode) paragraf(`Periode Membership: ${s.periode}`);
  }
  baris("Dibayar bersih", uang(d.dibayar)); baris("Refund terverifikasi", uang(d.refund)); baris("Sisa tagihan terkini", uang(d.balance), true);
  if (!s) {
    garis(); paragraf("HISTORI PEMBAYARAN TERVERIFIKASI", true);
    if (!d.struk.length) paragraf(d.status === "FREE" ? "Manfaat Member Rp0, bukan uang masuk." : "Belum ada penerimaan terverifikasi.");
    for (const t of d.struk) { baris(t.tujuan, uang(t.nominal), true); paragraf(`${t.nomor} / ${t.metode} / ${tanggal(t.tanggal)}`, false, ukuran - 1, abu); }
  } else paragraf("Rincian dan sisa tagihan adalah posisi terkini. Nominal bukti pembayaran ini tetap.", false, ukuran - 1, abu);
  if (d.catatan) paragraf(d.catatan, false, ukuran - 1, abu);
  if (d.status === "FREE") paragraf("LAYANAN GRATIS - bukan penerimaan uang.", true);
  footer(); halaman.push(stream);
  const logo = logoPdf(), objek: Buffer[] = [];
  const tambah = (v: string | Buffer) => objek.push(typeof v === "string" ? Buffer.from(v, "ascii") : v);
  tambah("<< /Type /Catalog /Pages 2 0 R >>");
  tambah(`<< /Type /Pages /Count ${halaman.length} /Kids [${halaman.map((_, i) => `${6 + i * 2} 0 R`).join(" ")}] >>`);
  tambah("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  tambah("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  tambah(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${logo.lebar} /Height ${logo.tinggi} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${logo.data.length} >>\nstream\n`, "ascii"), logo.data, Buffer.from("\nendstream", "ascii")]));
  for (const [i, konten] of halaman.entries()) {
    tambah(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Logo 5 0 R >> >> /Contents ${7 + i * 2} 0 R >>`);
    tambah(`<< /Length ${Buffer.byteLength(konten, "ascii")} >>\nstream\n${konten}\nendstream`);
  }
  const bagian: Buffer[] = [Buffer.from("%PDF-1.4\n", "ascii")], offset: number[] = []; let posisi = bagian[0]!.length;
  for (const [i, o] of objek.entries()) { offset.push(posisi); const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, "ascii"), o, Buffer.from("\nendobj\n", "ascii")]); bagian.push(b); posisi += b.length; }
  bagian.push(Buffer.from(`xref\n0 ${objek.length + 1}\n0000000000 65535 f \n${offset.map(v => `${String(v).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objek.length + 1} /Root 1 0 R >>\nstartxref\n${posisi}\n%%EOF\n`, "ascii"));
  return Buffer.concat(bagian);
}
