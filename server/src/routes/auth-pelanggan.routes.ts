import { Router } from "express";

import {
  daftarPelanggan,
  masukPelanggan,
} from "../controllers/auth-pelanggan.controller.js";

import {
  daftarPermohonanPengaitan,
  setujuiPermohonanPengaitan,
  tolakPermohonanPengaitan,
} from "../controllers/pengaitan-akun.controller.js";

import { autentikasiPelanggan } from "../middleware/auth-pelanggan.middleware.js";
import { profilPelanggan } from "../controllers/auth-pelanggan.controller.js";
import { perbaruiProfilPelanggan } from "../controllers/auth-pelanggan.controller.js";

import { autentikasi } from "../middleware/auth.middleware.js";
import { hanyaAdmin } from "../middleware/role.middleware.js";
import {
  lupaPasswordPelanggan,
  aturUlangPasswordPelanggan,
} from "../controllers/reset-password-pelanggan.controller.js";

const routerAuthPelanggan = Router();

routerAuthPelanggan.post("/register", daftarPelanggan);
routerAuthPelanggan.post("/login", masukPelanggan);
routerAuthPelanggan.post("/forgot-password", lupaPasswordPelanggan);
routerAuthPelanggan.post("/reset-password", aturUlangPasswordPelanggan);

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

routerAuthPelanggan.get("/me", autentikasiPelanggan, profilPelanggan);

routerAuthPelanggan.patch("/me", autentikasiPelanggan, perbaruiProfilPelanggan);

export default routerAuthPelanggan;
