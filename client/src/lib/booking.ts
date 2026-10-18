import type { Booking, RingkasanBooking } from "../types-booking";
import { api } from "./api";
export const daftarBooking = async () => (await api.get<{ data: Booking[] }>("/bookings")).data.data;
export const ambilBooking = async (id: number) => (await api.get<{ booking: Booking }>(`/bookings/${id}`)).data.booking;
export const ambilPembayaranBooking = async (id: number) => (await api.get<{ ringkasan: RingkasanBooking }>(`/bookings/${id}/payments`)).data.ringkasan;
export function batasKonfirmasi(booking: Booking) {
  const reschedule = booking.riwayat.filter(r => r.aksi === "RESCHEDULE").at(-1);
  return new Date(reschedule?.dibuatPada ?? booking.dibuatPada).getTime() + 30 * 60000;
}
export function izinBooking(booking: Booking, pembayaran: RingkasanBooking | undefined, sekarang = Date.now()) {
  const dp = pembayaran?.syaratDpTerpenuhi === true || pembayaran?.dpTerverifikasi === true;
  const usulanPending = booking.usulanBarber.some(u => u.status === "PENDING");
  const konfirmasi = booking.status === "PENDING_CONFIRMATION" && sekarang < batasKonfirmasi(booking) && sekarang < new Date(booking.mulaiPada).getTime();
  return {
    konfirmasi,
    tolak: booking.status === "PENDING_CONFIRMATION" && sekarang < batasKonfirmasi(booking) && !dp && !pembayaran?.transaksi.some(t => ["PENDING", "SUCCEEDED"].includes(t.status)),
    checkIn: booking.status === "CONFIRMED" && dp && sekarang < new Date(booking.mulaiPada).getTime() + 15 * 60000,
    mulai: booking.status === "CHECKED_IN" && dp && !usulanPending,
    usulkan: ["CONFIRMED", "CHECKED_IN"].includes(booking.status) && booking.barberPilihanId !== null && !usulanPending,
    ubahLayanan: booking.status === "IN_SERVICE" && dp,
    selesai: booking.status === "IN_SERVICE",
    lunasi: booking.status === "COMPLETED" && dp && (pembayaran?.balance ?? 0) > 0 && !pembayaran?.transaksi.some(t => t.tujuan === "PELUNASAN" && t.status === "PENDING"),
  };
}
