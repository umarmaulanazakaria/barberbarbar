import basisData from "../lib/prisma.js";
type StatusPesanan = "WAITING" | "IN_SERVICE" | "COMPLETED" | "CANCELLED";
type MetodePembayaran = "CASH" | "QRIS" | "CARD" | "TRANSFER" | "OTHER";

const detailPesanan = {
  pelanggan: { include: { membership: true } },
  barber: true,
  items: { include: { layanan: true } },
  pembayaran: true,
  riwayatStatus: { include: { pengguna: { select: { id: true, name: true, role: true } } }, orderBy: { diubahPada: "asc" as const } },
} as const;

const nomorUnik = (prefix: string) => `${prefix}-${Date.now().toString().slice(-9)}-${Math.floor(Math.random() * 900 + 100)}`;

export const ambilSemuaPesanan = async () => {
  return basisData.pesanan.findMany({
    include: detailPesanan,
    orderBy: { dibuatPada: "desc" },
  });
};

export const ambilPesananAktif = async () => {
  return basisData.pesanan.findMany({
    where: { OR: [{ status: "WAITING" }, { status: "IN_SERVICE" }, { status: "COMPLETED", statusPembayaran: "UNPAID" }] },
    include: detailPesanan,
    orderBy: { checkInTime: "desc" },
  });
};

export const ambilRiwayatPesanan = async () => {
  return basisData.pesanan.findMany({
    where: { status: "COMPLETED", statusPembayaran: "PAID" },
    include: detailPesanan,
    orderBy: { diperbaruiPada: "desc" },
  });
};

export const ambilPesananBerdasarkanId = async (id: number) => {
  return basisData.pesanan.findUnique({ where: { id }, include: detailPesanan });
};

export const tambahPesanan = async (
  data: { pelangganId: number; barberId: number; items: Array<{ layananId: number; qty: number }>; catatan?: string | undefined },
  penggunaId: number,
) => {
  const pelanggan = await basisData.pelanggan.findUnique({
    where: { id: data.pelangganId },
    include: { membership: true },
  });
  if (!pelanggan) return { berhasil: false, alasan: "PELANGGAN_TIDAK_DITEMUKAN" } as const;
  if (pelanggan.status === "DIBLOKIR") return { berhasil: false, alasan: "PELANGGAN_DIBLOKIR" } as const;

  const barber = await basisData.barber.findUnique({ where: { id: data.barberId } });
  if (!barber) return { berhasil: false, alasan: "BARBER_TIDAK_DITEMUKAN" } as const;
  if (!barber.aktif) return { berhasil: false, alasan: "BARBER_TIDAK_AKTIF" } as const;

  const ids = [...new Set(data.items.map((item) => item.layananId))];
  const layanan = await basisData.layanan.findMany({ where: { id: { in: ids } } });
  if (layanan.length !== ids.length) return { berhasil: false, alasan: "LAYANAN_TIDAK_DITEMUKAN" } as const;
  if (layanan.some((item) => !item.aktif)) return { berhasil: false, alasan: "LAYANAN_TIDAK_AKTIF" } as const;

  const layananMap = new Map(layanan.map((item) => [item.id, item]));
  const itemSnapshot = data.items.map((item) => {
    const layananItem = layananMap.get(item.layananId)!;
    return {
      layananId: layananItem.id,
      namaLayanan: layananItem.nama,
      durasiMenit: layananItem.durasiMenit,
      harga: layananItem.harga,
      qty: item.qty,
      subtotal: layananItem.harga * item.qty,
    };
  });

  const subtotal = itemSnapshot.reduce((total, item) => total + item.subtotal, 0);
  const membership = pelanggan.membership?.isActive ? pelanggan.membership : null;
  const discountPercent = membership?.discountPercent ?? 0;
  const diskon = Math.floor((subtotal * discountPercent) / 100);
  const total = subtotal - diskon;

  const pesanan = await basisData.pesanan.create({
    data: {
      nomorPesanan: nomorUnik("ORD"),
      pelangganId: data.pelangganId,
      barberId: data.barberId,
      catatan: data.catatan ?? null,
      subtotal,
      discountPercent,
      diskon,
      total,
      items: { create: itemSnapshot },
      riwayatStatus: { create: { status: "WAITING", penggunaId } },
    },
    include: detailPesanan,
  });

  return { berhasil: true, data: pesanan } as const;
};

export const ubahStatusPesanan = async (id: number, statusBaru: StatusPesanan, penggunaId: number) => {
  const pesanan = await basisData.pesanan.findUnique({ where: { id } });
  if (!pesanan) return { berhasil: false, alasan: "TIDAK_DITEMUKAN" } as const;

  const transisi: Record<StatusPesanan, StatusPesanan[]> = {
    WAITING: ["IN_SERVICE", "CANCELLED"],
    IN_SERVICE: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
  };

  const statusDiizinkan = transisi[pesanan.status as StatusPesanan] ?? [];
  if (!statusDiizinkan.includes(statusBaru)) {
    return { berhasil: false, alasan: "TRANSISI_TIDAK_VALID" } as const;
  }

  const diperbarui = await basisData.$transaction(async (tx) => {
    const hasil = await tx.pesanan.updateMany({
      where: { id, status: pesanan.status },
      data: { status: statusBaru },
    });

    if (hasil.count !== 1) return null;

    await tx.riwayatStatusPesanan.create({
      data: { pesananId: id, status: statusBaru, penggunaId },
    });

    return tx.pesanan.findUniqueOrThrow({
      where: { id },
      include: detailPesanan,
    });
  });

  if (!diperbarui) return { berhasil: false, alasan: "TRANSISI_TIDAK_VALID" } as const;
  return { berhasil: true, data: diperbarui } as const;
};

export const bayarPesanan = async (
  id: number,
  data: { metode: MetodePembayaran; jumlahDiterima: number; catatan?: string | undefined },
) => {
  const pesanan = await basisData.pesanan.findUnique({ where: { id } });
  if (!pesanan) return { berhasil: false, alasan: "TIDAK_DITEMUKAN" } as const;
  if (pesanan.status !== "COMPLETED") return { berhasil: false, alasan: "BELUM_SELESAI" } as const;

  const hasil = await basisData.$transaction(async (tx) => {
    // Kunci order yang sama sebelum membaca total terakhir. Ini mencegah
    // pembayaran beradu dengan penambahan/perubahan service di payment modal.
    const dikunci = await tx.pesanan.updateMany({
      where: {
        id,
        status: "COMPLETED",
        statusPembayaran: "UNPAID",
      },
      data: { diperbaruiPada: new Date() },
    });

    if (dikunci.count !== 1) {
      return { tipe: "SUDAH_DIBAYAR" } as const;
    }

    const pesananTerkini = await tx.pesanan.findUniqueOrThrow({
      where: { id },
      include: { pembayaran: true },
    });

    if (pesananTerkini.pembayaran) {
      return { tipe: "SUDAH_DIBAYAR" } as const;
    }

    if (data.jumlahDiterima < pesananTerkini.total) {
      return { tipe: "JUMLAH_KURANG" } as const;
    }

    await tx.pesanan.update({
      where: { id },
      data: { statusPembayaran: "PAID" },
    });

    const pembayaran = await tx.pembayaran.create({
      data: {
        pesananId: id,
        nomorInvoice: nomorUnik("INV"),
        metode: data.metode,
        jumlahDiterima: data.jumlahDiterima,
        kembalian: data.jumlahDiterima - pesananTerkini.total,
        catatan: data.catatan ?? null,
      },
    });

    const pesananBaru = await tx.pesanan.findUniqueOrThrow({
      where: { id },
      include: detailPesanan,
    });

    return {
      tipe: "BERHASIL",
      data: { pembayaran, pesanan: pesananBaru },
    } as const;
  });

  if (hasil.tipe === "SUDAH_DIBAYAR") {
    return { berhasil: false, alasan: "SUDAH_DIBAYAR" } as const;
  }

  if (hasil.tipe === "JUMLAH_KURANG") {
    return { berhasil: false, alasan: "JUMLAH_KURANG" } as const;
  }

  return { berhasil: true, data: hasil.data } as const;
};

export const ambilSemuaInvoice = async () => {
  return basisData.pembayaran.findMany({
    include: {
      pesanan: {
        include: { pelanggan: true, barber: true, items: true },
      },
    },
    orderBy: { dibayarPada: "desc" },
  });
};
