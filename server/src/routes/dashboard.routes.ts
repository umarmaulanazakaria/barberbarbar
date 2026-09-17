import { Router } from "express";
import { dashboard, laporan } from "../controllers/dashboard.controller.js";
const routerDashboard = Router();
routerDashboard.get("/", dashboard);
routerDashboard.get("/reports", laporan);
export default routerDashboard;
