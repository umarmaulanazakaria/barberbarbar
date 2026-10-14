import { randomUUID } from "node:crypto";
import basisData from "../lib/prisma.js";
import { kapasitasBookingCukup, validasiWaktuBooking, zonaBooking } from "../lib/jadwal-booking.js";
import type { DataBuatBooking } from "../schemas/booking.schema.js";
import { kunciJadwalBooking } from "../lib/transaksi-booking.js";

export const kolomBooking = {
  id: true, nomorBooking: true, status: true, mulaiPada: true, selesaiPada: true, zonaWaktu: true,
  durasiMenit: true, barberPilihanId: true, pesananId: true, subtotal: true, membershipAktif: true,
  discountPercent: true, diskon: true, total: true, dpPersen: true, nominalDp: true, catatan: true,
  dibuatPada: true, diperbaruiPada: true, dikonfirmasiPada: true, ditolakPada: true, dibatalkanPada: true,
  deadlineDp: true, deadlinePelunasan: true, checkInPada: true, layananMulaiPada: true, layananSelesaiPada: true,
  alasanPenolakan: true, barberDisetujuiId: true, barberFinalId: true,
  usulanBarber: { select: { id: true, barberId: true, alasan: true, status: true, dibuatPada: true, diputuskanPada: true }, orderBy: { id: "desc" as const } },
  riwayat: { select: { aksi: true, statusSebelum: true, statusSetelah: true, rincian: true, dibuatPada: true }, orderBy: { id: "asc" as const } },
  items: { select: { layananId: true, namaLayanan: true, harga: true, durasiMenit: true, qty: true, subtotal: true } },
} as const;
export const statusMenahanBooking = ["PENDING_CONFIRMATION", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"] as const;

export const buatBookingPelanggan = async (pelangganId: number, data: DataBuatBooking) =>
  basisData.$transaction(async transaksi => {
    // PrismaPg mengirim parameter Date sebagai waktu UTC tanpa offset.
    // TIMESTAMPTZ harus menafsirkan parameter itu dalam UTC, bukan zona sesi host.
    await kunciJadwalBooking(transaksi);
    // Semua penulis booking F5+ wajib memakai lock yang sama sebelum validasi.
    // READ COMMITTED membaca hasil commit request sebelumnya setelah menunggu lock.
    const sekarang = new Date();
    const pelanggan = await transaksi.pelanggan.findUnique({ where: { id: pelangganId }, include: { membership: true } });
    if (!pelanggan || pelanggan.status !== "AKTIF") return { status: "AKUN_TIDAK_AKTIF" } as const;
    const layanan = await transaksi.layanan.findMany({ where: { id: { in: data.items.map(item => item.layananId) }, aktif: true } });
    if (layanan.length !== data.items.length) return { status: "DATA_TIDAK_VALID" } as const;
    const items = data.items.map(item => {
      const sumber = layanan.find(l => l.id === item.layananId)!;
      return { layananId: sumber.id, namaLayanan: sumber.nama, durasiMenit: sumber.durasiMenit,
        harga: sumber.harga, qty: item.qty, subtotal: sumber.harga * item.qty };
    });
    if (items.some(item => item.harga < 0 || item.durasiMenit <= 0)) return { status: "DATA_TIDAK_VALID" } as const;
    const durasiMenit = items.reduce((total, item) => total + item.durasiMenit * item.qty, 0);
    const mulaiPada = new Date(data.mulaiPada);
    const selesaiPada = validasiWaktuBooking(mulaiPada, durasiMenit, sekarang);
    if (!selesaiPada) return { status: "WAKTU_TIDAK_VALID" } as const;
    const aktif = await transaksi.barber.findMany({ where: { aktif: true }, select: { id: true } });
    if (data.barberPilihanId && !aktif.some(b => b.id === data.barberPilihanId)) return { status: "DATA_TIDAK_VALID" } as const;
    const rentang = { mulaiPada, selesaiPada };
    const bentrok = await transaksi.booking.findMany({ where: { status: { in: [...statusMenahanBooking] },
      mulaiPada: { lt: selesaiPada }, selesaiPada: { gt: mulaiPada } },
      select: { pelangganId: true, barberPilihanId: true, barberDisetujuiId: true, barberFinalId: true, mulaiPada: true, selesaiPada: true } });
    if (bentrok.some(b => b.pelangganId === pelangganId) ||
        (data.barberPilihanId && bentrok.some(b => (b.barberFinalId ?? b.barberDisetujuiId ?? b.barberPilihanId) === data.barberPilihanId)) ||
        !kapasitasBookingCukup(bentrok, rentang, aktif.length)) return { status: "JADWAL_TIDAK_TERSEDIA" } as const;
    const subtotal = items.reduce((jumlah, item) => jumlah + item.subtotal, 0);
    const membershipAktif = pelanggan.membership?.isActive === true;
    // Kontrak F4: ACTIVE selalu 10%, tidak mengikuti diskon kustom operator.
    // API/pesanan operator existing tidak diubah (kebijakan F3 tetap berlaku).
    const discountPercent = membershipAktif ? 10 : 0;
    const diskon = Math.floor(subtotal * discountPercent / 100);
    const total = subtotal - diskon;
    const nominalDp = Math.ceil(total / 2); // Rupiah bulat; setidaknya 50%.
    if (![subtotal, total, nominalDp].every(angka => Number.isSafeInteger(angka) && angka >= 0 && angka <= 2_147_483_647)) {
      return { status: "DATA_TIDAK_VALID" } as const;
    }
    const booking = await transaksi.booking.create({ data: {
      nomorBooking: `BKG-${randomUUID()}`, pelangganId, barberPilihanId: data.barberPilihanId ?? null,
      mulaiPada, selesaiPada, zonaWaktu: zonaBooking, durasiMenit, subtotal, membershipAktif,
      discountPercent, diskon, total, dpPersen: 50, nominalDp, catatan: data.catatan ?? null,
      items: { create: items },
    }, select: kolomBooking });
    return { status: "BERHASIL", booking } as const;
  }, { isolationLevel: "ReadCommitted" });

export const daftarBookingSendiri = (pelangganId: number) => basisData.booking.findMany({
  where: { pelangganId }, select: kolomBooking, orderBy: { mulaiPada: "asc" },
});
export const detailBookingSendiri = (pelangganId: number, id: number) => basisData.booking.findFirst({
  where: { id, pelangganId }, select: kolomBooking,
});
