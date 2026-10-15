import type { Request, Response } from "express";
import { z } from "zod";
import { skemaBuatBooking } from "../schemas/booking.schema.js";
import { buatBookingPelanggan, daftarBookingSendiri, detailBookingSendiri } from "../services/booking.service.js";
export const buatBooking = async (permintaan: Request, respon: Response) => {
  if (!permintaan.akunPelanggan) return respon.status(401).json({ pesan: "Pelanggan belum login" });
  const validasi = skemaBuatBooking.safeParse(permintaan.body);
  if (!validasi.success) return respon.status(400).json({ pesan: "Data booking tidak valid" });
  const hasil = await buatBookingPelanggan(permintaan.akunPelanggan.pelangganId, validasi.data);
  if (hasil.status === "BERHASIL") return respon.status(201).json({ booking: hasil.booking });
  const kode = hasil.status === "AKUN_TIDAK_AKTIF" ? 401 : hasil.status === "JADWAL_TIDAK_TERSEDIA" ? 409 : 400;
  const pesan = hasil.status === "JADWAL_TIDAK_TERSEDIA" ? "Jadwal booking tidak tersedia" :
    hasil.status === "WAKTU_TIDAK_VALID" ? "Waktu booking tidak memenuhi ketentuan operasional" : "Booking tidak dapat diproses";
  return respon.status(kode).json({ pesan });
};
export const daftarBooking = async (permintaan: Request, respon: Response) => {
  if (!permintaan.akunPelanggan) return respon.status(401).json({ pesan: "Pelanggan belum login" });
  return respon.json({ data: await daftarBookingSendiri(permintaan.akunPelanggan.pelangganId) });
};
export const detailBooking = async (permintaan: Request, respon: Response) => {
  if (!permintaan.akunPelanggan) return respon.status(401).json({ pesan: "Pelanggan belum login" });
  const id = z.coerce.number().int().positive().safeParse(permintaan.params.id);
  if (!id.success) return respon.status(400).json({ pesan: "ID booking tidak valid" });
  const hasil = await detailBookingSendiri(permintaan.akunPelanggan.pelangganId, id.data);
  if (!hasil) return respon.status(404).json({ pesan: "Booking tidak ditemukan" });
  return respon.json({ booking: hasil });
};
