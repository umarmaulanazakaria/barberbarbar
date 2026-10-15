import "dotenv/config";
import midtrans from "midtrans-client";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export class KesalahanMidtrans extends Error {
  constructor(public kode: number, pesan: string) { super(pesan); }
}
const kodeAman = (error: unknown) => {
  if (typeof error !== "object" || error === null || !("httpStatusCode" in error)) return "NETWORK_OR_INVALID_RESPONSE";
  const kode=Number(error.httpStatusCode);
  return Number.isInteger(kode) && kode>=400 && kode<=599 ? `HTTP_${kode}` : "NETWORK_OR_INVALID_RESPONSE";
};
const konfigurasi = () => {
  const { MIDTRANS_MERCHANT_ID: merchant, MIDTRANS_SERVER_KEY: serverKey,
    MIDTRANS_CLIENT_KEY: clientKey, MIDTRANS_IS_PRODUCTION: production } = process.env;
  if (!merchant?.trim() || !serverKey?.trim() || !clientKey?.trim() || production !== "false") {
    throw new KesalahanMidtrans(503, "Pembayaran online belum tersedia. Silakan hubungi pengelola.");
  }
  return { merchant:merchant.trim(), serverKey:serverKey.trim(), clientKey:clientKey.trim(), isProduction: false };
};
export const merchantSandbox = () => konfigurasi().merchant;
export const verifikasiSignatureMidtrans = (data: { order_id: string; status_code: string; gross_amount: string; signature_key: string }) => {
  const hasil = createHash("sha512").update(data.order_id + data.status_code + data.gross_amount + konfigurasi().serverKey).digest();
  return /^[a-fA-F0-9]{128}$/.test(data.signature_key) && timingSafeEqual(hasil, Buffer.from(data.signature_key, "hex"));
};
const refund = z.object({ refund_key: z.string(), refund_amount: z.string().regex(/^\d+(\.00)?$/),
  refund_chargeback_id: z.union([z.string(), z.number()]), bank_confirmed_at: z.string().optional(),
  refund_method: z.string().optional() });
export const skemaStatusMidtrans = z.object({ order_id: z.string().min(1), transaction_id: z.string().min(1),
  merchant_id: z.string().min(1), gross_amount: z.string().regex(/^\d+(\.00)?$/), currency: z.literal("IDR"),
  transaction_status: z.string(), payment_type: z.string(), status_code: z.string(), fraud_status: z.string().optional(),
  settlement_time: z.string().optional(), transaction_time: z.string(), refunds: z.array(refund).optional() });
export type StatusMidtrans = z.infer<typeof skemaStatusMidtrans>;
export type ParameterSnap = { transaction_details: { order_id: string; gross_amount: number };
    expiry: { unit: "minute"; duration: number }; page_expiry: { unit:"minute";duration:number } };
export interface GerbangMidtrans {
  buatSnap(data: ParameterSnap): Promise<{ token: string; redirect_url: string }>;
  status(orderId: string): Promise<unknown>;
  refund(orderId: string, data: { refund_key: string; amount: number; reason: string }): Promise<unknown>;
}
type CoreLengkap = { transaction: { status(id: string): Promise<unknown>;
  refund(id: string, data: { refund_key: string; amount: number; reason: string }): Promise<unknown> };
  httpClient: { http_client: { defaults: { timeout: number } } } };
// Deklarasi @types 1.4.0 belum mencakup transaction/status/refund SDK resmi.
export const gerbangMidtrans: GerbangMidtrans = {
  async buatSnap(data) {
    const snap = new midtrans.Snap(konfigurasi());
    (snap as unknown as Pick<CoreLengkap, "httpClient">).httpClient.http_client.defaults.timeout = 15000;
    try {
      const hasil = z.object({ token: z.string().min(1), redirect_url: z.url() }).parse(await snap.createTransaction(data));
      if (new URL(hasil.redirect_url).hostname !== "app.sandbox.midtrans.com") throw new Error("Host provider invalid");
      return hasil;
    } catch { throw new KesalahanMidtrans(503, "Pembayaran belum dapat disiapkan. Periksa status sebelum mencoba kembali."); }
  },
  async status(orderId) {
    const core = new midtrans.CoreApi(konfigurasi()) as unknown as CoreLengkap;
    core.httpClient.http_client.defaults.timeout = 15000;
    try { return await core.transaction.status(encodeURIComponent(orderId)); }
    catch(error) {
      if (kodeAman(error) === "HTTP_404") throw new KesalahanMidtrans(404, "Pembayaran belum ditemukan. Silakan periksa kembali beberapa saat lagi.");
      throw new KesalahanMidtrans(503, "Pembayaran belum dapat diverifikasi. Silakan coba beberapa saat lagi.");
    }
  },
  async refund(orderId, data) {
    const core = new midtrans.CoreApi(konfigurasi()) as unknown as CoreLengkap;
    core.httpClient.http_client.defaults.timeout = 15000;
    try { return await core.transaction.refund(encodeURIComponent(orderId), data); }
    catch { throw new KesalahanMidtrans(503, "Pengembalian dana belum dapat dipastikan. Periksa status sebelum mencoba kembali."); }
  },
};
