import { Router } from "express";
import { daftarOperasionalBooking, detailOperasionalBooking, konfirmasiOperasionalBooking, tolakOperasionalBooking,
  usulanOperasionalBooking, checkInOperasionalBooking, mulaiOperasionalBooking, selesaiOperasionalBooking,
  ubahLayananOperasionalBooking } from "../controllers/operasional-booking.controller.js";
const router = Router();
router.get("/", daftarOperasionalBooking);
router.get("/:id", detailOperasionalBooking);
router.post("/:id/confirm", konfirmasiOperasionalBooking);
router.post("/:id/reject", tolakOperasionalBooking);
router.post("/:id/barber-proposals", usulanOperasionalBooking);
router.post("/:id/check-in", checkInOperasionalBooking);
router.post("/:id/start", mulaiOperasionalBooking);
router.post("/:id/complete", selesaiOperasionalBooking);
router.put("/:id/services", ubahLayananOperasionalBooking);
export default router;
