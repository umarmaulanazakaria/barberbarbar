import { Router } from "express";
import {hanyaAdmin} from "../middleware/role.middleware.js";
import {z} from "zod";
import {gantiKodeAdmin} from "../services/tracking-booking.service.js";
import {KesalahanPembayaranBooking} from "../services/pembayaran-booking.service.js";
import { daftarOperasionalBooking, detailOperasionalBooking, konfirmasiOperasionalBooking, tolakOperasionalBooking,
  usulanOperasionalBooking, checkInOperasionalBooking, mulaiOperasionalBooking, selesaiOperasionalBooking,
  ubahLayananOperasionalBooking } from "../controllers/operasional-booking.controller.js";
import { pembayaranOperator, pelunasanOperator, finalisasiInvoiceOperator } from "../controllers/pembayaran-booking.controller.js";
const router = Router();
router.post("/:id/tracking/reissue",hanyaAdmin,async(req,res)=>{
 const id=z.coerce.number().int().positive().safeParse(req.params.id),body=z.object({identitasDiverifikasi:z.literal(true),alasan:z.string().trim().min(20).max(300).refine(s=>!/(?:BB(?:[-\s]?[0-9A-F]){32}|[a-f0-9]{64})/i.test(s))}).strict().safeParse(req.body);
 if(!id.success||!body.success)return res.status(400).json({pesan:"Verifikasi identitas dan alasan pemulihan wajib diisi."});
 res.set({"Cache-Control":"no-store","Referrer-Policy":"no-referrer"});
 try{res.json(await gantiKodeAdmin(id.data,req.pengguna!.id,body.data.alasan))}catch(e){if(e instanceof KesalahanPembayaranBooking)return res.status(e.kode).json({pesan:e.message});res.status(503).json({pesan:"Pemulihan kode belum tersedia."});}
});
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
