import { useEffect, useRef, useState } from "react";
import { api } from "./api";
export type EntriPesanan = { jenis: "BOOKING" | "WALK_IN"; id: number; bookingId: number | null; pesananId: number | null; nomor: string; nomorPesanan: string | null; pelanggan: string; barber: string | null; jadwal: string; checkIn: string | null; status: string; statusPembayaran: string; total: number; nomorInvoice: string | null };
export type DaftarTerpadu = { data: EntriPesanan[]; total: number; halaman: number; batas: number; hariIni: string; serverTime: string; metrik?: { waiting: number; inService: number; completedUnpaid: number; paidToday: number; revenueToday: number; pelanggan: number; barberAktif: number; layananAktif: number } };
export const ambilPesananTerpadu = async (params: Record<string,string | number>) => (await api.get<DaftarTerpadu>("/management/orders", { params })).data;
export const hariWib = (ms = Date.now()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
export const waktuWib = (iso: string) => new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) + " WIB";
export function useHariOperasional(serverTime?: string) {
  const [hari, aturHari] = useState(hariWib), offset = useRef(0);
  useEffect(() => { if (serverTime) { offset.current = Date.parse(serverTime) - Date.now(); aturHari(hariWib(Date.now() + offset.current)); } }, [serverTime]);
  useEffect(() => { const perbarui = () => aturHari(hariWib(Date.now() + offset.current)); const t = setInterval(perbarui,1000); window.addEventListener("focus",perbarui); return () => { clearInterval(t); window.removeEventListener("focus",perbarui); }; },[]);
  return hari;
}
