import { Router } from "express";
import {
  ambilSemua,
  ambilAktif,
  ambilRiwayat,
  ambilBerdasarkanId,
  tambah,
  ubahStatus,
  bayar,
} from "../controllers/pesanan.controller.js";

const routerPesanan = Router();
routerPesanan.get("/", ambilSemua);
routerPesanan.get("/active", ambilAktif);
routerPesanan.get("/history", ambilRiwayat);
routerPesanan.get("/:id", ambilBerdasarkanId);
routerPesanan.post("/", tambah);
routerPesanan.patch("/:id/status", ubahStatus);
routerPesanan.post("/:id/payment", bayar);
export default routerPesanan;
