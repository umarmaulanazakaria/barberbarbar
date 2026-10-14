import { Router } from "express";
import { autentikasiPelanggan } from "../middleware/auth-pelanggan.middleware.js";
import { ajukanMembershipSendiri, lihatMembershipSendiri } from "../controllers/permohonan-membership.controller.js";
const router = Router();
router.use(autentikasiPelanggan);
router.get("/", lihatMembershipSendiri);
router.post("/requests", ajukanMembershipSendiri);
export default router;
