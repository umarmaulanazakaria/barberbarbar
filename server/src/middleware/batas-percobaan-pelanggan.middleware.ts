import type { Request, RequestHandler } from "express";
import { createHmac, randomBytes } from "node:crypto";

// Batas lokal per IP/socket. X-Forwarded-For tidak dipercaya secara otomatis.
export const batasiPercobaanPelanggan = (maksimum: number, kunci?: (req: Request) => string | undefined): RequestHandler => {
  const jendela = 15 * 60 * 1000;
  const percobaan = new Map<string, { jumlah: number; berakhir: number }>();
  return (permintaan, respon, lanjut) => {
    const sekarang = Date.now();
    for (const [alamat, nilai] of percobaan) {
      if (nilai.berakhir <= sekarang) percobaan.delete(alamat);
    }
    const alamat = kunci?.(permintaan) ?? permintaan.ip ?? permintaan.socket.remoteAddress ?? "tidak-diketahui";
    const nilai = percobaan.get(alamat) ?? { jumlah: 0, berakhir: sekarang + jendela };
    // Tolak juga ketika kapasitas penuh, agar memori selalu dibatasi.
    if (nilai.jumlah >= maksimum || (!percobaan.has(alamat) && percobaan.size >= 10000)) {
      respon.setHeader("Retry-After", Math.ceil((nilai.berakhir - sekarang) / 1000));
      respon.status(429).json({ pesan: "Terlalu banyak percobaan, coba lagi nanti" });
      return;
    }
    nilai.jumlah++;
    percobaan.set(alamat, nilai);
    lanjut();
  };
};

const garamMember = randomBytes(32);
export const batasiNomorMemberPublik = (maksimum: number): RequestHandler => {
  const batasiMember = batasiPercobaanPelanggan(maksimum, req =>
    createHmac("sha256", garamMember).update(String(req.body.nomorMember).trim().toUpperCase().slice(0, 64)).digest("hex"));
  return (req, res, next) => {
    // Request Reguler tetap dibatasi middleware IP pada route, bukan kuota Member.
    if (typeof req.body?.nomorMember !== "string" || !req.body.nomorMember.trim()) return next();
    return batasiMember(req, res, next);
  };
};
