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

routerMembership.post("/", tambah);

routerMembership.patch("/:id", hanyaAdmin, ubah);

routerMembership.delete("/:id", hanyaAdmin, hapus);

export default routerMembership;
