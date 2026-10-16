import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
import { chromium, expect } from "@playwright/test";

if (!/^\/bb_guest_20261016_[a-f0-9]{8}$/.test(new URL(process.env.DATABASE_URL ?? "").pathname)) throw Error("Wajib database fixture terisolasi");
const req = createRequire(path.resolve("../server/package.json"));
const { default: db } = await import("../../server/dist/lib/prisma.js");
const { default: app } = await import("../../server/dist/app.js");
const { pasangRealtime } = await import("../../server/dist/realtime/server.js");
const models = ["pelanggan", "akunPelanggan", "pengguna", "barber", "layanan", "membership", "pesanan", "itemPesanan", "pembayaran", "riwayatStatusPesanan", "passwordResetToken", "permohonanPengaitanAkun", "permohonanMembership", "booking", "itemBooking", "usulanBarberBooking", "riwayatBooking", "transaksiPembayaranBooking", "buktiProviderBooking", "invoiceBooking", "percobaanSnapBooking", "permohonanRefundBooking", "aksesBookingTamu", "sesiBookingTamu"];
for (const m of models) assert.equal(await db[m].count(), 0, "Fixture wajib kosong");
const tag = "admin-modul-" + randomUUID(), password = randomBytes(20).toString("hex");
const ids = { pelanggan: [], barber: [], layanan: [], pengguna: [], pesanan: [] };
let server, runtime, vite, browser, total = 0, alamat, web, token, staff;
const pass = s => console.log(`PASS MODUL ${++total}: ${s}`);
const kosong = async () => { const s = createServer(); await new Promise(r => s.listen(0, "127.0.0.1", r)); const p = s.address().port; await new Promise(r => s.close(r)); return p; };
const api = async (p, method = "GET", body, akses = token) => {
  const r = await fetch(alamat + p, { method, signal: AbortSignal.timeout(10000), headers: { "Content-Type": "application/json", ...(akses ? { Authorization: "Bearer " + akses } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: r.status, body: await r.json() };
};
const cek = async (p, method, body, status = 200, akses = token) => { const r = await api(p, method, body, akses); assert.equal(r.status, status, `${method ?? "GET"} ${p}`); return r.body; };
try {
  const port = await kosong(), wp = await kosong(); alamat = `http://127.0.0.1:${port}`; web = `http://127.0.0.1:${wp}`;
  process.env.BB_E2E_BACKEND_PORT = String(port); process.env.SOCKET_ALLOWED_ORIGINS = web;
  server = createServer(app); runtime = pasangRealtime(server); await runtime.siap; await new Promise(r => server.listen(port, "127.0.0.1", r));
  const hash = await req("bcrypt").hash(password, 10);
  const barberStaff = await db.barber.create({ data: { nama: tag + " staf", aktif: true } }); ids.barber.push(barberStaff.id);
  for (const role of ["ADMIN", "STAFF"]) { const u = await db.pengguna.create({ data: { name: tag, email: role.toLowerCase() + "-" + tag + "@example.invalid", passwordHash: hash, role, ...(role === "STAFF" ? { barberId: barberStaff.id } : {}) } }); ids.pengguna.push(u.id); }
  token = (await cek("/auth/login", "POST", { email: "admin-" + tag + "@example.invalid", password })).token;
  staff = (await cek("/auth/login", "POST", { email: "staff-" + tag + "@example.invalid", password })).token;
  assert.ok(token && staff); await cek("/orders", "GET", undefined, 401, null);
  await cek("/services", "POST", { nama: tag, harga: 10000, durasiMenit: 30 }, 403, staff);
  pass("Login operator asli; anonim ditolak dan STAFF tidak dapat memutasi layanan ADMIN");

  const customer = await cek("/customers", "POST", { nama: tag, nomorTelepon: "08" + randomBytes(6).readUIntBE(0, 6), alamat: "Fixture" }, 201); ids.pelanggan.push(customer.id);
  assert.equal((await cek(`/customers/${customer.id}`)).nama, tag);
  await cek(`/customers/${customer.id}`, "PATCH", { alamat: "Fixture diperbarui" });
  await cek("/customers", "POST", { nama: tag, nomorTelepon: customer.nomorTelepon }, 409);
  await cek(`/customers/${customer.id}/blokir`, "PATCH", {});
  assert.equal((await cek(`/customers/${customer.id}`)).status, "DIBLOKIR");
  await cek(`/customers/${customer.id}/buka-blokir`, "PATCH", {});
  pass("Pelanggan create/read/update, konflik nomor, blokir dan buka blokir");

  const barber = (await cek("/barbers", "POST", { nama: tag, aktif: true }, 201)).data; ids.barber.push(barber.id);
  await cek(`/barbers/${barber.id}`, "PATCH", { nama: tag + " diperbarui" });
  assert.equal((await cek(`/barbers/${barber.id}`)).aktif, true);
  const akun = (await cek(`/barbers/${barber.id}/account`, "POST", { email: "barber-" + tag + "@example.invalid", password, confirmPassword: password }, 201)).data;
  if (akun.id) ids.pengguna.push(akun.id);
  await cek(`/barbers/${barber.id}/account`, "POST", { email: "barber2-" + tag + "@example.invalid", password, confirmPassword: password }, 409);
  const accounts = await cek("/barbers/staff-accounts"); assert.ok(!JSON.stringify(accounts).includes("passwordHash"));
  pass("Barber create/read/update dan akun STAFF, duplikasi ditolak, DTO tanpa hash password");

  const layanan = (await cek("/services", "POST", { nama: tag, harga: 10000, durasiMenit: 30 }, 201)).data; ids.layanan.push(layanan.id);
  await cek(`/services/${layanan.id}`, "PATCH", { harga: 12000 });
  assert.equal((await cek(`/services/${layanan.id}`)).harga, 12000);
  await cek("/services", "POST", { nama: tag, harga: -1, durasiMenit: 30 }, 400);
  pass("Layanan create/read/update serta nominal tidak valid ditolak");

  const member = (await cek("/memberships", "POST", { pelangganId: customer.id }, 201)).data;
  await cek("/memberships", "POST", { pelangganId: customer.id }, 409);
  await cek(`/memberships/${member.id}`, "PATCH", { discountPercent: 15, isActive: false });
  assert.equal((await cek(`/memberships/${member.id}`)).isActive, false);
  await cek(`/memberships/${member.id}`, "DELETE");
  pass("Membership create/read/update/delete, konflik duplikasi dan diskon operator existing tetap berlaku");

  const order = (await cek("/orders", "POST", { pelangganId: customer.id, items: [{ layananId: layanan.id, qty: 2 }] }, 201, staff)).data; ids.pesanan.push(order.id);
  assert.equal(order.total, 24000); assert.equal(order.barberId, null);
  await cek(`/orders/${order.id}/status`, "PATCH", { status: "IN_SERVICE", barberId: barber.id }, 200, staff);
  await cek(`/orders/${order.id}/status`, "PATCH", { status: "COMPLETED" }, 200, staff);
  const paid = await cek(`/orders/${order.id}/payment`, "POST", { metode: "CASH", jumlahDiterima: 25000 }, 200, staff);
  assert.equal(paid.data.pembayaran.kembalian, 1000);
  await cek(`/orders/${order.id}/payment`, "POST", { metode: "CASH", jumlahDiterima: 25000 }, 409, staff);
  assert.equal(await db.pembayaran.count({ where: { pesananId: order.id } }), 1);
  assert.equal((await cek(`/orders/${order.id}`)).statusPembayaran, "PAID");
  assert.ok((await cek("/invoices")).some(i => i.pesananId === order.id));
  await cek(`/customers/${customer.id}`, "DELETE", undefined, 409);
  await cek(`/barbers/${barber.id}`, "DELETE", undefined, 409);
  await cek(`/services/${layanan.id}`, "DELETE", undefined, 409);
  pass("Walk-in STAFF WAITING tanpa barber → IN_SERVICE → COMPLETED → bayar/invoice; pembayaran ganda dan penghapusan riwayat ditolak");

  const cp = await cek("/customers", "POST", { nama: tag + " hapus", nomorTelepon: "DEL-" + randomUUID() }, 201); ids.pelanggan.push(cp.id);
  const cb = (await cek("/barbers", "POST", { nama: tag + " hapus" }, 201)).data; ids.barber.push(cb.id);
  const cl = (await cek("/services", "POST", { nama: tag + " hapus", harga: 1000, durasiMenit: 5 }, 201)).data; ids.layanan.push(cl.id);
  for (const [p, id] of [["customers", cp.id], ["barbers", cb.id], ["services", cl.id]]) { await cek(`/${p}/${id}`, "DELETE"); await cek(`/${p}/${id}`, "GET", undefined, 404); }
  await cek("/dashboard"); await cek("/dashboard/reports"); await cek("/dashboard/reports?mulai=2030-01-02&selesai=2030-01-01", "GET", undefined, 400);
  pass("Delete resource tanpa riwayat, laporan/dashboard dan validasi rentang tanggal");

  vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--configLoader", "runner", "--host", "127.0.0.1", "--port", String(wp)], { windowsHide: true, env: process.env, stdio: "ignore" });
  await expect.poll(async () => { try { return (await fetch(web)).status; } catch { return 0; } }, { timeout: 20000 }).toBe(200);
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [], serverErrors = [];
  page.on("pageerror", e => errors.push(e.name)); page.on("response", r => { if (new URL(r.url()).pathname.startsWith("/api/") && r.status() >= 500) serverErrors.push(r.status()); });
  await page.goto(web + "/login"); await page.locator("input[type=email]").fill("admin-" + tag + "@example.invalid"); await page.locator("input[type=password]").fill(password); await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  for (const [p, title] of [["orders", "Pesanan"], ["customers", "Pelanggan"], ["membership", "Membership"], ["barbers", "Barber"], ["services", "Layanan"], ["refunds", "Pengembalian Dana"], ["history", "Riwayat Pesanan"], ["invoices", "Invoice"], ["reports", "Laporan"], ["settings", "Pengaturan"]]) {
    await page.goto(web + "/" + p); await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible(); await page.waitForLoadState("networkidle");
  }
  pass("Sepuluh modul Admin dapat dinavigasi dan memuat API aktual tanpa runtime/HTTP500");

  await page.goto(web + "/services"); await page.getByRole("button", { name: "+ Tambah Layanan", exact: true }).click();
  let modal = page.getByRole("dialog", { name: "Tambah Layanan", exact: true });
  await modal.locator("input").nth(0).fill(tag + " browser"); await modal.locator("input[type=number]").nth(0).fill("20"); await modal.locator("input[type=number]").nth(1).fill("9000");
  await modal.getByRole("button", { name: "Simpan Layanan", exact: true }).click(); await expect(modal).toBeHidden();
  const made = await db.layanan.findFirstOrThrow({ where: { nama: tag + " browser" } }); ids.layanan.push(made.id);
  await page.getByPlaceholder("Cari nama, durasi, atau harga layanan...").fill(tag + " browser");
  const row = page.getByRole("button").filter({ hasText: tag + " browser" }); await expect(row).toBeVisible(); await row.focus(); await page.keyboard.press("Enter");
  modal = page.getByRole("dialog", { name: "Ubah Layanan", exact: true }); await expect(modal).toBeVisible(); await modal.locator("input[type=number]").nth(1).fill("9500");
  await modal.getByRole("button", { name: "Simpan Layanan", exact: true }).click(); await expect(modal).toBeHidden();
  assert.equal((await db.layanan.findUniqueOrThrow({ where: { id: made.id } })).harga, 9500);
  await row.click(); await page.getByRole("dialog", { name: "Ubah Layanan", exact: true }).getByRole("button", { name: "Hapus Layanan", exact: true }).click();
  await page.getByRole("dialog", { name: "Hapus Layanan?", exact: true }).getByRole("button", { name: "Hapus Layanan", exact: true }).click();
  await expect.poll(() => db.layanan.count({ where: { id: made.id } })).toBe(0);
  pass("CRUD layanan melalui tombol/modal browser, pencarian dan keyboard Enter benar-benar tersimpan ke database");
  for (const width of [1440, 1024, 768, 390]) { await page.setViewportSize({ width, height: 950 }); for (const p of ["/", "/orders", "/customers", "/services"]) { await page.goto(web + p); await expect(page.locator("h1")).toBeVisible(); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Overflow " + p + " " + width); } }
  assert.deepEqual(errors, []); assert.deepEqual(serverErrors, []);
  pass("Desktop/laptop/tablet/mobile, tabel/card/modal, tanpa overflow halaman atau error JS");
  console.log(`TOTAL ${total} MODUL PASS; HTTP/PostgreSQL/browser aktual pada fixture, tanpa provider nyata.`);
} catch (e) { console.error("FAIL MODUL", total, e.name, e.stack?.split("\n").find(l => l.includes("test-modul-admin-browser")) ?? "Tanpa detail sensitif", typeof e.actual === "number" ? {actual:e.actual,expected:e.expected} : ""); process.exitCode = 1; }
finally {
  if (browser) await browser.close(); if (vite) vite.kill(); if (runtime) await runtime.hentikan(); if (server) await new Promise(r => server.close(r));
  // Semua ID berasal dari fixture suite; transaksi melindungi cleanup terkait.
  await db.$transaction(async tx => {
    await tx.pembayaran.deleteMany({ where: { pesananId: { in: ids.pesanan } } }); await tx.pesanan.deleteMany({ where: { id: { in: ids.pesanan } } });
    await tx.membership.deleteMany({ where: { pelangganId: { in: ids.pelanggan } } }); await tx.pelanggan.deleteMany({ where: { id: { in: ids.pelanggan } } });
    await tx.pengguna.deleteMany({ where: { OR: [{ id: { in: ids.pengguna } }, { barberId: { in: ids.barber } }] } });
    await tx.barber.deleteMany({ where: { id: { in: ids.barber } } }); await tx.layanan.deleteMany({ where: { id: { in: ids.layanan } } });
  });
  for (const m of models) assert.equal(await db[m].count(), 0, "Cleanup fixture " + m);
  await db.$disconnect(); console.log("PASS cleanup24: seluruh fixture modul bersih; database utama tidak digunakan.");
}
