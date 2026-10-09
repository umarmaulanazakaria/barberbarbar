import { Router } from "express";

import { daftarPelanggan } from "../controllers/auth-pelanggan.controller.js";

import {
  daftarPermohonanPengaitan,
  setujuiPermohonanPengaitan,
  tolakPermohonanPengaitan,
} from "../controllers/pengaitan-akun.controller.js";

import { autentikasi } from "../middleware/auth.middleware.js";
import { hanyaAdmin } from "../middleware/role.middleware.js";

const routerAuthPelanggan = Router();

routerAuthPelanggan.post("/register", daftarPelanggan);

routerAuthPelanggan.get(
  "/requests",
  autentikasi,
  hanyaAdmin,
  daftarPermohonanPengaitan,
);

routerAuthPelanggan.post(
  "/requests/:id/approve",
  autentikasi,
  hanyaAdmin,
  setujuiPermohonanPengaitan,
);

routerAuthPelanggan.post(
  "/requests/:id/reject",
  autentikasi,
  hanyaAdmin,
  tolakPermohonanPengaitan,
);

export default routerAuthPelanggan;
