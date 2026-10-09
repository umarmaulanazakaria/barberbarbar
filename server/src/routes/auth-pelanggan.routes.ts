import { Router } from "express";

import { daftarPelanggan } from "../controllers/auth-pelanggan.controller.js";

const routerAuthPelanggan = Router();

routerAuthPelanggan.post("/register", daftarPelanggan);

export default routerAuthPelanggan;
