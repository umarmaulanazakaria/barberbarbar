import type { Request, Response } from "express";
import { ambilDashboardFinal, skemaDashboard } from "../services/dashboard-final.service.js";
export const dashboardFinal=async(req:Request,res:Response)=>{
  res.set("Cache-Control","no-store");
  const filter=skemaDashboard.safeParse(req.query);
  if(!filter.success)return res.status(400).json({pesan:"Filter dashboard tidak valid."});
  return res.json(await ambilDashboardFinal(filter.data));
};
