import { Router } from "express";
import { pesananTerpadu } from "../controllers/pesanan-terpadu.controller.js";
const router = Router(); router.get("/orders", pesananTerpadu); export default router;
