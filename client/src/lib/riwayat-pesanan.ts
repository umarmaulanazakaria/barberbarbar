import { api } from "./api";
export type JenisArsip = "BOOKING" | "WALK_IN";
export type EntriRiwayat = { jenis: JenisArsip; id: number; nomor: string; pelanggan: string; jadwal: string;
  penutupan: string | null; sumberPenutupan: string | null; statusBackend: string;
  statusAkhir: "COMPLETED" | "CANCELLED" | "EXPIRED"; statusPembayaran: string };
export type DaftarRiwayat = { data: EntriRiwayat[]; total: number; halaman: number; batas: number; totalHalaman: number;
  tanpaWaktuPenutupan: number; hariIni: string; serverTime: string };
export type DetailRiwayat = Omit<EntriRiwayat, "statusPembayaran"> & { nomorTelepon: string; barber: string | null;
  items: { namaLayanan: string; harga: number; qty: number; subtotal: number }[]; catatan: string | null; alasan: string | null;
  pembayaran: { total: number; jumlahDibayar: number; balance: number; statusPembayaran: string;
    invoice: { nomorInvoice: string; dibuatPada: string; total: number } | null };
  riwayat: { id: number; aksi: string; sebelum: string | null; setelah: string; waktu: string }[] };
export const ambilRiwayat = async (params: Record<string, string | number>, signal?: AbortSignal) =>
  (await api.get<DaftarRiwayat>("/management/history", { params, signal })).data;
export const ambilDetailRiwayat = async (jenis: JenisArsip, id: number, signal?: AbortSignal) =>
  (await api.get<DetailRiwayat>(`/management/history/${jenis}/${id}`, { signal })).data;
export const judulStatusArsip = { COMPLETED: "Selesai", CANCELLED: "Dibatalkan", EXPIRED: "Kedaluwarsa" };
export const labelPembayaranArsip: Record<string, string> = { PAID: "Lunas", UNPAID: "Belum Lunas", PARTIALLY_PAID: "Belum Lunas",
  OVERDUE: "Belum Lunas", DP_PAID: "DP terverifikasi", AWAITING_DP: "Belum dibayar", REFUND_REVIEW: "Pembayaran diperiksa",
  DP_FORFEITED: "DP hangus", PAYMENT_REVIEW: "Perlu pemeriksaan" };
