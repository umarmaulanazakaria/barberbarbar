import { nomorMemberTerbit } from "../lib/nomor-member.js";
import db from "../lib/prisma.js";
import { hitungUangBooking } from "../lib/uang-booking.js";

type Item = { nama: string; qty: number; nominal: number; hargaReguler: number };
export type DokumenKeuangan = {
  id: string; nomor: string; referensi: string; pelanggan: string;
  sumber: "BOOKING" | "WALK_IN" | "MEMBERSHIP"; tanggal: string;
  total: number; subtotal: number; diskon: number; dibayar: number; refund: number; balance: number;
  status: "UNPAID" | "DP_PAID" | "PAID" | "FREE"; final: boolean;
  keadaan: string; catatan: string | null; items: Item[]; struk: StrukKeuangan[];
};
export type StrukKeuangan = {
  id: string; dokumenId: string; nomor: string; pelanggan: string;
  sumber: DokumenKeuangan["sumber"]; tujuan: string; metode: string;
  nominal: number; diterima: number | null; kembalian: number;
  tanggal: string; referensi: string; periode: string | null;
};
const tanggalWib = (d: Date) => new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 10);
const objek = (v: unknown): Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : {};
const rincianHarga = (items: { layananId: number; namaLayanan: string; harga: number; qty: number; subtotal: number }[], snapshot: unknown, total: number) => {
  const daftar = objek(snapshot).items;
  const asli = Array.isArray(daftar) ? daftar.map(objek) : [];
  const hasil = items.map(i => {
    const cocok = asli.find(a => a.layananId === i.layananId && a.qty === i.qty && a.hargaMember === i.harga);
    const reguler = cocok?.hargaReguler;
    return { nama: i.namaLayanan, qty: i.qty, nominal: i.subtotal, hargaReguler: typeof reguler === "number" && Number.isSafeInteger(reguler) && reguler >= i.harga ? reguler : i.harga };
  });
  const subtotal = hasil.reduce((n, i) => n + i.hargaReguler * i.qty, 0);
  return { items: hasil, subtotal, diskon: Math.max(0, subtotal - total) };
};

// Proyeksi baca saja. Pembayaran legacy Booking adalah artefak invoice, bukan kredit kedua.
// Seluruh tabel dibaca dalam snapshot yang sama; tidak ada finalisasi invoice saat GET/cetak.
export const bacaKeuangan = () => db.$transaction(async tx => {
  const [bookings, walkins, penjualan] = await Promise.all([
    tx.booking.findMany({ include: { pelanggan: true, profilPelanggan: true, items: true,
      pesanan: { include: { items: true, barber: true } }, invoice: true,
      transaksiPembayaran: { include: { buktiProvider: true } } } }),
    tx.pesanan.findMany({ where: { booking: null }, include: { pelanggan: true, profilPelanggan: true,
      items: true, pembayaran: { include: { operasional: true } }, barber: true,
      riwayatStatus: { where: { status: "COMPLETED" }, orderBy: { diubahPada: "desc" }, take: 1 } } }),
    tx.penjualanMembership.findMany({ include: { membership: { include: { pelanggan: { include: { profil: true } } } } }, orderBy: { id: "asc" } }),
  ]);
  const dokumen: DokumenKeuangan[] = [];
  const arus: { tanggal: string; sumber: DokumenKeuangan["sumber"]; metode: string; nominal: number }[] = [];
  const selesai: { tanggal: string; barberId: number | null; barber: string; total: number; items: { layananId: number; namaLayanan: string; qty: number }[] }[] = [];
  let perluPemeriksaan = 0;
  for (const b of bookings) {
    const nama = b.profilPelanggan?.nama ?? b.pelanggan.nama;
    const valid = b.transaksiPembayaran.filter(t => t.status === "SUCCEEDED" && t.dibayarPada &&
      (t.kanal === "KASIR" ? t.tujuan === "PELUNASAN" && t.jumlahDiterima !== null && t.kembalian !== null :
        t.buktiProvider && t.buktiProvider.referensiProvider === t.referensiProvider && t.buktiProvider.nominal === t.nominal && t.buktiProvider.mataUang === "IDR"));
    const uang = hitungUangBooking(b.pesanan?.items ?? b.items, b.discountPercent,
      valid.filter(t => t.tujuan !== "REFUND").map(t => t.nominal), valid.filter(t => t.tujuan === "REFUND").map(t => t.nominal));
    const id = `B-${b.id}`;
    const struk: StrukKeuangan[] = valid.filter(t => t.tujuan !== "REFUND").map(t => ({
      id: `BP-${t.id}`, dokumenId: id, nomor: `PAY-BKG-${t.id}`, pelanggan: nama, sumber: "BOOKING",
      tujuan: t.tujuan === "DP" ? "Bukti pembayaran DP" : "Bukti pelunasan", metode: t.metode ?? (t.jenisPembayaranProvider === "qris" ? "QRIS" : t.jenisPembayaranProvider ?? "MIDTRANS"),
      nominal: t.nominal, diterima: t.jumlahDiterima, kembalian: t.kembalian ?? 0,
      tanggal: t.dibayarPada!.toISOString(), referensi: b.nomorBooking, periode: null,
    }));
    for (const t of valid) arus.push({ tanggal: t.dibayarPada!.toISOString(), sumber: "BOOKING", metode: t.metode ?? (t.jenisPembayaranProvider === "qris" ? "QRIS" : "MIDTRANS"), nominal: t.tujuan === "REFUND" ? -t.nominal : t.nominal });
    const gratis = !!b.invoice && b.invoice.total === 0 && b.memberBebasDp;
    const terminal = ["CANCELLED", "REJECTED", "NO_SHOW"].includes(b.status);
    const totalDokumen = b.invoice?.total ?? uang.total, sisaDokumen = Math.max(0, totalDokumen - uang.jumlahDibayar);
    dokumen.push({ id, nomor: b.invoice?.nomorInvoice ?? `TAG-${b.nomorBooking}`, referensi: b.nomorBooking,
      pelanggan: nama, sumber: "BOOKING", tanggal: (b.invoice?.dibuatPada ?? b.dibuatPada).toISOString(), total: totalDokumen,
      dibayar: uang.jumlahDibayar, refund: uang.jumlahRefund, balance: terminal ? 0 : sisaDokumen,
      status: gratis ? "FREE" : totalDokumen > 0 && sisaDokumen === 0 ? "PAID" : uang.jumlahDibayar > 0 ? "DP_PAID" : "UNPAID",
      final: !!b.invoice, keadaan: b.status, catatan: terminal ? "Kewajiban pelunasan dihentikan. Pembayaran dan refund mengikuti ledger terverifikasi; tidak ada pengembalian otomatis dari dokumen ini." : null,
      ...rincianHarga(b.pesanan?.items ?? b.items, b.pesanan?.snapshotManfaat ?? b.snapshotManfaat, totalDokumen), struk });
    if (b.status === "COMPLETED" && b.layananSelesaiPada && b.pesanan) selesai.push({ tanggal: b.layananSelesaiPada.toISOString(), barberId: b.pesanan.barberId,
      barber: b.pesanan.barber?.nama ?? "Belum ditentukan", total: uang.total, items: b.pesanan.items });
  }
  for (const p of walkins) {
    const nama = p.profilPelanggan?.nama ?? p.pelanggan?.nama ?? "Pelanggan walk-in";
    const t = p.pembayaran, op = t?.operasional;
    const sah = !!t && p.statusPembayaran === "PAID" && t.jumlahDiterima - t.kembalian === p.total &&
      (op ? op.status === "SUCCEEDED" && (op.metode === "QRIS" ? !!op.terverifikasiPada && !!op.buktiHash : op.jumlahDiterima !== null && op.kembalian !== null) : t.metode !== "QRIS");
    const id = `W-${p.id}`, gratis = p.total === 0 && !!p.invoiceManfaat && !!p.membershipBerbayarId && p.status === "COMPLETED";
    if (t && !sah) perluPemeriksaan++;
    const struk: StrukKeuangan[] = sah && t ? [{ id: `WP-${t.id}`, dokumenId: id, nomor: t.nomorInvoice, pelanggan: nama,
      sumber: "WALK_IN", tujuan: "Bukti pembayaran", metode: t.metode, nominal: p.total, diterima: t.jumlahDiterima,
      kembalian: t.kembalian, tanggal: t.dibayarPada.toISOString(), referensi: p.nomorPesanan, periode: null }] : [];
    if (sah && t) arus.push({ tanggal: t.dibayarPada.toISOString(), sumber: "WALK_IN", metode: t.metode, nominal: p.total });
    dokumen.push({ id, nomor: t?.nomorInvoice ?? p.invoiceManfaat ?? `TAG-${p.nomorPesanan}`, referensi: p.nomorPesanan,
      pelanggan: nama, sumber: "WALK_IN", tanggal: (sah && t ? t.dibayarPada : p.dibuatPada).toISOString(), total: p.total,
      dibayar: sah ? p.total : 0, refund: 0, balance: sah || gratis ? 0 : p.total,
      status: gratis ? "FREE" : sah ? "PAID" : "UNPAID", final: !!t || gratis, keadaan: p.status,
      catatan: t && !sah ? "Dokumen historis tersedia, tetapi bukti penerimaan belum memenuhi verifikasi. Pembayaran ini tidak masuk pendapatan atau struk otomatis; perlu pemeriksaan Admin." : null,
      ...rincianHarga(p.items, p.snapshotManfaat, p.total), struk });
    const akhir = p.riwayatStatus[0]?.diubahPada;
    if (p.status === "COMPLETED" && akhir) selesai.push({ tanggal: akhir.toISOString(), barberId: p.barberId, barber: p.barber?.nama ?? "Belum ditentukan", total: p.total, items: p.items });
  }
  const pernah = new Set<number>();
  for (const t of penjualan) {
    const bukti = objek(t.buktiProvider);
    const sah = t.status === "SUCCEEDED" && !!t.dibayarPada && !!t.periodeMulai && !!t.periodeSampai &&
      (t.metode === "QRIS" ? bukti.metodeVerifikasi === "MIDTRANS_STATUS_V1" && bukti.orderId === t.providerOrderId && bukti.transactionId === t.providerTransactionId && bukti.nominal === t.nominal && bukti.status === "settlement" && bukti.mataUang === "IDR" :
        ["CASH", "TRANSFER"].includes(t.metode) && (t.jumlahDiterima ?? 0) >= t.nominal && (t.metode !== "TRANSFER" || !!t.referensi));
    const nama = t.membership.pelanggan.profil?.nama ?? t.membership.pelanggan.nama;
    if (t.status === "SUCCEEDED" && !sah) perluPemeriksaan++;
    const id = `M-${t.id}`, tujuan = pernah.has(t.membershipId) ? "Perpanjangan Membership" : "Pembelian Membership";
    const periode = t.periodeMulai && t.periodeSampai ? `${tanggalWib(t.periodeMulai)} s.d. ${tanggalWib(t.periodeSampai)}` : null;
    const struk: StrukKeuangan[] = sah ? [{ id: `MP-${t.id}`, dokumenId: id, nomor: `INV-MEM-${t.id}`, pelanggan: nama,
      sumber: "MEMBERSHIP", tujuan, metode: t.metode, nominal: t.nominal, diterima: t.jumlahDiterima,
      kembalian: Math.max(0, (t.jumlahDiterima ?? t.nominal) - t.nominal), tanggal: t.dibayarPada!.toISOString(), referensi: nomorMemberTerbit(t.membership.memberCode) ?? "Menunggu aktivasi", periode }] : [];
    if (sah) { pernah.add(t.membershipId); arus.push({ tanggal: t.dibayarPada!.toISOString(), sumber: "MEMBERSHIP", metode: t.metode, nominal: t.nominal }); }
    dokumen.push({ id, nomor: sah ? `INV-MEM-${t.id}` : `TAG-MEM-${t.id}`, referensi: nomorMemberTerbit(t.membership.memberCode) ?? "Menunggu aktivasi",
      pelanggan: nama, sumber: "MEMBERSHIP", tanggal: (t.dibayarPada ?? t.dibuatPada).toISOString(), total: t.nominal,
      dibayar: sah ? t.nominal : 0, refund: 0, balance: sah ? 0 : t.nominal, status: sah ? "PAID" : "UNPAID", final: sah,
      subtotal: t.nominal, diskon: 0, keadaan: t.status, catatan: t.status === "SUCCEEDED" && !sah ? "Bukti penerimaan perlu pemeriksaan Admin; belum dihitung sebagai pendapatan." : null, items: [{ nama: `${tujuan} 12 bulan`, qty: 1, nominal: t.nominal, hargaReguler: t.nominal }], struk });
  }
  return { dokumen: dokumen.sort((a, b) => b.tanggal.localeCompare(a.tanggal)), arus, selesai, perluPemeriksaan };
}, { isolationLevel: "RepeatableRead", timeout: 20000 });

export const laporanKeuangan = (data: Awaited<ReturnType<typeof bacaKeuangan>>, mulai: string, sampai: string) => {
  const dalam = (v: string) => { const d = tanggalWib(new Date(v)); return d >= mulai && d <= sampai; };
  const arus = data.arus.filter(t => dalam(t.tanggal)), selesai = data.selesai.filter(p => dalam(p.tanggal));
  const total = (sumber?: string) => arus.filter(t => !sumber || t.sumber === sumber).reduce((n, t) => n + t.nominal, 0);
  const tren = new Map<string, number>(), metode = new Map<string, number>();
  for (let d = new Date(`${mulai}T00:00:00Z`); d.toISOString().slice(0, 10) <= sampai; d.setUTCDate(d.getUTCDate() + 1)) tren.set(d.toISOString().slice(0, 10), 0);
  for (const t of arus) { const k = tanggalWib(new Date(t.tanggal)); tren.set(k, (tren.get(k) ?? 0) + t.nominal); metode.set(t.metode, (metode.get(t.metode) ?? 0) + t.nominal); }
  const layanan = new Map<number, { id: number; nama: string; jumlah: number }>(), barber = new Map<number | null, { id: number | null; nama: string; kunjungan: number; nilai: number }>();
  for (const p of selesai) {
    const b = barber.get(p.barberId) ?? { id: p.barberId, nama: p.barber, kunjungan: 0, nilai: 0 }; b.kunjungan++; b.nilai += p.total; barber.set(p.barberId, b);
    for (const i of p.items) { const l = layanan.get(i.layananId) ?? { id: i.layananId, nama: i.namaLayanan, jumlah: 0 }; l.jumlah += i.qty; layanan.set(i.layananId, l); }
  }
  return { mulai, sampai, perluPemeriksaan: data.perluPemeriksaan, pendapatan: total(), booking: total("BOOKING"), walkIn: total("WALK_IN"), membership: total("MEMBERSHIP"),
    penerimaanBruto: arus.filter(t => t.nominal > 0).reduce((n, t) => n + t.nominal, 0), koreksiRefund: -arus.filter(t => t.nominal < 0).reduce((n, t) => n + t.nominal, 0),
    metode: [...metode].map(([nama, nominal]) => ({ nama, nominal })), tren: [...tren].map(([tanggal, nominal]) => ({ tanggal, nominal })),
    layanan: [...layanan.values()].sort((a, b) => b.jumlah - a.jumlah), barber: [...barber.values()].sort((a, b) => b.kunjungan - a.kunjungan) };
};
