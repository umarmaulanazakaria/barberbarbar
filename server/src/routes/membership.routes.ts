import { Router } from "express";

import {
  ambilSemua,
  ambilBerdasarkanId,
  tambah,
  ubah,
  hapus,
} from "../controllers/membership.controller.js";

import { hanyaAdmin } from "../middleware/role.middleware.js";

const routerMembership = Router();

routerMembership.get("/", ambilSemua);

routerMembership.get("/:id", ambilBerdasarkanId);

routerMembership.post("/", hanyaAdmin, (_req,res)=>res.status(409).json({pesan:"Gunakan penjualan Membership berbayar pada Menu Membership."}));

routerMembership.patch("/:id", hanyaAdmin, ubah);

routerMembership.delete("/:id", hanyaAdmin, (_req,res)=>res.status(405).json({pesan:"Nomor Member dan riwayat pembayaran bersifat permanen."}));

export default routerMembership;
