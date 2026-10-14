import { Router } from "express";
import { webhookMidtrans } from "../controllers/midtrans-booking.controller.js";
const router=Router();
router.post("/notifications",webhookMidtrans);
export default router;
