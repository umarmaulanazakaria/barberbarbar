import { Router } from "express";
import { autentikasi } from "../middleware/auth.middleware.js";
import { hanyaAdmin } from "../middleware/role.middleware.js";
import { refundAdmin, putuskanRefundAdmin, retryRefundAdmin } from "../controllers/midtrans-booking.controller.js";
const router=Router();router.use(autentikasi,hanyaAdmin);
router.get("/",refundAdmin);router.post("/:id/approve",putuskanRefundAdmin(true));
router.post("/:id/reject",putuskanRefundAdmin(false));router.post("/:id/retry",retryRefundAdmin);
export default router;
