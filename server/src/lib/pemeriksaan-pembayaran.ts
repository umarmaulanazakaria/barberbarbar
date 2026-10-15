// Gabungkan pemeriksaan bersamaan dan batasi panggilan provider per transaksi.
// Otorisasi pemilik wajib dilakukan service sebelum memakai cache ini.
export function buatPemeriksaanPembayaran<T>(jedaMs = 5000, sekarang = Date.now) {
  const aktif = new Map<number, { sampai: number; proses: Promise<T> }>();
  return (id: number, periksa: () => Promise<T>): Promise<T> => {
    const waktu = sekarang();
    for (const [kunci, nilai] of aktif) if (nilai.sampai <= waktu) aktif.delete(kunci);
    const lama = aktif.get(id);
    if (lama) return lama.proses;
    if (aktif.size >= 10000) return Promise.reject(new Error('PEMERIKSAAN_PENUH'));
    const nilai = { sampai: Infinity, proses: Promise.resolve().then(periksa) };
    aktif.set(id, nilai);
    // Jeda dimulai setelah request selesai, termasuk timeout/kegagalan provider.
    void nilai.proses.then(() => { nilai.sampai = sekarang() + jedaMs; }, () => { nilai.sampai = sekarang() + jedaMs; });
    return nilai.proses;
  };
}
