import { createHash } from "node:crypto";
import basisData from "../lib/prisma.js";
import { kunciJadwalBooking } from "../lib/transaksi-booking.js";
import { KesalahanProfil, simpanProfilDalamTransaksi } from "./profil-pelanggan.service.js";
import { buatPesananDalamTransaksi } from "./pesanan.service.js";
import { type DataWalkIn } from "../schemas/walkin-dashboard.schema.js";

export class KesalahanWalkIn extends Error {
  constructor(public status: number, public kode: string, pesan: string) { super(pesan); }
}
const pilihanHasil = { id: true, nomorPesanan: true, status: true, statusPembayaran: true, total: true } as const;
const pesanGagal: Record<string, string> = {
  PELANGGAN_TIDAK_DITEMUKAN: "Pelanggan tidak ditemukan. Pilih kembali pelanggan.",
  PELANGGAN_DIBLOKIR: "Pelanggan diblokir dan tidak dapat membuat pesanan.",
  IDENTITAS_MEMBER_WAJIB: "Konfirmasi pencocokan nama dan nomor HP member yang hadir sebelum membuat pesanan.",
  PROFIL_DIARSIPKAN: "Profil diarsipkan. Minta Admin memulihkannya sebelum membuat pesanan.",
  HP_PROFIL_WAJIB: "Nomor HP profil wajib dilengkapi oleh Admin.",
  PROFIL_TIDAK_SESUAI: "Profil tidak sesuai. Pilih kembali pelanggan.",
  BARBER_TIDAK_DITEMUKAN: "Barber tidak ditemukan. Pilih kembali barber.",
  BARBER_TIDAK_AKTIF: "Barber sudah tidak aktif. Pilih barber lain atau tentukan nanti.",
  BARBER_SIBUK: "Barber sedang melayani. Pilih barber lain atau tentukan nanti.",
  LAYANAN_TIDAK_DITEMUKAN: "Layanan tidak ditemukan. Periksa kembali pilihan layanan.",
  LAYANAN_TIDAK_AKTIF: "Ada layanan yang sudah tidak aktif. Periksa kembali pilihan layanan.",
  HARGA_BERUBAH: "Harga atau diskon telah berubah. Periksa total terbaru sebelum mengirim kembali.",
  JADWAL_TIDAK_TERSEDIA: "Kapasitas sedang direservasi booking. Periksa kembali penugasan atau waktu kunjungan.",
};
export const simpanWalkInDashboard = async (data: DataWalkIn, penggunaId: number) => {
  const { kunciIdempotensi, ...isi } = data;
  const normal = { ...isi, pelanggan: isi.pelanggan.jenis === "BARU" ? { ...isi.pelanggan, nomorTelepon: isi.pelanggan.nomorTelepon || null } : isi.pelanggan,
    items: [...isi.items].sort((a, b) => a.layananId - b.layananId) };
  const sidik = createHash("sha256").update(JSON.stringify(normal)).digest("hex");
  return basisData.$transaction(async tx => {
    // Kunci yang sama dengan lifecycle resmi; replay menunggu transaksi sebelumnya selesai.
    await kunciJadwalBooking(tx);
    const lama = await tx.permintaanWalkIn.findUnique({ where: { penggunaId_kunci: { penggunaId, kunci: kunciIdempotensi } }, include: { pesanan: { select: pilihanHasil } } });
    if (lama) {
      if (lama.sidikPermintaan !== sidik) throw new KesalahanWalkIn(409, "IDEMPOTENSI_BERBEDA", "Kunci ini sudah dipakai untuk data berbeda. Periksa status permintaan sebelumnya.");
      return { diulang: true, data: lama.pesanan };
    }
    let pelangganId: number | null = null, profilPelangganId: number | null = null;
    const operator = await tx.pengguna.findUniqueOrThrow({ where: { id: penggunaId }, select: { role: true } });
    if (data.pelanggan.jenis === "LAMA") {
      let profil = await tx.profilPelanggan.findUnique({ where: { id: data.pelanggan.id } });
      if (!profil || profil.diarsipkanPada) throw new KesalahanProfil(409, "Pilih profil aktif. Pemulihan hanya dapat dilakukan Admin.");
      if (!profil.nomorTelepon) {
        if (operator.role !== "ADMIN") throw new KesalahanProfil(403, "Minta Admin melengkapi nomor HP profil sebelum membuat Walk-in.");
        if (!data.pelanggan.nomorTelepon) throw new KesalahanProfil(400, "Nomor HP profil wajib dilengkapi.");
        profil = await simpanProfilDalamTransaksi(tx, { nama: profil.nama, nomorTelepon: data.pelanggan.nomorTelepon, email: profil.email, catatan: profil.catatan, konfirmasiDuplikat: data.pelanggan.konfirmasiDuplikat }, penggunaId, profil.id);
      }
      pelangganId = profil.pelangganId; profilPelangganId = profil.id;
    } else if (data.pelanggan.jenis === "BARU") {
      if (operator.role !== "ADMIN") throw new KesalahanProfil(403, "Hanya Admin yang dapat membuat profil pelanggan.");
      const profil = await simpanProfilDalamTransaksi(tx, { nama: data.pelanggan.nama, nomorTelepon: data.pelanggan.nomorTelepon, email: null, catatan: null, konfirmasiDuplikat: data.pelanggan.konfirmasiDuplikat }, penggunaId);
      pelangganId = profil.pelangganId; profilPelangganId = profil.id;
    }
    const hasil = await buatPesananDalamTransaksi(tx, { pelangganId, profilPelangganId, konfirmasiMember: data.konfirmasiMember===true, barberId: data.barberId, items: data.items }, penggunaId, data);
    // Lempar agar pelanggan baru ikut rollback jika katalog/penugasan berubah.
    if (!hasil.berhasil) throw new KesalahanWalkIn(409, hasil.alasan, pesanGagal[hasil.alasan] ?? "Pesanan belum dapat dibuat.");
    await tx.permintaanWalkIn.create({ data: { penggunaId, kunci: kunciIdempotensi, sidikPermintaan: sidik, pesananId: hasil.data.id } });
    return { diulang: false, data: await tx.pesanan.findUniqueOrThrow({ where: { id: hasil.data.id }, select: pilihanHasil }) };
  }, { isolationLevel: "ReadCommitted", timeout: 20000, maxWait: 20000 });
};
export const periksaPermintaanWalkIn = (kunci: string, penggunaId: number) => basisData.$transaction(async tx => {
  await kunciJadwalBooking(tx);
  const hasil = await tx.permintaanWalkIn.findUnique({ where: { penggunaId_kunci: { penggunaId, kunci } }, select: { pesanan: { select: pilihanHasil } } });
  return hasil ? { diulang: true, data: hasil.pesanan } : null;
}, { timeout: 20000, maxWait: 20000 });
