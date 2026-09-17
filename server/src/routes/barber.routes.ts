import { Router } from "express";

import {
  ambilSemua,
  ambilBerdasarkanId,
  tambah,
  ubah,
  hapus,
} from "../controllers/barber.controller.js";

import { hanyaAdmin } from "../middleware/role.middleware.js";

const routerBarber = Router();

routerBarber.get("/", ambilSemua);

routerBarber.get("/:id", ambilBerdasarkanId);

routerBarber.post("/", hanyaAdmin, tambah);

routerBarber.patch("/:id", hanyaAdmin, ubah);

routerBarber.delete("/:id", hanyaAdmin, hapus);

export default routerBarber;