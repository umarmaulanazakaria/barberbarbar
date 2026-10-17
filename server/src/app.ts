import routerProfilPelanggan from "./routes/profil-pelanggan.routes.js";
import routerPembayaranOperasional, { routerNotifikasiOperasional } from "./routes/pembayaran-operasional.routes.js";
import routerTindakanDashboard from "./routes/tindakan-dashboard.routes.js";
import { kompatibilitasTeleponPelanggan } from "./middleware/telepon-pelanggan.middleware.js";
import routerGuest from "./routes/guest-booking.routes.js";
import routerManajemen from "./routes/manajemen.routes.js";
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
import routerAuthPelanggan from "./routes/auth-pelanggan.routes.js";
import routerPublik from "./routes/publik.routes.js";
import routerMembershipPelanggan from "./routes/membership-pelanggan.routes.js";
import routerPermohonanMembership from "./routes/permohonan-membership.routes.js";
import routerBooking from "./routes/booking.routes.js";
import routerOperasionalBooking from "./routes/operasional-booking.routes.js";
import routerMidtrans from "./routes/midtrans.routes.js";
import routerRefundBooking from "./routes/refund-booking.routes.js";
import routerPaymentCustomer from "./routes/payment-customer.routes.js";
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
aplikasi.use("/auth/customer", routerAuthPelanggan);
aplikasi.use("/public", routerPublik);
aplikasi.use("/guest/bookings",routerGuest);
aplikasi.use("/customer/membership", routerMembershipPelanggan);
aplikasi.use("/customer/bookings", routerBooking);
aplikasi.use("/bookings", autentikasi, kompatibilitasTeleponPelanggan, routerOperasionalBooking);
aplikasi.use("/midtrans", routerNotifikasiOperasional);
aplikasi.use("/midtrans",routerMidtrans);
aplikasi.use("/refund-requests",routerRefundBooking);
aplikasi.use("/customer",routerPaymentCustomer);
aplikasi.use("/membership-requests", routerPermohonanMembership);
aplikasi.use("/pelanggan", autentikasi, kompatibilitasTeleponPelanggan, routerPelanggan);
aplikasi.use("/customers", autentikasi, kompatibilitasTeleponPelanggan, routerPelanggan);
aplikasi.use("/barbers", autentikasi, routerBarber);
aplikasi.use("/layanan", autentikasi, routerLayanan);
aplikasi.use("/services", autentikasi, routerLayanan);
aplikasi.use("/memberships", autentikasi, kompatibilitasTeleponPelanggan, routerMembership);
aplikasi.use("/orders", autentikasi, kompatibilitasTeleponPelanggan, routerPesanan);
aplikasi.use("/management/customers", autentikasi, routerProfilPelanggan);
aplikasi.use("/management/payments", autentikasi, routerPembayaranOperasional);
aplikasi.use("/management/actions", autentikasi, routerTindakanDashboard);
aplikasi.use("/management", autentikasi, kompatibilitasTeleponPelanggan, routerManajemen);
aplikasi.use("/order-items", autentikasi, kompatibilitasTeleponPelanggan, routerItemPesanan);
aplikasi.use("/invoices", autentikasi, kompatibilitasTeleponPelanggan, routerInvoice);
aplikasi.use("/dashboard", autentikasi, routerDashboard);
aplikasi.use(tidakDitemukan);
aplikasi.use(tanganiKesalahan);
export default aplikasi;
