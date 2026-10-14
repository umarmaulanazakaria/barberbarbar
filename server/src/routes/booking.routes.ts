import { Router } from "express";
import { autentikasiPelanggan } from "../middleware/auth-pelanggan.middleware.js";
import { buatBooking, daftarBooking, detailBooking } from "../controllers/booking.controller.js";
const routerBooking = Router();
routerBooking.use(autentikasiPelanggan);
routerBooking.post("/", buatBooking);
routerBooking.get("/", daftarBooking);
routerBooking.get("/:id", detailBooking);
export default routerBooking;
