import type { Prisma } from "../generated/prisma/client.js";
import basisData from "../lib/prisma.js";

const statusYangBisaDiubah = ["WAITING", "IN_SERVICE", "COMPLETED"] as const;

const kunciPesananSebelumPembayaran = async (
  tx: Prisma.TransactionClient,
  pesananId: number,
) => {
  const hasil = await tx.pesanan.updateMany({
    where: {
      id: pesananId,
      statusPembayaran: "UNPAID",
      status: { in: [...statusYangBisaDiubah] },
    },
    // Update ringan ini sekaligus mengambil row lock sehingga perubahan item
    // tidak dapat beradu dengan proses pembayaran pada pesanan yang sama.
    data: { diperbaruiPada: new Date() },
  });

  return hasil.count === 1;
};

const hitungUlang = async (
  tx: Prisma.TransactionClient,
  pesananId: number,
) => {
  const pesanan = await tx.pesanan.findUnique({ where: { id: pesananId } });
  const items = await tx.itemPesanan.findMany({ where: { pesananId } });
  const subtotal = items.reduce((jumlah, item) => jumlah + item.subtotal, 0);
  const diskon = Math.floor(
    subtotal * ((pesanan?.discountPercent ?? 0) / 100),
  );

  await tx.pesanan.update({
    where: { id: pesananId },
    data: {
      subtotal,
      diskon,
      total: subtotal - diskon,
    },
  });
};

export const ambilItemBerdasarkanPesanan = async (pesananId: number) =>
  basisData.itemPesanan.findMany({
    where: { pesananId },
    include: { layanan: true },
    orderBy: { id: "asc" },
  });

export const tambahItemPesanan = async (data: {
  pesananId: number;
  layananId: number;
  qty: number;
}) => {
  const pesanan = await basisData.pesanan.findUnique({
    where: { id: data.pesananId },
  });

  if (!pesanan) {
    return { berhasil: false, alasan: "PESANAN_TIDAK_DITEMUKAN" } as const;
  }

  return basisData.$transaction(async (tx) => {
    const dapatDiubah = await kunciPesananSebelumPembayaran(
      tx,
      data.pesananId,
    );

    if (!dapatDiubah) {
      return {
        berhasil: false,
        alasan: "PESANAN_TIDAK_BISA_DIUBAH",
      } as const;
    }

    const layanan = await tx.layanan.findUnique({
      where: { id: data.layananId },
    });

    if (!layanan || !layanan.aktif) {
      return { berhasil: false, alasan: "LAYANAN_TIDAK_VALID" } as const;
    }

    const item = await tx.itemPesanan.create({
      data: {
        pesananId: data.pesananId,
        layananId: layanan.id,
        namaLayanan: layanan.nama,
        durasiMenit: layanan.durasiMenit,
        harga: layanan.harga,
        qty: data.qty,
        subtotal: layanan.harga * data.qty,
      },
    });

    await hitungUlang(tx, data.pesananId);

    return { berhasil: true, data: item } as const;
  });
};

export const ubahItemPesanan = async (
  id: number,
  data: {
    layananId?: number | undefined;
    qty?: number | undefined;
  },
) => {
  const item = await basisData.itemPesanan.findUnique({ where: { id } });

  if (!item) {
    return { berhasil: false, alasan: "ITEM_TIDAK_DITEMUKAN" } as const;
  }

  return basisData.$transaction(async (tx) => {
    const dapatDiubah = await kunciPesananSebelumPembayaran(
      tx,
      item.pesananId,
    );

    if (!dapatDiubah) {
      return {
        berhasil: false,
        alasan: "PESANAN_TIDAK_BISA_DIUBAH",
      } as const;
    }

    const layanan =
      data.layananId !== undefined
        ? await tx.layanan.findUnique({ where: { id: data.layananId } })
        : null;

    if (data.layananId !== undefined && (!layanan || !layanan.aktif)) {
      return { berhasil: false, alasan: "LAYANAN_TIDAK_VALID" } as const;
    }

    const harga = layanan?.harga ?? item.harga;
    const qty = data.qty ?? item.qty;

    const diperbarui = await tx.itemPesanan.update({
      where: { id },
      data: {
        ...(layanan && {
          layananId: layanan.id,
          namaLayanan: layanan.nama,
          durasiMenit: layanan.durasiMenit,
          harga: layanan.harga,
        }),
        ...(data.qty !== undefined && { qty }),
        subtotal: harga * qty,
      },
    });

    await hitungUlang(tx, item.pesananId);

    return { berhasil: true, data: diperbarui } as const;
  });
};

export const hapusItemPesanan = async (id: number) => {
  const item = await basisData.itemPesanan.findUnique({ where: { id } });

  if (!item) {
    return { berhasil: false, alasan: "ITEM_TIDAK_DITEMUKAN" } as const;
  }

  return basisData.$transaction(async (tx) => {
    const dapatDiubah = await kunciPesananSebelumPembayaran(
      tx,
      item.pesananId,
    );

    if (!dapatDiubah) {
      return {
        berhasil: false,
        alasan: "PESANAN_TIDAK_BISA_DIUBAH",
      } as const;
    }

    const jumlahItem = await tx.itemPesanan.count({
      where: { pesananId: item.pesananId },
    });

    if (jumlahItem <= 1) {
      return { berhasil: false, alasan: "MINIMAL_SATU_ITEM" } as const;
    }

    await tx.itemPesanan.delete({ where: { id } });
    await hitungUlang(tx, item.pesananId);

    return { berhasil: true } as const;
  });
};
