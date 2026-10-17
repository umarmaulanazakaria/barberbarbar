import { Router } from "express";
import { pesananTerpadu } from "../controllers/pesanan-terpadu.controller.js";
import { dashboardFinal } from "../controllers/dashboard-final.controller.js";
const router = Router();
router.get("/orders", pesananTerpadu);
router.get("/dashboard", dashboardFinal);
export default router;
