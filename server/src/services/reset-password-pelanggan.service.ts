import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import basisData from "../lib/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const kunciAkun = (transaksi: Prisma.TransactionClient, id: number) =>
  transaksi.$queryRaw<Array<{ id: number }>>`
    SELECT "id" FROM "AkunPelanggan" WHERE "id" = ${id} FOR UPDATE
  `;

// Token asli hanya dikembalikan ke pemanggil internal, bukan endpoint publik.
export const buatTokenResetPelanggan = async (email: string) => {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const akun = await basisData.akunPelanggan.findFirst({
    where: { email: { equals: email.trim().toLowerCase(), mode: "insensitive" } },
    select: { id: true },
  });
  if (!akun) return null;

  return basisData.$transaction(async (transaksi) => {
    // Penerbitan dan reset mengambil lock akun yang sama, dengan urutan sama.
    if ((await kunciAkun(transaksi, akun.id)).length !== 1) return null;
    const kedaluwarsaPada = new Date(Date.now() + 30 * 60 * 1000);
    await transaksi.passwordResetToken.create({
      data: { akunPelangganId: akun.id, tokenHash, kedaluwarsaPada },
    });
    return { token, kedaluwarsaPada };
  });
};

export const resetPasswordPelanggan = async (token: string, password: string) => {
  const tokenHash = hashToken(token);
  const tokenTersimpan = await basisData.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { akunPelangganId: true, digunakanPada: true, kedaluwarsaPada: true },
  });
  if (!tokenTersimpan || tokenTersimpan.digunakanPada ||
      tokenTersimpan.kedaluwarsaPada <= new Date()) return false;

  const passwordHash = await bcrypt.hash(password, 12);
  return basisData.$transaction(async (transaksi) => {
    if ((await kunciAkun(transaksi, tokenTersimpan.akunPelangganId)).length !== 1) {
      return false;
    }
    const sekarang = new Date();
    // Validasi ulang setelah lock: hanya satu request dapat mengklaim token.
    const klaim = await transaksi.passwordResetToken.updateMany({
      where: { tokenHash, digunakanPada: null, kedaluwarsaPada: { gt: sekarang } },
      data: { digunakanPada: sekarang },
    });
    if (klaim.count !== 1) return false;

    await transaksi.akunPelanggan.update({
      where: { id: tokenTersimpan.akunPelangganId },
      data: { passwordHash },
    });
    // Kolom existing juga menandai token lain sebagai tidak dapat digunakan.
    await transaksi.passwordResetToken.updateMany({
      where: { akunPelangganId: tokenTersimpan.akunPelangganId, digunakanPada: null },
      data: { digunakanPada: sekarang },
    });
    return true;
  });
};
