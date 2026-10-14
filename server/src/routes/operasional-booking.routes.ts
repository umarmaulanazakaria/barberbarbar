import { Router } from "express";
import { daftarOperasionalBooking, detailOperasionalBooking, konfirmasiOperasionalBooking, tolakOperasionalBooking,
  usulanOperasionalBooking, checkInOperasionalBooking, mulaiOperasionalBooking, selesaiOperasionalBooking,
  ubahLayananOperasionalBooking } from "../controllers/operasional-booking.controller.js";
import { pembayaranOperator, pelunasanOperator, finalisasiInvoiceOperator } from "../controllers/pembayaran-booking.controller.js";
const router = Router();
import { noShowOperasionalBooking } from "../controllers/operasional-booking.controller.js";
router.get("/", daftarOperasionalBooking);
router.get("/:id", detailOperasionalBooking);
router.post("/:id/confirm", konfirmasiOperasionalBooking);
router.post("/:id/reject", tolakOperasionalBooking);
router.post("/:id/barber-proposals", usulanOperasionalBooking);
router.post("/:id/check-in", checkInOperasionalBooking);
router.post("/:id/start", mulaiOperasionalBooking);
router.post("/:id/complete", selesaiOperasionalBooking);
router.put("/:id/services", ubahLayananOperasionalBooking);
router.get("/:id/payments", pembayaranOperator);
router.post("/:id/payments/settlement", pelunasanOperator);
router.post("/:id/payments/finalize-invoice", finalisasiInvoiceOperator);
router.post("/:id/no-show",noShowOperasionalBooking);
export default router;
