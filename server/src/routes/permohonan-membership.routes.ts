import { Router } from "express";
import { autentikasi } from "../middleware/auth.middleware.js";
import { hanyaAdmin } from "../middleware/role.middleware.js";
import { lihatPermohonanMembership, setujuiPermohonanMembership,
  tolakPermohonanMembership } from "../controllers/permohonan-membership.controller.js";
const router = Router();
router.use(autentikasi, hanyaAdmin);
router.get("/", lihatPermohonanMembership);
router.post("/:id/approve", setujuiPermohonanMembership);
router.post("/:id/reject", tolakPermohonanMembership);
export default router;
