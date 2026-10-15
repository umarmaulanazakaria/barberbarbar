import { Router } from "express";
import { daftarBarberPublik, daftarLayananPublik } from "../controllers/publik.controller.js";

const routerPublik = Router();
routerPublik.get("/services", daftarLayananPublik);
routerPublik.get("/barbers", daftarBarberPublik);

export default routerPublik;
