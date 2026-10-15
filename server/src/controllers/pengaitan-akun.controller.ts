import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

import {
  ambilDaftarPermohonan,
  setujuiPengaitanAkun,
  tolakPengaitanAkun,
} from "../services/pengaitan-akun.service.js";

const skemaId = z.coerce.number().int().positive();

const skemaPenolakan = z.object({
  catatanKeputusan: z.string().trim().max(500).optional(),
});

export const daftarPermohonanPengaitan = async (
  _permintaan: Request,
  respon: Response,
  lanjut: NextFunction,
) => {
  try {
    const data = await ambilDaftarPermohonan();
    return respon.status(200).json({ data });
  } catch (kesalahan) {
    lanjut(kesalahan);
  }
};

export const setujuiPermohonanPengaitan = async (
  permintaan: Request,
  respon: Response,
  lanjut: NextFunction,
) => {
  const hasilId = skemaId.safeParse(permintaan.params.id);

  if (!hasilId.success) {
    return respon.status(400).json({
      pesan: "ID permohonan tidak valid",
    });
  }

  if (!permintaan.pengguna || permintaan.pengguna.role !== "ADMIN") {
    return respon.status(403).json({
      pesan: "Akses hanya untuk ADMIN",
    });
  }

  try {
    const hasil = await setujuiPengaitanAkun(
      hasilId.data,
      permintaan.pengguna.id,
    );

    if (hasil.status === "TIDAK_DITEMUKAN") {
      return respon.status(404).json({
        pesan: "Permohonan tidak ditemukan",
      });
    }

    if (hasil.status !== "BERHASIL") {
      return respon.status(409).json({
        pesan: "Permohonan tidak dapat disetujui",
      });
    }

    return respon.status(200).json({
      pesan: "Permohonan disetujui dan akun pelanggan berhasil diaktifkan",
    });
  } catch (kesalahan) {
    lanjut(kesalahan);
  }
};

export const tolakPermohonanPengaitan = async (
  permintaan: Request,
  respon: Response,
  lanjut: NextFunction,
) => {
  const hasilId = skemaId.safeParse(permintaan.params.id);
  const hasilBody = skemaPenolakan.safeParse(permintaan.body);

  if (!hasilId.success || !hasilBody.success) {
    return respon.status(400).json({
      pesan: "Data penolakan tidak valid",
    });
  }

  if (!permintaan.pengguna || permintaan.pengguna.role !== "ADMIN") {
    return respon.status(403).json({
      pesan: "Akses hanya untuk ADMIN",
    });
  }

  try {
    const hasil = await tolakPengaitanAkun(
      hasilId.data,
      permintaan.pengguna.id,
      hasilBody.data.catatanKeputusan,
    );

    if (hasil.status !== "BERHASIL") {
      return respon.status(409).json({
        pesan: "Permohonan tidak ditemukan atau sudah diputuskan",
      });
    }

    return respon.status(200).json({
      pesan: "Permohonan pengaitan akun ditolak",
    });
  } catch (kesalahan) {
    lanjut(kesalahan);
  }
};
