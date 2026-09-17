export type Role = "ADMIN" | "STAFF";
export type StatusPelanggan = "AKTIF" | "DIBLOKIR";
export type StatusPesanan =
  | "WAITING"
  | "IN_SERVICE"
  | "COMPLETED"
  | "CANCELLED";
export type StatusPembayaran = "UNPAID" | "PAID";
export type MetodePembayaran = "CASH" | "QRIS" | "CARD" | "TRANSFER" | "OTHER";
export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  createdAt?: string;
}
export interface Membership {
  id: number;
  pelangganId: number;
  memberCode: string;
  discountPercent: number;
  isActive: boolean;
  joinedAt: string;
  pelanggan?: Pelanggan;
}
export interface Pelanggan {
  id: number;
  nama: string;
  nomorTelepon: string;
  alamat: string | null;
  dibuatPada: string;
  status: StatusPelanggan;
  membership?: Membership | null;
}
export interface Barber {
  id: number;
  nama: string;
  nomorTelepon: string | null;
  aktif: boolean;
  dibuatPada: string;
}
export interface Layanan {
  id: number;
  nama: string;
  durasiMenit: number;
  harga: number;
  aktif: boolean;
  dibuatPada: string;
}
export interface ItemPesanan {
  id: number;
  pesananId: number;
  layananId: number;
  namaLayanan: string;
  durasiMenit: number;
  harga: number;
  qty: number;
  subtotal: number;
  layanan?: Layanan;
}
export interface Pembayaran {
  id: number;
  pesananId: number;
  nomorInvoice: string;
  metode: MetodePembayaran;
  jumlahDiterima: number;
  kembalian: number;
  catatan: string | null;
  dibayarPada: string;
}
export interface RiwayatStatus {
  id: number;
  status: StatusPesanan;
  diubahPada: string;
  pengguna?: Pick<User, "id" | "name" | "role"> | null;
}
export interface Pesanan {
  id: number;
  nomorPesanan: string;
  pelangganId: number;
  barberId: number;
  status: StatusPesanan;
  statusPembayaran: StatusPembayaran;
  checkInTime: string;
  catatan: string | null;
  subtotal: number;
  discountPercent: number;
  diskon: number;
  total: number;
  dibuatPada: string;
  diperbaruiPada: string;
  pelanggan: Pelanggan;
  barber: Barber;
  items: ItemPesanan[];
  pembayaran: Pembayaran | null;
  riwayatStatus?: RiwayatStatus[];
}
export interface Invoice extends Pembayaran {
  pesanan: Pesanan;
}
export interface DashboardData {
  waiting: number;
  inService: number;
  completedUnpaid: number;
  paidToday: number;
  pelanggan: number;
  barberAktif: number;
  layananAktif: number;
  revenueToday: number;
  pesananTerbaru: Pesanan[];
}
export interface ReportData {
  jumlahPesanan: number;
  selesai: number;
  dibatalkan: number;
  belumDibayar: number;
  revenue: number;
  pesanan: Pesanan[];
}
