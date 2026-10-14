export type StatusBooking = "PENDING_CONFIRMATION" | "CONFIRMED" | "CHECKED_IN" | "IN_SERVICE" | "COMPLETED" | "REJECTED" | "CANCELLED" | "NO_SHOW";
export type ItemBooking = { layananId: number; namaLayanan: string; harga: number; durasiMenit: number; qty: number; subtotal: number };
export type Booking = {
  id: number; nomorBooking: string; status: StatusBooking; mulaiPada: string; selesaiPada: string; zonaWaktu: string;
  durasiMenit: number; barberPilihanId: number | null; barberDisetujuiId: number | null; barberFinalId: number | null;
  pesananId: number | null; subtotal: number; discountPercent: number; diskon: number; total: number; nominalDp: number;
  catatan: string | null; dibuatPada: string; deadlineDp: string | null; deadlinePelunasan: string | null;
  alasanPenolakan: string | null; pelanggan: { id: number; nama: string }; items: ItemBooking[];
  usulanBarber: { id: number; barberId: number; alasan: string; status: string; dibuatPada: string; diputuskanPada: string | null }[];
  riwayat: { aksi: string; statusSebelum: string | null; statusSetelah: string; rincian: unknown; dibuatPada: string }[];
};
export type RingkasanBooking = {
  subtotal: number; diskon: number; total: number; jumlahDibayar: number; balance: number; kelebihan: number;
  nominalDpAwal: number; dpTerverifikasi: boolean; statusPembayaran: string; invoiceSementara: boolean;
  invoice: { id: number; nomorInvoice: string; total: number; dibuatPada: string } | null;
  transaksi: { id: number; tujuan: string; kanal: string; status: string; nominal: number; mataUang: string; metode: string | null; dibuatPada: string; dibayarPada: string | null }[];
};
export type PermohonanRefund = { id: number; bookingId: number; transaksiAsalId: number; nominal: number; alasan: string; status: string; dibuatPada: string; diputuskanPada: string | null; catatanKeputusan: string | null; kodeProvider: string | null };
