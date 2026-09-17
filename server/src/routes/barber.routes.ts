import { Router } from "express";

import {
  ambilSemua,
  ambilSemuaDenganAkun,
  ambilBerdasarkanId,
  tambah,
  ubah,
  hapus,
  buatAkun,
} from "../controllers/barber.controller.js";

import { hanyaAdmin } from "../middleware/role.middleware.js";

const routerBarber = Router();

routerBarber.get("/", ambilSemua);

routerBarber.get("/staff-accounts", hanyaAdmin, ambilSemuaDenganAkun);

routerBarber.get("/:id", ambilBerdasarkanId);

routerBarber.post("/", hanyaAdmin, tambah);

routerBarber.post("/:id/account", hanyaAdmin, buatAkun);

routerBarber.patch("/:id", hanyaAdmin, ubah);

routerBarber.delete("/:id", hanyaAdmin, hapus);

export default routerBarber;
