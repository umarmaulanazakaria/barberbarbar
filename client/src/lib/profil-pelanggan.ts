export type ProfilPelanggan = { id: number; pelangganId: number; nama: string; nomorTelepon: string | null; email: string | null; catatan: string | null; dibuatPada: string; diarsipkanPada: string | null };
export type StatistikProfil = { jumlahKunjungan: number; kunjunganTerakhir: string | null; totalBelanja: number };
export type KandidatProfil = Pick<ProfilPelanggan, "id" | "nama" | "nomorTelepon" | "email" | "diarsipkanPada">;
export type DetailProfil = StatistikProfil & { profil: ProfilPelanggan & { riwayat: { id: number; penggunaId: number | null; aksi: string; dibuatPada: string; rincian: unknown }[] }; riwayatPesanan: { id: number; jenis: string; nomor: string; status: string; waktu: string; total: number; alasan?: string }[] };
