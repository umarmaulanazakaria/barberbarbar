import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";

const hasil = await build({ stdin: { contents: `export * from './src/lib/sinkronisasi-realtime'; export * from './src/lib/booking'; export { AuthProvider } from './src/context/AuthContext'; export { ToastProvider } from './src/context/ToastContext'; export { default as BookingPage } from './src/pages/BookingPage'; export { default as DetailBookingPage } from './src/pages/DetailBookingPage'; export { default as RefundPage } from './src/pages/RefundPage'; export { default as OrderDetailModal } from './src/components/OrderDetailModal'; export { default as PaymentModal } from './src/components/PaymentModal'; export { default as PermohonanMembershipAdmin } from './src/components/PermohonanMembershipAdmin';`, resolveDir: process.cwd(), sourcefile: "pengujian-web.ts" }, bundle: true, write: false, platform: "node", format: "esm", packages: "external", jsx: "automatic" });
const file = path.resolve("node_modules/.cache/pengujian-web.mjs");
await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, hasil.outputFiles[0].text);
let total = 0, server, stop, sub;
const pass = pesan => { total++; console.log(`PASS WEB: ${pesan}`); };
const delay = ms => new Promise(r => setTimeout(r, ms));
const wait = async test => { for (let i = 0; i < 100; i++) { if (test()) return; await delay(20); } throw new Error("TIMEOUT_WEB"); };
try {
  const mod = await import(pathToFileURL(file).href);
  const b = { id: 1, nomorBooking: "BOOKING-DUMMY", status: "PENDING_CONFIRMATION", mulaiPada: new Date(Date.now() + 86400000).toISOString(), selesaiPada: new Date(Date.now() + 88200000).toISOString(), zonaWaktu: "Asia/Jakarta", durasiMenit: 30, dibuatPada: new Date().toISOString(), barberPilihanId: null, barberDisetujuiId: null, barberFinalId: null, pesananId: null, subtotal: 10000, diskon: 0, discountPercent: 0, total: 10000, nominalDp: 5000, pelanggan: { id: 1, nama: "Customer dummy" }, riwayat: [], usulanBarber: [], items: [{ layananId: 1, namaLayanan: "Layanan dummy", harga: 10000, qty: 1, durasiMenit: 30, subtotal: 10000 }] };
  const uang = { subtotal: 10000, diskon: 0, total: 10000, jumlahDibayar: 5000, balance: 5000, kelebihan: 0, nominalDpAwal: 5000, dpTerverifikasi: true, statusPembayaran: "DP_PAID", invoiceSementara: true, invoice: null, transaksi: [] };
  assert.equal(mod.izinBooking(b, uang).konfirmasi, true);
  assert.equal(mod.izinBooking(b, uang, mod.batasKonfirmasi(b)).konfirmasi, false);
  for (const status of ["REJECTED", "CANCELLED", "NO_SHOW", "COMPLETED"]) assert.equal(mod.izinBooking({ ...b, status }, uang).konfirmasi, false);
  const lama = { ...b, dibuatPada: new Date(Date.now() - 3600000).toISOString(), riwayat: [{ aksi: "RESCHEDULE", dibuatPada: new Date().toISOString() }] };
  assert.equal(mod.izinBooking(lama, uang).konfirmasi, true);
  pass("Batas konfirmasi >=30 menit, terminal dan round reschedule");
  assert.equal(mod.izinBooking({ ...b, status: "CONFIRMED" }, uang).checkIn, true);
  assert.equal(mod.izinBooking({ ...b, status: "CONFIRMED" }, { ...uang, dpTerverifikasi: false }).checkIn, false);
  assert.equal(mod.izinBooking({ ...b, status: "CHECKED_IN", usulanBarber: [{ status: "PENDING" }] }, uang).mulai, false);
  assert.equal(mod.izinBooking({ ...b, status: "CHECKED_IN", usulanBarber: [{ status: "APPROVED" }] }, uang).mulai, true);
  assert.equal(mod.izinBooking({ ...b, status: "IN_SERVICE" }, uang).ubahLayanan, true);
  assert.equal(mod.izinBooking({ ...b, status: "COMPLETED" }, uang).ubahLayanan, false);
  pass("DP, early check-in, consent barber, IN_SERVICE dan perubahan layanan");
  assert.equal(mod.izinBooking({ ...b, status: "COMPLETED" }, { ...uang, statusPembayaran: "OVERDUE" }).lunasi, true);
  assert.equal(mod.izinBooking({ ...b, status: "IN_SERVICE" }, uang).lunasi, false);
  assert.equal(mod.izinBooking({ ...b, status: "COMPLETED" }, { ...uang, balance: 0 }).lunasi, false);
  assert.equal(mod.izinBooking({ ...b, status: "COMPLETED" }, { ...uang, transaksi: [{ tujuan: "PELUNASAN", status: "PENDING" }] }).lunasi, false);
  for (const status of ["PROCESSING", "SUCCEEDED", "UNSUPPORTED", "REJECTED", "PENDING_APPROVAL"]) assert.equal(mod.bolehRetryRefund(status), false);
  assert.equal(mod.bolehRetryRefund("FAILED"), true);
  pass("Pelunasan COMPLETED/OVERDUE, pending online, lunas dan refund tanpa retry PROCESSING");

  const signal = { id: 1, aksi: "UPDATE", versi: "100", waktu: new Date().toISOString(), refetch: true };
  for (const jenis of mod.jenisSinyal) {
    const keys = mod.querySinyal(jenis, signal, "ADMIN");
    assert.ok(keys.length > 0); assert.ok(keys.every(k => k.length > 0));
    assert.ok(!mod.querySinyal(jenis, signal, "STAFF").some(k => ["refund-requests", "membership-requests", "account-link-requests"].includes(k[0])));
  }
  assert.ok(mod.querySinyal("catalog.changed", { ...signal, aksi: "Barber_UPDATE" }, "ADMIN").some(k => k[0] === "barbers"));
  assert.ok(!mod.querySinyal("catalog.changed", { ...signal, aksi: "Barber_UPDATE" }, "ADMIN").some(k => k[0] === "services"));
  pass("Delapan event ke query terarah, catalog case dan pembatasan STAFF");

  class SocketFixture extends EventEmitter { connected = false; auth = { token: "dummy" }; connect() { this.connected = true; this.emit("connect"); return this; } disconnect() { this.connected = false; return this; } }
  const win = new EventTarget(), doc = new EventTarget(); doc.visibilityState = "visible";
  const klien = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidasi = [], asli = klien.invalidateQueries.bind(klien);
  klien.invalidateQueries = (...args) => { invalidasi.push(args[0].queryKey); return asli(...args); };
  let versi = 1, panggilan = 0;
  server = createServer((req, res) => { panggilan++; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ data: [{ ...b, nomorBooking: `REST-${versi}` }] })); });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const observer = new QueryObserver(klien, { queryKey: ["bookings"], queryFn: async () => (await (await fetch(`http://127.0.0.1:${server.address().port}`)).json()).data });
  sub = observer.subscribe(() => {}); await wait(() => observer.getCurrentResult().data);
  klien.setQueryData(["unrelated-private"], "untouched");
  const socket = new SocketFixture(); stop = mod.mulaiRealtimeOperator("dummy", "ADMIN", klien, win, doc, () => socket);
  await delay(50); invalidasi.length = 0; versi = 2;
  socket.emit("booking.changed", signal); socket.emit("booking.changed", signal);
  await wait(() => observer.getCurrentResult().data?.[0].nomorBooking === "REST-2");
  assert.equal(invalidasi.filter(k => k[0] === "bookings").length, 1);
  assert.equal(klien.getQueryState(["unrelated-private"]).isInvalidated, false);
  pass("Booking muncul dari REST setelah event tanpa refresh manual; dedup dan cache unrelated tetap utuh");
  invalidasi.length = 0; socket.emit("booking.changed", { ...signal, id: -1 }); await delay(120); assert.equal(invalidasi.length, 0);
  versi = 3; socket.emit("realtime.ready", { refetch: true }); await wait(() => observer.getCurrentResult().data?.[0].nomorBooking === "REST-3");
  await delay(1600); versi = 4; win.dispatchEvent(new Event("focus")); await wait(() => observer.getCurrentResult().data?.[0].nomorBooking === "REST-4");
  pass("Payload invalid diabaikan; reconnect/LISTEN ready dan foreground refetch REST");
  win.dispatchEvent(new Event("auth:session-changing")); assert.equal(socket.connected, false); assert.deepEqual(socket.auth, {}); assert.equal(socket.eventNames().length, 0);
  invalidasi.length = 0; socket.emit("booking.changed", { ...signal, versi: "200" }); win.dispatchEvent(new Event("focus")); await delay(120); assert.equal(invalidasi.length, 0);
  stop(); const kedua = new SocketFixture(); stop = mod.mulaiRealtimeOperator("dummy2", "STAFF", klien, win, doc, () => kedua); assert.equal(kedua.listenerCount("booking.changed"), 1);
  win.dispatchEvent(new Event("auth:logout")); assert.equal(kedua.connected, false); assert.equal(kedua.eventNames().length, 0);
  versi = 5; await observer.refetch(); assert.equal(observer.getCurrentResult().data[0].nomorBooking, "REST-5"); assert.ok(panggilan >= 5);
  pass("Ganti akun/logout/unmount melepas listener/token; REST tetap beroperasi setelah socket terputus");

  // Rendering komponen server-side, bukan klaim browser E2E.
  globalThis.localStorage = { getItem: key => key === "barber_user" ? JSON.stringify({ id: 1, name: "Operator dummy", role: roleSaatIni }) : null };
  let roleSaatIni = "ADMIN";
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  qc.setQueryData(["bookings"], [b]); qc.setQueryData(["booking", 1], b); qc.setQueryData(["booking-payments", 1], uang);
  qc.setQueryData(["barbers"], [{ id: 1, nama: "Barber dummy", aktif: true }]); qc.setQueryData(["services"], [{ id: 1, nama: "Layanan dummy", aktif: true, harga: 10000 }]);
  const render = component => renderToStaticMarkup(React.createElement(QueryClientProvider, { client: qc }, React.createElement(MemoryRouter, null, React.createElement(mod.AuthProvider, null, React.createElement(mod.ToastProvider, null, component)))));
  let html = render(React.createElement(mod.BookingPage)); assert.ok(html.includes("Customer dummy") && html.includes("BOOKING-DUMMY"));
  qc.setQueryData(["refund-requests"], [{ id: 99, bookingId: 1, nominal: 2000, status: "PROCESSING", alasan: "Dummy", dibuatPada: new Date().toISOString(), kodeProvider: "202" }]);
  html = render(React.createElement(mod.RefundPage)); assert.ok(html.includes("Sedang Diproses") && html.includes("Tunggu konfirmasi sebelum mencoba kembali")); assert.ok(!html.includes("Periksa dan coba kembali") && !html.includes("Setujui pengembalian dana"));
  roleSaatIni = "STAFF"; html = render(React.createElement(mod.RefundPage)); assert.ok(html.includes("hanya dapat dikelola admin")); assert.ok(!html.includes("202"));
  roleSaatIni = "ADMIN";
  const order = { id: 1, nomorPesanan: "ORDER-DUMMY", status: "IN_SERVICE", statusPembayaran: "UNPAID", checkInTime: new Date().toISOString(), dibuatPada: new Date().toISOString(), pelanggan: { nama: "Customer dummy", nomorTelepon: "Dummy" }, barber: null, items: b.items.map(i => ({ ...i, id: i.layananId })), subtotal: 10000, total: 10000, diskon: 0, discountPercent: 0, pembayaran: null, riwayatStatus: [], booking: { id: 1, nomorBooking: b.nomorBooking } };
  qc.setQueryData(["order", 1], order);
  html = render(React.createElement(mod.OrderDetailModal, { orderId: 1, onClose() {} })); assert.ok(html.includes("Kelola booking")); assert.ok(!html.includes("Selesaikan Layanan") && !html.includes("Buka Pembayaran"));
  assert.ok(!render(React.createElement(mod.PaymentModal, { order, open: true, onClose() {} })).includes("Jumlah Diterima"));
  qc.setQueryData(["order", 1], { ...order, booking: null }); html = render(React.createElement(mod.OrderDetailModal, { orderId: 1, onClose() {} })); assert.ok(html.includes("Selesaikan Layanan"));
  pass("Render UI booking/refund PROCESSING, STAFF ditolak, pesanan booking dialihkan dan walk-in dipertahankan");
  const renderDetail = () => renderToStaticMarkup(React.createElement(QueryClientProvider, { client: qc }, React.createElement(MemoryRouter, { initialEntries: ["/bookings/1"] }, React.createElement(mod.AuthProvider, null, React.createElement(mod.ToastProvider, null, React.createElement(Routes, null, React.createElement(Route, { path: "/bookings/:id", element: React.createElement(mod.DetailBookingPage) })))))));
  html = renderDetail(); assert.ok(html.includes("Konfirmasi booking") && html.includes("Alasan penolakan"));
  assert.match(html, /<button[^>]*disabled=""[^>]*>Tolak booking<\/button>/);
  qc.setQueryData(["booking", 1], { ...b, status: "CHECKED_IN", usulanBarber: [{ id: 1, barberId: 1, status: "PENDING", alasan: "Dummy" }] });
  html = renderDetail(); assert.ok(html.includes("Menunggu persetujuan pelanggan")); assert.match(html, /<button[^>]*disabled=""[^>]*>Mulai layanan<\/button>/);
  qc.setQueryData(["booking", 1], { ...b, status: "COMPLETED", pesananId: 1 }); qc.setQueryData(["booking-payments", 1], { ...uang, statusPembayaran: "OVERDUE" });
  html = renderDetail(); assert.ok(html.includes("Lunasi melalui kasir") && html.includes("Pembayaran Belum Dilunasi"));
  qc.setQueryData(["booking-payments", 1], { ...uang, statusPembayaran: "PAID", balance: 0, invoice: { id: 1, nomorInvoice: "INV-DUMMY", total: 10000, dibuatPada: new Date().toISOString() } });
  html = renderDetail(); assert.ok(html.includes("Invoice final: INV-DUMMY") && !html.includes("Lunasi melalui kasir"));
  pass("Render detail: reject wajib alasan, consent tidak dibypass, OVERDUE payable dan invoice final setelah PAID");
  qc.clear(); klien.clear();
  console.log(`HASIL: ${total} kelompok PASS; browser E2E tidak termasuk suite ini.`);
} finally {
  stop?.(); sub?.(); if (server) await new Promise(resolve => server.close(resolve));
  delete globalThis.localStorage;
  await unlink(file);
}
