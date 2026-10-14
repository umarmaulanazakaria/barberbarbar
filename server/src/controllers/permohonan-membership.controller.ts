import type { Request, Response } from "express";
import { z } from "zod";
import { ajukanMembershipPelanggan, daftarPermohonanMembership, putuskanPermohonanMembership,
  statusMembershipPelanggan } from "../services/permohonan-membership.service.js";

export const lihatMembershipSendiri = async (permintaan: Request, respon: Response) => {
  if (!permintaan.akunPelanggan) return respon.status(401).json({ pesan: "Pelanggan belum login" });
  return respon.json(await statusMembershipPelanggan(permintaan.akunPelanggan.pelangganId));
};
export const ajukanMembershipSendiri = async (permintaan: Request, respon: Response) => {
  if (!permintaan.akunPelanggan) return respon.status(401).json({ pesan: "Pelanggan belum login" });
  if (!z.object({}).strict().safeParse(permintaan.body ?? {}).success) {
    return respon.status(400).json({ pesan: "Pengajuan tidak memerlukan formulir atau identitas tambahan" });
  }
  const hasil = await ajukanMembershipPelanggan(permintaan.akunPelanggan.pelangganId);
  if (!hasil) return respon.status(409).json({ pesan: "Pengajuan membership tidak dapat diproses" });
  return respon.status(201).json({ pesan: "Pengajuan membership menunggu persetujuan ADMIN", permohonan: hasil });
};
export const lihatPermohonanMembership = async (_permintaan: Request, respon: Response) =>
  respon.json({ data: await daftarPermohonanMembership() });

const skemaKeputusan = z.object({ catatanKeputusan: z.string().trim().max(500).optional() }).strict();
const keputusan = (disetujui: boolean) => async (permintaan: Request, respon: Response) => {
  const id = z.coerce.number().int().positive().safeParse(permintaan.params.id);
  const body = skemaKeputusan.safeParse(permintaan.body ?? {});
  if (!id.success || !body.success) return respon.status(400).json({ pesan: "Data keputusan tidak valid" });
  if (permintaan.pengguna?.role !== "ADMIN") return respon.status(403).json({ pesan: "Akses hanya ADMIN" });
  const hasil = await putuskanPermohonanMembership(id.data, permintaan.pengguna.id, disetujui, body.data.catatanKeputusan);
  if (hasil !== "BERHASIL") return respon.status(hasil === "TIDAK_DITEMUKAN" ? 404 : 409).json({ pesan: "Permohonan tidak dapat diproses" });
  return respon.json({ pesan: disetujui ? "Permohonan membership disetujui" : "Permohonan membership ditolak" });
};
export const setujuiPermohonanMembership = keputusan(true);
export const tolakPermohonanMembership = keputusan(false);
