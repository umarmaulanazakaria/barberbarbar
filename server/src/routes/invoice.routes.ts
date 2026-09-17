import { Router } from "express";
import { ambilInvoice } from "../controllers/pesanan.controller.js";
const routerInvoice = Router();
routerInvoice.get("/", ambilInvoice);
export default routerInvoice;
