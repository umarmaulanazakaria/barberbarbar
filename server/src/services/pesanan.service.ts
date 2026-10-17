import { terapkanManfaat, catatPenggunaan } from "./manfaat-membership.service.js";
import { pembayaranOperasionalPending } from "../lib/reservasi-pembayaran.js";
import { Prisma } from "../generated/prisma/client.js";
import { kapasitasLintasBooking } from "../lib/kapasitas-lintas-booking.js";
import { waktuDatabaseBooking } from "../lib/deadline-booking.js";
import basisData from "../lib/prisma.js";
import { kunciJadwalBooking } from "../lib/transaksi-booking.js";
import { bayarPelunasanKasirBooking, KesalahanPembayaranBooking } from "./pembayaran-booking.service.js";
type StatusPesanan = "WAITING" | "IN_SERVICE" | "COMPLETED" | "CANCELLED";
type MetodePembayaran = "CASH" | "QRIS" | "CARD" | "TRANSFER" | "OTHER";

const detailPesanan = {
  booking: { select: { id: true, nomorBooking: true } },
  pelanggan: { include: { membership: true } },
  profilPelanggan: true,
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

export type DataTambahPesanan = { konfirmasiMember?: boolean | undefined; pelangganId: number | null; profilPelangganId?: number | null; barberId?: number | null | undefined; items: Array<{ layananId: number; qty: number }>; catatan?: string | undefined };
export type EkspektasiWalkIn = { items: { layananId: number; hargaDiharapkan: number }[]; totalDiharapkan: number };

// Pemanggil memegang kunciJadwalBooking. Dipakai kasir legacy dan drawer yang sama.
export const buatPesananDalamTransaksi = async (tx: Prisma.TransactionClient, data: DataTambahPesanan, penggunaId: number, ekspektasi?: EkspektasiWalkIn) => {
  const ids = [...new Set(data.items.map(item => item.layananId))];
  if (ekspektasi) {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Layanan" WHERE id IN (${Prisma.join(ids)}) FOR SHARE`);
    if(data.pelangganId!==null) await tx.$queryRaw`SELECT id FROM "Pelanggan" WHERE id=${data.pelangganId} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM "Membership" WHERE "pelangganId"=${data.pelangganId} FOR SHARE`;
    if (data.barberId != null) await tx.$queryRaw`SELECT id FROM "Barber" WHERE id=${data.barberId} FOR SHARE`;
  }
  const pelanggan = data.pelangganId===null ? null : await tx.pelanggan.findUnique({where:{id:data.pelangganId},include:{membership:true}});
  if (data.pelangganId!==null && !pelanggan) return {berhasil:false,alasan:"PELANGGAN_TIDAK_DITEMUKAN"} as const;
  if (pelanggan?.status === "DIBLOKIR") return {berhasil:false,alasan:"PELANGGAN_DIBLOKIR"} as const;
  const profil = data.pelangganId === null ? null : await tx.profilPelanggan.findUnique({ where: { pelangganId: data.pelangganId } });
  if (profil?.diarsipkanPada) return {berhasil:false,alasan:"PROFIL_DIARSIPKAN"} as const;
  if (profil && !profil.nomorTelepon) return {berhasil:false,alasan:"HP_PROFIL_WAJIB"} as const;
  if (data.profilPelangganId != null && data.profilPelangganId !== profil?.id) return {berhasil:false,alasan:"PROFIL_TIDAK_SESUAI"} as const;
  if (data.barberId != null) {
    const barber = await tx.barber.findUnique({where:{id:data.barberId}});
    if (!barber) return {berhasil:false,alasan:"BARBER_TIDAK_DITEMUKAN"} as const;
    if (!barber.aktif) return {berhasil:false,alasan:"BARBER_TIDAK_AKTIF"} as const;
    if (ekspektasi && await tx.pesanan.count({where:{barberId:data.barberId,status:"IN_SERVICE"}})) return {berhasil:false,alasan:"BARBER_SIBUK"} as const;
  }
  const layanan = await tx.layanan.findMany({where:{id:{in:ids}}});
  if (layanan.length !== ids.length) return {berhasil:false,alasan:"LAYANAN_TIDAK_DITEMUKAN"} as const;
  if (layanan.some(l=>!l.aktif)) return {berhasil:false,alasan:"LAYANAN_TIDAK_AKTIF"} as const;
  const layananMap = new Map(layanan.map(l=>[l.id,l]));
  let itemSnapshot = data.items.map(item=>{const l=layananMap.get(item.layananId)!;return {layananId:l.id,namaLayanan:l.nama,durasiMenit:l.durasiMenit,harga:l.harga,qty:item.qty,subtotal:l.harga*item.qty};});
  let manfaat: Awaited<ReturnType<typeof terapkanManfaat>> | null=null;
  if(pelanggan?.membership?.berlakuSampai && pelanggan.membership.isActive && pelanggan.membership.berlakuSampai>await waktuDatabaseBooking(tx)){
    if(!data.konfirmasiMember)return {berhasil:false,alasan:"IDENTITAS_MEMBER_WAJIB"} as const;
    manfaat=await terapkanManfaat(tx,itemSnapshot,pelanggan.membership.memberCode,await waktuDatabaseBooking(tx));itemSnapshot=manfaat.items;
  }
  const subtotal = itemSnapshot.reduce((n,i)=>n+i.subtotal,0);
  const discountPercent = 0; // Manfaat berbayar sudah dihitung per layanan; tidak ada aktivasi dari flag legacy saja.
  const diskon = Math.floor(subtotal*discountPercent/100),total=subtotal-diskon;
  if (ekspektasi && (!Number.isSafeInteger(subtotal) || subtotal>2147483647 || total!==ekspektasi.totalDiharapkan ||
    ekspektasi.items.length!==ids.length || ekspektasi.items.some(i=>layananMap.get(i.layananId)?.harga!==i.hargaDiharapkan))) return {berhasil:false,alasan:"HARGA_BERUBAH"} as const;
  const mulaiPada = await waktuDatabaseBooking(tx),selesaiPada=new Date(mulaiPada.getTime()+itemSnapshot.reduce((n,i)=>n+i.durasiMenit*i.qty,0)*60000);
  if(!await kapasitasLintasBooking(tx,{mulaiPada,selesaiPada},{barberId:data.barberId,hanyaJikaAdaTamu:true}))return {berhasil:false,alasan:"JADWAL_TIDAK_TERSEDIA"} as const;
  const pesanan = await tx.pesanan.create({data:{nomorPesanan:nomorUnik("ORD"),pelangganId:data.pelangganId,profilPelangganId:profil?.id??null,barberId:data.barberId??null,
    ...(manfaat?{membershipBerbayarId:manfaat.member.id,snapshotManfaat:{...manfaat.snapshot,identitasDikonfirmasiOleh:penggunaId}}:{}),catatan:data.catatan??null,status:"WAITING",statusPembayaran:"UNPAID",subtotal,discountPercent,diskon,total,
    items:{create:itemSnapshot},riwayatStatus:{create:{status:"WAITING",penggunaId}}},include:detailPesanan});
  return {berhasil:true,data:pesanan} as const;
};

export const tambahPesanan = (data: DataTambahPesanan, penggunaId: number) => basisData.$transaction(async tx=>{
  await kunciJadwalBooking(tx);
  return buatPesananDalamTransaksi(tx,data,penggunaId);
},{isolationLevel:"ReadCommitted"});

export const ubahStatusPesanan = async (id: number, statusBaru: StatusPesanan, penggunaId: number, barberPilihanId?: number) => {
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
    await kunciJadwalBooking(tx);
    if (await tx.booking.findUnique({ where: { pesananId: id }, select: { id: true } })) return null;
    let barberId: number | undefined;
    if (statusBaru === "IN_SERVICE") {
      barberId = barberPilihanId ?? pesanan.barberId ?? undefined;
      if (!barberId || !(await tx.barber.findFirst({ where: { id: barberId, aktif: true } }))) return null;
      if (await tx.pesanan.count({ where: { id: { not: id }, barberId, status: "IN_SERVICE" } })) return null;
    }
    if(statusBaru==="IN_SERVICE"){
      const items=await tx.itemPesanan.findMany({where:{pesananId:id}}), mulaiPada=await waktuDatabaseBooking(tx);
      const selesaiPada=new Date(mulaiPada.getTime()+items.reduce((n,i)=>n+i.durasiMenit*i.qty,0)*60000);
      if(!await kapasitasLintasBooking(tx,{mulaiPada,selesaiPada},{pesananId:id,barberId,hanyaJikaAdaTamu:true}))return null;
    }
    const hasil = await tx.pesanan.updateMany({
      where: { id, status: pesanan.status },
      data: { status: statusBaru, ...(barberId === undefined ? {} : { barberId }) },
    });

    if (hasil.count !== 1) return null;
    if(statusBaru==="COMPLETED")await catatPenggunaan(tx,id,await waktuDatabaseBooking(tx));

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
  data: { metode: MetodePembayaran; jumlahDiterima: number; catatan?: string | undefined; kunciIdempotensi?: string | undefined },
  penggunaId?: number,
) => {
  const pesanan = await basisData.pesanan.findUnique({ where: { id } });
  if (!pesanan) return { berhasil: false, alasan: "TIDAK_DITEMUKAN" } as const;
  const booking = await basisData.booking.findUnique({ where: { pesananId: id }, select: { id: true } });
  if (booking) {
    if (!penggunaId) throw new KesalahanPembayaranBooking(401, "Operator belum login");
    const hasil = await bayarPelunasanKasirBooking(booking.id, penggunaId, { ...data,
      kunciIdempotensi: data.kunciIdempotensi ?? `legacy_order_${id}` }, data.kunciIdempotensi !== undefined);
    const pembayaranId = hasil.ringkasan.invoice?.pembayaranLegacyId;
    if (!pembayaranId) throw new KesalahanPembayaranBooking(409, "Invoice booking tidak terhubung dengan kasir");
    const [pembayaran, pesananBaru] = await Promise.all([
      basisData.pembayaran.findUniqueOrThrow({ where: { id: pembayaranId } }),
      basisData.pesanan.findUniqueOrThrow({ where: { id }, include: detailPesanan }),
    ]);
    return { berhasil: true, data: { pembayaran, pesanan: pesananBaru } } as const;
  }
  if (pesanan.status !== "COMPLETED") return { berhasil: false, alasan: "BELUM_SELESAI" } as const;

  const hasil = await basisData.$transaction(tx => bayarWalkInDalamTransaksi(tx, id, data));

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

export const bayarWalkInDalamTransaksi = async (tx: Prisma.TransactionClient, id: number, data: { metode: MetodePembayaran; jumlahDiterima: number; catatan?: string | undefined }, operasionalId?: number) => {
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
    if (await pembayaranOperasionalPending(tx, id, operasionalId)) throw new KesalahanPembayaranBooking(409, "QRIS masih aktif; periksa status provider sebelum menerima pembayaran lain");
    // Jika F7 mengaitkan booking ketika request legacy sedang menunggu row lock,
    // jangan masuk ke pencatatan kasir biasa yang belum memahami DP.
    if (await tx.booking.findUnique({ where: { pesananId: id }, select: { id: true } })) {
      throw new KesalahanPembayaranBooking(409, "Pembayaran booking harus menghitung DP dan balance pada ledger");
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
};
