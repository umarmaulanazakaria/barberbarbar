import type { RequestHandler } from "express";

// Batas lokal per IP/socket. X-Forwarded-For tidak dipercaya secara otomatis.
export const batasiPercobaanPelanggan = (maksimum: number): RequestHandler => {
  const jendela = 15 * 60 * 1000;
  const percobaan = new Map<string, { jumlah: number; berakhir: number }>();
  return (permintaan, respon, lanjut) => {
    const sekarang = Date.now();
    for (const [alamat, nilai] of percobaan) {
      if (nilai.berakhir <= sekarang) percobaan.delete(alamat);
    }
    const alamat = permintaan.ip ?? permintaan.socket.remoteAddress ?? "tidak-diketahui";
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
