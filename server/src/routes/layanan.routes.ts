import { Router } from "express";

import {
  ambilSemua,
  ambilBerdasarkanId,
  tambah,
  ubah,
  hapus,
} from "../controllers/layanan.controller.js";

import { hanyaAdmin } from "../middleware/role.middleware.js";

const routerLayanan = Router();

routerLayanan.get("/", ambilSemua);

routerLayanan.get("/:id", ambilBerdasarkanId);

routerLayanan.post("/", hanyaAdmin, tambah);

routerLayanan.patch("/:id", hanyaAdmin, ubah);

routerLayanan.delete("/:id", hanyaAdmin, hapus);

export default routerLayanan;