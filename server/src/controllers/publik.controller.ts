import type { Request, Response } from "express";
import { ambilBarberPublik, ambilLayananPublik } from "../services/publik.service.js";

export const daftarLayananPublik = async (_permintaan: Request, respon: Response) =>
  respon.json(await ambilLayananPublik());

export const daftarBarberPublik = async (_permintaan: Request, respon: Response) =>
  respon.json(await ambilBarberPublik());
