import { readFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";
let cache: { lebar: number; tinggi: number; data: Buffer } | undefined;
// Aset PNG RGBA 8-bit existing. Alpha dikomposit ke putih agar logo tetap terbaca saat dicetak.
export function logoPdf() {
  if (cache) return cache;
  const png = readFileSync(new URL("../../../client/public/barber-barbar-logo.png", import.meta.url));
  if (png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || png[24] !== 8 || png[25] !== 6 || png[28] !== 0) throw Error("Format aset logo tidak didukung.");
  const lebar = png.readUInt32BE(16), tinggi = png.readUInt32BE(20), idat: Buffer[] = [];
  if (lebar > 2000 || tinggi > 2000) throw Error("Dimensi aset logo tidak valid.");
  for (let posisi = 8; posisi + 12 <= png.length;) {
    const panjang = png.readUInt32BE(posisi), jenis = png.toString("ascii", posisi + 4, posisi + 8);
    if (jenis === "IDAT") idat.push(png.subarray(posisi + 8, posisi + 8 + panjang));
    posisi += panjang + 12;
  }
  const mentah = inflateSync(Buffer.concat(idat)), stride = lebar * 4, rgba = Buffer.alloc(stride * tinggi), rgb = Buffer.alloc(lebar * tinggi * 3);
  if (mentah.length !== (stride + 1) * tinggi) throw Error("Aset logo rusak.");
  const paeth = (a: number, b: number, c: number) => { const p = a + b - c, x = Math.abs(p - a), y = Math.abs(p - b), z = Math.abs(p - c); return x <= y && x <= z ? a : y <= z ? b : c; };
  for (let y = 0; y < tinggi; y++) {
    const filter = mentah[y * (stride + 1)]!;
    if (filter > 4) throw Error("Filter aset logo tidak valid.");
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, a = x >= 4 ? rgba[i - 4]! : 0, b = y ? rgba[i - stride]! : 0, c = y && x >= 4 ? rgba[i - stride - 4]! : 0;
      const prediksi = filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : filter === 4 ? paeth(a, b, c) : 0;
      rgba[i] = (mentah[y * (stride + 1) + 1 + x]! + prediksi) & 255;
    }
  }
  for (let i = 0; i < lebar * tinggi; i++) { const a = rgba[i * 4 + 3]! / 255; for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.round(rgba[i * 4 + c]! * a + 255 * (1 - a)); }
  cache = { lebar, tinggi, data: deflateSync(rgb) }; return cache;
}
