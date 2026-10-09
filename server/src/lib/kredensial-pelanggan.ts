import { createHmac } from "node:crypto";

// Sidik terikat secret dan hash saat login; reset mencabut semua JWT lama.
export const sidikKredensialPelanggan = (passwordHash: string, secret: string) =>
  createHmac("sha256", secret).update(`customer:${passwordHash}`).digest("hex");
