import { z } from "zod";
export const skemaTambahItemPesanan=z.object({pesananId:z.number().int().positive(),layananId:z.number().int().positive(),qty:z.number().int().positive().max(20).default(1)});
export const skemaUbahItemPesanan=z.object({layananId:z.number().int().positive().optional(),qty:z.number().int().positive().max(20).optional()});
