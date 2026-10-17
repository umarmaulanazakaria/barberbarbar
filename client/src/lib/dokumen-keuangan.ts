import { api } from "./api";
export type Struk = { id: string; dokumenId: string; nomor: string; pelanggan: string; sumber: string; tujuan: string; metode: string; nominal: number; diterima: number | null; kembalian: number; tanggal: string; referensi: string; periode: string | null };
export type Dokumen = { id: string; nomor: string; referensi: string; pelanggan: string; sumber: string; tanggal: string; total: number; subtotal: number; diskon: number; dibayar: number; refund: number; balance: number; status: "UNPAID" | "DP_PAID" | "PAID" | "FREE"; final: boolean; keadaan: string; catatan: string | null; items: { nama: string; qty: number; nominal: number; hargaReguler: number }[]; struk: Struk[] };
export const statusDokumen = { UNPAID: "Belum Dibayar", DP_PAID: "DP Dibayar", PAID: "Lunas", FREE: "Gratis" };
export const sumberDokumen = (v: string) => v === "WALK_IN" ? "Walk-in" : v === "BOOKING" ? "Booking" : "Membership";
export const metodeDokumen = (v: string) => v === "CASH" ? "Tunai" : v === "TRANSFER" ? "Transfer Manual" : v === "QRIS" ? "QRIS Midtrans" : v;
export const pembayaranBerubah = () => window.dispatchEvent(new Event("pembayaran:berubah"));
export type FormatDokumen = "A4" | "58" | "80";
export async function unduhDokumen(d: Dokumen, s?: Struk, format: FormatDokumen = s ? "80" : "A4") {
  const r = await api.get<Blob>(`/management/finance/documents/${d.id}/pdf`, { params: { format, ...(s ? { struk: s.id } : {}) }, responseType: "blob" });
  if (!String(r.headers["content-type"] ?? "").includes("application/pdf")) throw new Error("PDF belum tersedia.");
  const url = URL.createObjectURL(r.data), a = document.createElement("a"); a.href = url; a.download = `${s?.id ?? d.id}.pdf`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
