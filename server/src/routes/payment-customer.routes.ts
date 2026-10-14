import { Router } from "express";
import { autentikasiPelanggan } from "../middleware/auth-pelanggan.middleware.js";
import { sinkronCustomer, refundCustomer } from "../controllers/midtrans-booking.controller.js";
const router=Router();router.use(autentikasiPelanggan);
router.post("/payments/:id/sync",sinkronCustomer);router.get("/refunds",refundCustomer);
export default router;
