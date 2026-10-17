import { api } from "./api";
export type PelangganWalkIn = { jenis: "LAMA"; id: number } | { jenis: "BARU"; nama: string; nomorTelepon?: string };
export type PermintaanWalkIn = { pelanggan: PelangganWalkIn; items: { layananId: number; qty: number; hargaDiharapkan: number }[];
  barberId: number | null; totalDiharapkan: number; kunciIdempotensi: string };
export type HasilWalkIn = { pesan: string; diulang: boolean; data: { id: number; nomorPesanan: string; status: string; statusPembayaran: string; total: number } };
export const kirimWalkIn = async (body: PermintaanWalkIn) => (await api.post<HasilWalkIn>("/orders/walk-in", body, { timeout: 20000 })).data;
export const periksaWalkIn = async (kunci: string) => (await api.get<HasilWalkIn>(`/orders/walk-in/requests/${encodeURIComponent(kunci)}`, { timeout: 20000 })).data;
export const normalisasiHpWalkIn = (nilai: string) => nilai.replace(/[\s().+-]/g, "").replace(/^62/, "0");
export const hpWalkInValid = (nilai: string) => !nilai.trim() || /^[+0-9\s().-]+$/.test(nilai) && /^08[0-9]{8,11}$/.test(normalisasiHpWalkIn(nilai));
