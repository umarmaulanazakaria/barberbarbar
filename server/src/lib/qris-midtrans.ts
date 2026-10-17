import { z } from "zod";
import { merchantSandbox, skemaStatusMidtrans, KesalahanMidtrans } from "./midtrans.js";

export const skemaStatusQris = skemaStatusMidtrans.extend({
  expiry_time: z.string().optional(),
  actions: z.array(z.object({ name: z.string(), method: z.string(), url: z.url() })).optional(),
});
export const urlQrisAman = (nilai: string) => {
  const u = new URL(nilai);
  return u.protocol === "https:" && u.hostname === "api.sandbox.midtrans.com" && !u.username && !u.password &&
    /^\/v[24]\/qris\/[A-Za-z0-9-]+\/qr-code$/.test(u.pathname) && !u.search && !u.hash;
};
export const lengkapiGambarQris = async (data: z.infer<typeof skemaStatusQris>, tersimpan?: string | null) => {
  if (data.actions?.some(a => a.method === "GET" && urlQrisAman(a.url))) return data;
  if (tersimpan && urlQrisAman(tersimpan)) return { ...data, actions: [{ name: "generate-qr-code", method: "GET", url: tersimpan }] };
  if (!/^[A-Za-z0-9-]{1,128}$/.test(data.transaction_id)) return data;
  // Get Status dapat tidak memuat actions. URL dokumentasi wajib benar-benar
  // mengembalikan gambar resmi sebelum diberikan ke frontend; bukan QR buatan.
  const url = `https://api.sandbox.midtrans.com/v2/qris/${encodeURIComponent(data.transaction_id)}/qr-code`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "error" });
    const benar = r.ok && r.headers.get("content-type")?.split(";")[0] === "image/png";
    await r.body?.cancel();
    if (benar) return { ...data, actions: [{ name: "generate-qr-code", method: "GET", url }] };
  } catch { /* Intent tetap Pending; tidak menampilkan QR yang belum terverifikasi. */ }
  return data;
};
export class KesalahanChargeQris extends KesalahanMidtrans {
  constructor(public pastiDitolak: boolean) { super(503, "QRIS belum dapat disiapkan. Periksa status sebelum mencoba kembali."); }
}
// Gateway terpisah agar konfigurasi/Snap existing dan WIP pengguna tidak ditimpa.
export const gerbangQris = {
  async buat(orderId: string, nominal: number): Promise<unknown> {
    merchantSandbox(); // konfigurasi existing menolak Production dan key yang belum siap.
    let respons: Response;
    try {
      respons = await fetch("https://api.sandbox.midtrans.com/v2/charge", {
        method: "POST", signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json", Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${process.env.MIDTRANS_SERVER_KEY!.trim()}:`).toString("base64")}` },
        body: JSON.stringify({ payment_type: "qris", transaction_details: { order_id: orderId, gross_amount: nominal }, qris: { acquirer: "gopay" } }),
      });
    } catch { throw new KesalahanChargeQris(false); }
    // 406/409, timeout dan rate-limit tetap ambigu: mungkin charge sebelumnya ada.
    if (!respons.ok) throw new KesalahanChargeQris([400, 401, 402, 403, 404].includes(respons.status));
    try { return await respons.json(); } catch { throw new KesalahanChargeQris(false); }
  },
};
