export type DataKartuMember = { nomorMember: string; nama: string; berlakuSampai: string };
export type SumberKartuMember = { nomorMember: string | null; nama: string; berlakuSampai: string | null; status: string; bolehCetakKartu: boolean };
export const ukuranKartuMember = { lebar: 85.6, tinggi: 53.98 } as const;
const aman = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function dataKartuMember(m: SumberKartuMember): DataKartuMember {
  if (m.status !== "AKTIF" || !m.bolehCetakKartu || !m.nomorMember || !m.berlakuSampai || !Number.isFinite(Date.parse(m.berlakuSampai))) throw Error("Kartu hanya tersedia untuk Membership aktif dengan pembayaran terverifikasi. Perbarui status Member terlebih dahulu.");
  return { nomorMember: m.nomorMember, nama: m.nama, berlakuSampai: m.berlakuSampai };
}
let logoTersimpan: Promise<string> | undefined;
function logoKartu() {
  return logoTersimpan ??= fetch("/barber-barbar-logo.png", { credentials: "omit", cache: "force-cache" }).then(async r => {
    if (!r.ok) throw Error("Logo kartu belum dapat dimuat.");
    const blob = await r.blob();
    if (blob.type !== "image/png") throw Error("Aset logo kartu tidak valid.");
    return new Promise<string>((resolve, reject) => { const baca = new FileReader(); baca.onload = () => resolve(String(baca.result)); baca.onerror = () => reject(Error("Logo kartu belum dapat dibaca.")); baca.readAsDataURL(blob); });
  }).catch(e => { logoTersimpan = undefined; throw e; });
}
// Satu sumber tampilan untuk preview, cetak, dan PDF; tidak memuat HP atau transaksi.
export async function gambarKartuMember(data: DataKartuMember): Promise<string> {
  const logo = await logoKartu(), nama = data.nama.trim(), pisah = nama.length > 34 ? nama.lastIndexOf(" ", 34) : -1;
  const baris = nama.length > 34 ? [nama.slice(0, pisah > 0 ? pisah : 34), nama.slice(pisah > 0 ? pisah + 1 : 34)] : [nama];
  const teks = (isi: string, x: number, y: number, ukuran: number, lebar = 760) => `<text x="${x}" y="${y}" font-size="${ukuran}" font-weight="700" ${Array.from(isi).length * ukuran * 0.62 > lebar ? `textLength="${lebar}" lengthAdjust="spacingAndGlyphs"` : ""}>${aman(isi)}</text>`;
  const sampai = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "long", year: "numeric" }).format(new Date(data.berlakuSampai));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="85.6mm" height="53.98mm" viewBox="0 0 856 539.8" role="img" aria-label="Kartu Membership BARBER BARBAR">
    <defs><clipPath id="batas"><rect width="856" height="539.8" rx="22"/></clipPath></defs>
    <g clip-path="url(#batas)" font-family="Arial, sans-serif" fill="#ffffff">
      <rect width="856" height="539.8" fill="#101b30"/><path d="M650 0H856V539.8H760L535 0Z" fill="#352453"/>
      <path d="M715 0H760L856 220V330Z" fill="#8b5cce" opacity=".5"/><circle cx="813" cy="90" r="160" fill="none" stroke="#a57de0" stroke-width="2" opacity=".25"/>
      <rect x="46" y="38" width="263" height="84" rx="9" fill="#ffffff"/>
      <image href="${logo}" x="54" y="46" width="247" height="68" preserveAspectRatio="xMidYMid meet"/>
      <text x="808" y="75" text-anchor="end" font-size="22" font-weight="700" letter-spacing="2.4" fill="#d4bafa">MEMBERSHIP CARD</text>
      <rect x="48" y="163" width="62" height="5" rx="2" fill="#ac7de5"/>
      <text x="48" y="200" font-size="17" letter-spacing="3" fill="#c0addb">NOMOR MEMBER</text>
      ${teks(data.nomorMember, 48, 249, 44)}
      ${baris.map((n, i) => teks(n, 48, 321 + i * 37, 31)).join("")}
      <path d="M48 390H808" stroke="#76618f" stroke-width="1"/>
      <text x="48" y="425" font-size="16" letter-spacing="2" fill="#c0addb">BERLAKU HINGGA</text>
      ${teks(sampai, 48, 462, 26, 470)}
      <rect x="602" y="422" width="206" height="47" rx="23" fill="#a67bde"/>
      <text x="705" y="453" text-anchor="middle" font-size="18" font-weight="700" fill="#101b30" letter-spacing="1">MEMBER AKTIF</text>
      <text x="48" y="508" font-size="13" letter-spacing="1.4" fill="#c0c8d8">BARBER BARBAR · NOT CUTTING HEADS, JUST HAIR.</text>
    </g></svg>`;
}
export const sumberGambarKartu = (svg: string) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
export function dokumenCetakKartu(svg: string, nomor: string) {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Kartu Member ${aman(nomor)}</title><style>
    @page{size:85.6mm 53.98mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;width:85.6mm;height:53.98mm;background:#ffffff}img{display:block;width:85.6mm;height:53.98mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    </style></head><body><img alt="Kartu Member BARBER BARBAR" src="${aman(sumberGambarKartu(svg))}"></body></html>`;
}
// PDF biner satu halaman ID-1, tanpa ketergantungan baru. Gambar lossless 600 dpi
// menjaga nama Unicode dan logo sama dengan preview/cetak pada ukuran fisik kartu.
export async function pdfKartuMember(svg: string): Promise<Blob> {
  const img = new Image(); img.src = sumberGambarKartu(svg); await img.decode();
  const kanvas = document.createElement("canvas"), dpi = 600;
  kanvas.width = Math.round(ukuranKartuMember.lebar / 25.4 * dpi); kanvas.height = Math.round(ukuranKartuMember.tinggi / 25.4 * dpi);
  const konteks = kanvas.getContext("2d"); if (!konteks) throw Error("Pembuatan PDF tidak didukung browser ini.");
  konteks.fillStyle = "#ffffff"; konteks.fillRect(0, 0, kanvas.width, kanvas.height); konteks.drawImage(img, 0, 0, kanvas.width, kanvas.height);
  const rgba = konteks.getImageData(0, 0, kanvas.width, kanvas.height).data, rgb = new Uint8Array(kanvas.width * kanvas.height * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4) { rgb[j++] = rgba[i]!; rgb[j++] = rgba[i + 1]!; rgb[j++] = rgba[i + 2]!; }
  if (typeof CompressionStream === "undefined") throw Error("Unduh PDF memerlukan browser terbaru. Gunakan Cetak Kartu Member pada browser ini.");
  const kompresi = new Blob([rgb.buffer]).stream().pipeThrough(new CompressionStream("deflate"));
  const gambar = new Uint8Array(await new Response(kompresi).arrayBuffer()), encoder = new TextEncoder(), potongan: Uint8Array<ArrayBuffer>[] = [], offset = [0]; let panjang = 0;
  const tulis = (s: string | Uint8Array<ArrayBuffer>) => { const b = typeof s === "string" ? encoder.encode(s) : s; potongan.push(b); panjang += b.byteLength; };
  const objek = (id: number, isi: string) => { offset[id] = panjang; tulis(`${id} 0 obj\n${isi}\nendobj\n`); };
  const lebar = (85.6 * 72 / 25.4).toFixed(6), tinggi = (53.98 * 72 / 25.4).toFixed(6);
  tulis("%PDF-1.4\n"); objek(1, "<< /Type /Catalog /Pages 2 0 R >>"); objek(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objek(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${lebar} ${tinggi}] /Resources << /XObject << /Kartu 4 0 R >> >> /Contents 5 0 R >>`);
  offset[4] = panjang; tulis(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${kanvas.width} /Height ${kanvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${gambar.byteLength} >>\nstream\n`); tulis(gambar); tulis("\nendstream\nendobj\n");
  const perintah = `q\n${lebar} 0 0 ${tinggi} 0 0 cm\n/Kartu Do\nQ\n`;
  objek(5, `<< /Length ${encoder.encode(perintah).byteLength} >>\nstream\n${perintah}endstream`);
  const xref = panjang; tulis("xref\n0 6\n0000000000 65535 f \n"); for (let i = 1; i <= 5; i++) tulis(`${String(offset[i]).padStart(10, "0")} 00000 n \n`);
  tulis(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(potongan.map(b => b.buffer), { type: "application/pdf" });
}
