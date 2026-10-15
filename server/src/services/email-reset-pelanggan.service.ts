import { createHash } from "node:crypto";
import { z } from "zod";
import basisData from "../lib/prisma.js";
import { buatTokenResetPelanggan } from "./reset-password-pelanggan.service.js";

export type PesanReset = { pengirim: string; penerima: string; subjek: string; teks: string; html: string };
// Adapter internal: tidak ada endpoint untuk mengganti transport. Pemilihan
// provider/instalasi dan pengiriman nyata masih memerlukan persetujuan pemilik.
export const gerbangEmailReset: { kirim: ((pesan: PesanReset, sinyal: AbortSignal) => Promise<void>) | null } = { kirim: null };
const konfigurasi = () => {
  const pengirim = process.env.EMAIL_RESET_FROM;
  if (!pengirim || !z.email().safeParse(pengirim).success) return null;
  try {
    const tautan = new URL(process.env.CUSTOMER_PASSWORD_RESET_URL ?? "");
    if (tautan.href !== "barberbarbar-customer://reset-password") return null;
    return { pengirim, tautan };
  } catch { return null; }
};
export const emailResetTersedia = () => Boolean(gerbangEmailReset.kirim && konfigurasi());
const escapeHtml = (nilai: string) => nilai.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export const susunEmailReset = (pengirim: string, penerima: string, tautan: string): PesanReset => ({
  pengirim, penerima, subjek: "Atur ulang kata sandi BARBER BARBAR",
  teks: `Kami menerima permintaan untuk mengatur ulang kata sandi akun BARBER BARBAR Anda.\n\nBuka tautan ini di aplikasi Customer: ${tautan}\n\nTautan berlaku 30 menit dan hanya dapat digunakan sekali. Jika Anda tidak meminta perubahan ini, abaikan email ini. Jangan bagikan tautan kepada siapa pun.\n\nTim BARBER BARBAR`,
  html: `<html lang="id"><body style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6"><h1>BARBER BARBAR</h1><h2>Atur ulang kata sandi</h2><p>Kami menerima permintaan pemulihan akun Anda.</p><p><a href="${escapeHtml(tautan)}">Buka aplikasi untuk mengatur kata sandi baru</a></p><p>Tautan berlaku <strong>30 menit</strong> dan hanya dapat digunakan sekali.</p><p>Jika Anda tidak meminta perubahan ini, abaikan email ini. Jangan bagikan tautan kepada siapa pun.</p><p>Tim BARBER BARBAR</p></body></html>`,
});

const aktif = new Set<Promise<void>>();
const terakhir = new Map<string, number>();
export const tungguEmailReset = async () => { await Promise.allSettled([...aktif]); };
export const ajukanEmailReset = (email: string) => {
  const config = konfigurasi(), kirim = gerbangEmailReset.kirim;
  if (!config || !kirim) return; // Tidak menerbitkan token yang tidak dapat dikirim.
  const penerima = email.trim().toLowerCase();
  const sidik = createHash("sha256").update(penerima).digest("hex"), sekarang = Date.now();
  for (const [id, batas] of terakhir) if (batas <= sekarang) terakhir.delete(id);
  // Batas global selain rate limit HTTP existing; identik untuk alamat ada/tidak.
  if (aktif.size >= 20 || terakhir.size >= 1000 || terakhir.has(sidik)) return;
  terakhir.set(sidik, sekarang + 60_000);
  const pekerjaan = Promise.resolve().then(async () => {
    const hasil = await buatTokenResetPelanggan(penerima);
    if (!hasil) return;
    try {
      const tautan = new URL(config.tautan);
      // Fragment tidak dikirim ke HTTP server dan tidak memuat password.
      tautan.hash = new URLSearchParams({ token: hasil.token }).toString();
      const kendali = new AbortController();
      const timer = setTimeout(() => kendali.abort(), 15_000);
      try {
        await Promise.race([
          kirim(susunEmailReset(config.pengirim, penerima, tautan.href), kendali.signal),
          new Promise<never>((_resolve, reject) => kendali.signal.addEventListener("abort", () => reject(new Error("EMAIL_TIMEOUT")), { once: true })),
        ]);
      } finally { clearTimeout(timer); }
    } catch {
      // Cabut hanya token pengiriman yang gagal, bukan token lain/akun aktif.
      await basisData.passwordResetToken.updateMany({ where: {
        tokenHash: createHash("sha256").update(hasil.token).digest("hex"), digunakanPada: null,
      }, data: { digunakanPada: new Date() } });
      console.warn("EMAIL_RESET_PENGIRIMAN_GAGAL");
    }
  }).catch(() => { console.warn("EMAIL_RESET_PEMROSESAN_GAGAL"); }).finally(() => { aktif.delete(pekerjaan); });
  aktif.add(pekerjaan);
};
