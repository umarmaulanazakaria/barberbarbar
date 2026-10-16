import { Router } from "express";
import { daftarBarberPublik, daftarLayananPublik,kesiapanBookingPublik } from "../controllers/publik.controller.js";
import {batasiPercobaanPelanggan} from "../middleware/batas-percobaan-pelanggan.middleware.js";

const routerPublik = Router();
routerPublik.get("/booking-availability",batasiPercobaanPelanggan(120),kesiapanBookingPublik);
routerPublik.get("/services", daftarLayananPublik);
routerPublik.get("/barbers", daftarBarberPublik);

export default routerPublik;
