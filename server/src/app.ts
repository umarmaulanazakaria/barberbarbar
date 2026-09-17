import express from "express";
import routerPelanggan from "./routes/pelanggan.routes.js";
import routerAuth from "./routes/auth.routes.js";
import routerBarber from "./routes/barber.routes.js";
import routerLayanan from "./routes/layanan.routes.js";
import routerMembership from "./routes/membership.routes.js";
import routerPesanan from "./routes/pesanan.routes.js";
import routerInvoice from "./routes/invoice.routes.js";
import routerDashboard from "./routes/dashboard.routes.js";
import routerItemPesanan from "./routes/item-pesanan.routes.js";
import { autentikasi } from "./middleware/auth.middleware.js";
import {
  tidakDitemukan,
  tanganiKesalahan,
} from "./middleware/error.middleware.js";

const aplikasi = express();
aplikasi.use(express.json());
aplikasi.get("/", (_req, res) =>
  res.json({ pesan: "Barbershop Management API berjalan" }),
);
aplikasi.use("/auth", routerAuth);
aplikasi.use("/pelanggan", autentikasi, routerPelanggan);
aplikasi.use("/customers", autentikasi, routerPelanggan);
aplikasi.use("/barbers", autentikasi, routerBarber);
aplikasi.use("/layanan", autentikasi, routerLayanan);
aplikasi.use("/services", autentikasi, routerLayanan);
aplikasi.use("/memberships", autentikasi, routerMembership);
aplikasi.use("/orders", autentikasi, routerPesanan);
aplikasi.use("/order-items", autentikasi, routerItemPesanan);
aplikasi.use("/invoices", autentikasi, routerInvoice);
aplikasi.use("/dashboard", autentikasi, routerDashboard);
aplikasi.use(tidakDitemukan);
aplikasi.use(tanganiKesalahan);
export default aplikasi;
