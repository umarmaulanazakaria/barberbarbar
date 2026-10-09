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
import { batasiPercobaanPelanggan } from "../middleware/batas-percobaan-pelanggan.middleware.js";
import {
  lupaPasswordPelanggan,
  aturUlangPasswordPelanggan,
} from "../controllers/reset-password-pelanggan.controller.js";

const routerAuthPelanggan = Router();

routerAuthPelanggan.post("/register", batasiPercobaanPelanggan(20), daftarPelanggan);
routerAuthPelanggan.post("/login", batasiPercobaanPelanggan(20), masukPelanggan);
routerAuthPelanggan.post("/forgot-password", batasiPercobaanPelanggan(10), lupaPasswordPelanggan);
routerAuthPelanggan.post("/reset-password", batasiPercobaanPelanggan(30), aturUlangPasswordPelanggan);

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
