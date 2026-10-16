import type { Request, Response } from "express";
import { ambilBarberPublik, ambilLayananPublik } from "../services/publik.service.js";
import {kesiapanBookingWeb} from "../services/tracking-booking.service.js";

export const kesiapanBookingPublik=async(_req:Request,res:Response)=>{
 const tersedia=await kesiapanBookingWeb();res.set("Cache-Control","no-store").json({tersedia,...(!tersedia?{pesan:"Booking online sedang tidak tersedia. Silakan coba lagi nanti atau hubungi Admin."}:{})});
};

export const daftarLayananPublik = async (_permintaan: Request, respon: Response) =>
  respon.json(await ambilLayananPublik());

export const daftarBarberPublik = async (_permintaan: Request, respon: Response) =>
  respon.json(await ambilBarberPublik());
