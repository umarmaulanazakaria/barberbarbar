import { createHash } from "node:crypto";
import basisData from "../lib/prisma.js";
import { kunciJadwalBooking } from "../lib/transaksi-booking.js";
import { buatPelangganDalamTransaksi } from "./pelanggan.service.js";
import { buatPesananDalamTransaksi } from "./pesanan.service.js";
import { normalisasiHpWalkIn, type DataWalkIn } from "../schemas/walkin-dashboard.schema.js";

export class KesalahanWalkIn extends Error {
  constructor(public status: number, public kode: string, pesan: string) { super(pesan); }
}
const pilihanHasil = { id: true, nomorPesanan: true, status: true, statusPembayaran: true, total: true } as const;
const pesanGagal: Record<string, string> = {
  PELANGGAN_TIDAK_DITEMUKAN: "Pelanggan tidak ditemukan. Pilih kembali pelanggan.",
  PELANGGAN_DIBLOKIR: "Pelanggan diblokir dan tidak dapat membuat pesanan.",
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
    let pelangganId: number;
    if (data.pelanggan.jenis === "LAMA") pelangganId = data.pelanggan.id;
    else {
      const hp = data.pelanggan.nomorTelepon || null;
      // Data lama boleh memiliki format +62/spasi; jangan mengubahnya atau membuat duplikat.
      if (hp) {
        const pelanggan = await tx.pelanggan.findMany({ where: { nomorTelepon: { not: null } }, select: { nomorTelepon: true } });
        if (pelanggan.some(p => p.nomorTelepon && normalisasiHpWalkIn(p.nomorTelepon) === hp)) throw new KesalahanWalkIn(409, "HP_TERPAKAI", "Nomor HP sudah tercatat. Gunakan Pelanggan Lama.");
      }
      const baru = await buatPelangganDalamTransaksi(tx, { nama: data.pelanggan.nama, nomorTelepon: hp });
      if (!baru) throw new KesalahanWalkIn(409, "HP_TERPAKAI", "Nomor HP sudah tercatat. Gunakan Pelanggan Lama.");
      pelangganId = baru.id;
    }
    const hasil = await buatPesananDalamTransaksi(tx, { pelangganId, barberId: data.barberId, items: data.items }, penggunaId, data);
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
