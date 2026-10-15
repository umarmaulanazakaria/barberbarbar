import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import bcrypt from "bcrypt";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL ?? "").hostname)) throw new Error("Fixture hanya DB lokal");
const { default: db } = await import("../dist/lib/prisma.js");
const { default: app } = await import("../dist/app.js");
const { validasiWaktuBooking, kapasitasBookingCukup } = await import("../dist/lib/jadwal-booking.js");
const { buatBookingPelanggan } = await import("../dist/services/booking.service.js");
const tanda = `uji-f4-${randomUUID()}`;
const password = randomBytes(18).toString("hex");
const pelanggan = [], barber = [], layanan = [], operator = [];
let server, alamat;
let jumlah = 0;
const pass = nama => { console.log(`PASS: ${nama}`); jumlah++; };
const hari = (jarak, jam) => {
  const lokal = new Date(Date.now() + 7 * 3600000 + jarak * 86400000).toISOString().slice(0, 10);
  return `${lokal}T${jam}:00+07:00`;
};
const http = async (rute, method = "GET", body, token) => {
  const hasil = await fetch(`${alamat}${rute}`, { method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: hasil.status, body: await hasil.json() };
};
const payload = (jarak = 1, jam = "10:00", pilihan = null, qty = 1) => ({
  mulaiPada: hari(jarak, jam), barberPilihanId: pilihan, items: [{ layananId: layanan[0].id, qty }],
});
const buat = (p, data) => http("/customer/bookings", "POST", data, p.token);
const aman = body => assert.ok(!/passwordHash|tokenHash|nomorTelepon|pelangganId|email/.test(JSON.stringify(body)));
const hitungWaktu = where => db.$transaction(async tx => {
  await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
  return tx.booking.count({ where });
});
try {
  const sekarang = new Date("2026-10-14T10:00:00+07:00");
  assert.equal(validasiWaktuBooking(new Date("2026-10-14T12:59:00+07:00"), 30, sekarang), null);
  assert.ok(validasiWaktuBooking(new Date("2026-10-14T13:00:00+07:00"), 30, sekarang));
  assert.equal(validasiWaktuBooking(new Date("2026-10-28T10:01:00+07:00"), 30, sekarang), null);
  assert.ok(validasiWaktuBooking(new Date("2026-10-28T10:00:00+07:00"), 30, sekarang));
  assert.ok(validasiWaktuBooking(new Date("2026-10-15T22:30:00+07:00"), 30, sekarang));
  assert.equal(validasiWaktuBooking(new Date("2026-10-15T22:31:00+07:00"), 30, sekarang), null);
  assert.equal(validasiWaktuBooking(new Date("2026-10-15T08:59:00+07:00"), 30, sekarang), null);
  assert.equal(validasiWaktuBooking(new Date("2026-10-15T10:00:01+07:00"), 30, sekarang), null);
  assert.equal(validasiWaktuBooking(new Date("2026-10-15T09:00:00+07:00"), 30, new Date("2026-10-14T23:59:00+07:00")).toISOString(), "2026-10-15T02:30:00.000Z");
  const range = (mulai, selesai) => ({ mulaiPada: new Date(`2026-10-15T${mulai}:00+07:00`), selesaiPada: new Date(`2026-10-15T${selesai}:00+07:00`) });
  assert.ok(kapasitasBookingCukup([range("10:00", "10:30"), range("10:30", "11:00")], range("10:00", "11:00"), 2));
  assert.equal(kapasitasBookingCukup([range("10:00", "11:00"), range("10:30", "11:30")], range("10:00", "11:00"), 2), false);
  pass("Boundary waktu: 3 jam, 14x24 jam, 09-23, menit, UTC/Jakarta, sweep interval berurutan");

  const hash = await bcrypt.hash(password, 10);
  for (const aktif of [true, true, false]) barber.push(await db.barber.create({ data: { nama: tanda, aktif } }));
  for (const [harga, durasiMenit, aktif] of [[100001, 30, true], [25000, 10, true], [1000, 5, false]]) {
    layanan.push(await db.layanan.create({ data: { nama: tanda, harga, durasiMenit, aktif } }));
  }
  const kapasitas = await db.barber.count({ where: { aktif: true } });
  server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  alamat = `http://127.0.0.1:${server.address().port}`;
  for (let i = 0; i < kapasitas + 4; i++) {
    const p = await db.pelanggan.create({ data: { nama: tanda,
      nomorTelepon: `08${randomBytes(8).readBigUInt64BE().toString().slice(0, 11)}`,
      akunPelanggan: { create: { email: `${tanda}-${i}@example.invalid`, passwordHash: hash } } } });
    pelanggan.push(p);
    // Service login yang sama dengan HTTP, tanpa menghabiskan quota limiter dummy.
    const { loginPelanggan } = await import("../dist/services/auth-pelanggan.service.js");
    p.token = (await loginPelanggan({ identitas: `${tanda}-${i}@example.invalid`, password })).token;
  }
  for (const [i, role] of ["ADMIN", "STAFF"].entries()) {
    const akun = await db.pengguna.create({ data: { name: tanda, email: `${tanda}-op${i}@example.invalid`, role,
      passwordHash: hash, ...(role === "STAFF" ? { barberId: barber[0].id } : {}) } });
    operator.push(akun);
    akun.token = (await http("/auth/login", "POST", { email: akun.email, password })).body.token;
  }
  const [satu, dua, tiga] = pelanggan;
  const awal = { ...payload(1, "10:07", barber[0].id, 2), items: [{ layananId: layanan[0].id, qty: 2 }, { layananId: layanan[1].id, qty: 1 }] };
  const nonMember = await buat(satu, awal);
  assert.equal(nonMember.status, 201); aman(nonMember.body);
  const booking = nonMember.body.booking;
  assert.equal(booking.status, "PENDING_CONFIRMATION"); assert.equal(booking.barberPilihanId, barber[0].id);
  assert.equal(booking.durasiMenit, 70); assert.equal(booking.subtotal, 225002);
  assert.equal(booking.discountPercent, 0); assert.equal(booking.total, 225002); assert.equal(booking.nominalDp, 112501);
  assert.equal(booking.pesananId, null); assert.equal(booking.selesaiPada, new Date(hari(1, "11:17")).toISOString());
  assert.equal(await db.pesanan.count({ where: { pelangganId: satu.id } }), 0);
  pass("Non-member multi-service/qty, menit fleksibel, snapshot harga/durasi/DP; tidak membuat Pesanan/Pembayaran");
  await assert.rejects(() => db.booking.update({ where: { id: booking.id }, data: { total: booking.total + 1 } }), e => e.code === "P2039");
  const itemAwal = await db.itemBooking.findFirst({ where: { bookingId: booking.id } });
  await assert.rejects(() => db.itemBooking.update({ where: { id: itemAwal.id }, data: { qty: 0 } }), e => e.code === "P2039");
  assert.equal((await db.booking.findUnique({ where: { id: booking.id } })).total, booking.total);
  pass("Constraint DB menolak snapshot nominal/qty invalid tanpa mengubah booking valid");
  assert.equal((await buat(dua, payload(1, "10:15", barber[0].id))).status, 409);
  assert.equal((await buat(satu, payload(1, "10:15", barber[1].id))).status, 409);
  assert.equal((await buat(satu, payload(1, "11:17", barber[0].id))).status, 201);
  pass("Barber tertentu bentrok, customer overlap, pending menahan slot, batas berurutan diterima");
  const member = await db.membership.create({ data: { pelangganId: dua.id, memberCode: `TEST-${tanda}`, discountPercent: 25 } });
  const memberBooking = await buat(dua, payload(1, "14:00"));
  assert.equal(memberBooking.status, 201); assert.equal(memberBooking.body.booking.discountPercent, 10);
  assert.equal(memberBooking.body.booking.diskon, 10000); assert.equal(memberBooking.body.booking.total, 90001);
  assert.equal(memberBooking.body.booking.nominalDp, 45001);
  await db.membership.update({ where: { id: member.id }, data: { isActive: false, discountPercent: 0 } });
  await db.layanan.update({ where: { id: layanan[0].id }, data: { harga: 120000, durasiMenit: 35, nama: `${tanda}-ubah` } });
  const historis = await http(`/customer/bookings/${memberBooking.body.booking.id}`, "GET", undefined, dua.token);
  assert.equal(historis.body.booking.total, 90001); assert.equal(historis.body.booking.items[0].harga, 100001);
  assert.equal(historis.body.booking.items[0].durasiMenit, 30); assert.equal(historis.body.booking.discountPercent, 10);
  assert.equal((await buat(dua, payload(1, "15:00"))).body.booking.discountPercent, 0);
  await db.layanan.update({ where: { id: layanan[0].id }, data: { harga: 100001, durasiMenit: 30, nama: tanda } });
  pass("ACTIVE snapshot 10% walau operator kustom25%, INACTIVE 0, perubahan harga/membership tidak retroaktif; DP rupiah ceil");

  for (const data of [payload(15), payload(1, "08:59"), payload(1, "23:00"), payload(1, "22:31"),
    { ...payload(), mulaiPada: hari(1, "10:00").replace(":00+07", ":01+07") },
    { ...payload(), mulaiPada: "2026-10-15T10:00:00" },
    { ...payload(), mulaiPada: new Date(Date.now() + 120 * 60000).toISOString().replace(/:\d\d\.\d{3}Z$/, ":00.000Z") }]) {
    assert.equal((await buat(tiga, data)).status, 400);
  }
  const jamLokal = new Date(Date.now() + 7 * 3600000).getUTCHours();
  assert.equal((await buat(tiga, payload(14, "09:00"))).status, jamLokal >= 9 ? 201 : 400);
  assert.equal((await buat(tiga, payload(2, "22:30"))).status, 201);
  pass("HTTP menolak <3 jam/hari sama, >14 hari, luar jam, melewati23, detik/timezone invalid; hari14/end23 diterima");
  for (const data of [ { ...payload(), pelangganId: dua.id }, { ...payload(), harga: 1 }, { ...payload(), discountPercent: 100 },
    { ...payload(), status: "CONFIRMED" }, { ...payload(), nominalDp: 0 },
    { ...payload(), items: [{ layananId: layanan[0].id, qty: 0 }] },
    { ...payload(), items: [{ layananId: layanan[0].id, qty: 1 }, { layananId: layanan[0].id, qty: 1 }] },
    { ...payload(), items: [{ layananId: layanan[2].id, qty: 1 }] }, payload(1, "16:00", barber[2].id) ]) {
    assert.equal((await buat(tiga, data)).status, 400);
  }
  pass("Harga/diskon/identitas/status/DP injection, qty invalid, service/barber nonaktif ditolak");
  const capData = payload(3, "10:00");
  for (let i = 0; i < kapasitas - 1; i++) assert.equal((await buat(pelanggan[i], i === 0 ? { ...capData, barberPilihanId: barber[0].id } : capData)).status, 201);
  const penuh = await Promise.all([buat(pelanggan[kapasitas - 1], capData), buat(pelanggan[kapasitas], capData)]);
  assert.deepEqual(penuh.map(h => h.status).sort(), [201, 409]);
  assert.equal((await buat(pelanggan[kapasitas + 1], capData)).status, 409);
  assert.equal(await hitungWaktu({ mulaiPada: new Date(capData.mulaiPada) }), kapasitas);
  pass("Kapasitas aktif gabungan specific/any: last-slot bersamaan hanya satu berhasil, pending penuh menolak");
  const spesifik = payload(4, "12:00", barber[0].id);
  assert.deepEqual((await Promise.all([buat(satu, spesifik), buat(dua, spesifik)])).map(h => h.status).sort(), [201, 409]);
  const sendiri = payload(5, "13:00");
  assert.deepEqual((await Promise.all([buat(satu, sendiri), buat(satu, { ...sendiri, barberPilihanId: barber[1].id })])).map(h => h.status).sort(), [201, 409]);
  pass("Concurrency specific dan customer yang sama: satu booking aktif berhasil");
  const campuran = payload(8, "10:00");
  for (let i = 0; i < kapasitas - 1; i++) assert.equal((await buat(pelanggan[i], campuran)).status, 201);
  const calonCampuran = await Promise.all([
    buat(pelanggan[kapasitas - 1], { ...campuran, barberPilihanId: barber[0].id }),
    buat(pelanggan[kapasitas], campuran),
  ]);
  assert.deepEqual(calonCampuran.map(h => h.status).sort(), [201, 409]);
  pass("Specific versus any serentak menghitung pool kapasitas yang sama");

  const bukanMilik = await http(`/customer/bookings/${booking.id}`, "GET", undefined, dua.token);
  const tidakAda = await http("/customer/bookings/999999999", "GET", undefined, dua.token);
  assert.equal(bukanMilik.status, 404); assert.deepEqual(bukanMilik, tidakAda);
  const daftar = await http(`/customer/bookings?pelangganId=${satu.id}`, "GET", undefined, dua.token);
  aman(daftar.body); assert.ok(daftar.body.data.every(b => b.id !== booking.id));
  assert.equal((await http("/customer/bookings")).status, 401);
  for (const akun of operator) {
    assert.equal((await http("/customer/bookings", "GET", undefined, akun.token)).status, 401);
    assert.equal((await http("/customer/bookings", "POST", payload(), akun.token)).status, 401);
  }
  assert.equal((await http("/orders", "GET", undefined, satu.token)).status, 401);
  pass("Own-booking scope, IDOR 404, query injection, tanpa JWT/operator ditolak; CUSTOMER ditolak operator");
  await db.pelanggan.update({ where: { id: tiga.id }, data: { status: "DIBLOKIR" } });
  assert.equal((await buat(tiga, payload(6))).status, 401);
  assert.equal((await http("/customer/bookings", "GET", undefined, tiga.token)).status, 401);
  pass("Customer DIBLOKIR ditolak membuat/membaca booking");

  const rollbackData = payload(7, "10:00");
  const transaksiAsli = db.$transaction.bind(db);
  db.$transaction = (jalankan, opsi) => transaksiAsli(async tx => jalankan(new Proxy(tx, { get(target, nama) {
    if (nama === "booking") return new Proxy(target.booking, { get(delegate, aksi) {
      if (aksi === "create") return async args => { await delegate.create(args); throw new Error("ROLLBACK_BOOKING_DUMMY"); };
      return Reflect.get(delegate, aksi);
    } });
    return Reflect.get(target, nama);
  } })), opsi);
  try { await assert.rejects(() => buatBookingPelanggan(satu.id, rollbackData), /ROLLBACK_BOOKING_DUMMY/); }
  finally { db.$transaction = transaksiAsli; }
  assert.equal(await hitungWaktu({ pelangganId: satu.id, mulaiPada: new Date(rollbackData.mulaiPada) }), 0);
  assert.equal((await buat(satu, rollbackData)).status, 201);
  pass("Kegagalan setelah create nested rollback booking/items; slot tidak bocor");
  const bookingRollback = await db.booking.findFirst({ where: { pelangganId: satu.id }, orderBy: { id: "desc" } });
  await db.booking.update({ where: { id: bookingRollback.id }, data: { status: "CANCELLED", dibatalkanPada: new Date() } });
  assert.equal((await buat(satu, rollbackData)).status, 201);
  pass("Status terminal fixture melepaskan slot; customer tidak memiliki API transisi F5");
  const kasir = pelanggan[pelanggan.length - 1];
  const pesanan = await http("/orders", "POST", { pelangganId: kasir.id, barberId: barber[0].id,
    items: [{ layananId: layanan[0].id, qty: 1 }] }, operator[1].token);
  assert.equal(pesanan.status, 201);
  const order = await db.pesanan.findFirst({ where: { pelangganId: kasir.id } });
  assert.equal(order.total, 100001);
  for (const status of ["IN_SERVICE", "COMPLETED"]) {
    assert.equal((await http(`/orders/${order.id}/status`, "PATCH", { status }, operator[1].token)).status, 200);
  }
  const bayar = await http(`/orders/${order.id}/payment`, "POST", { metode: "CASH", jumlahDiterima: 110000 }, operator[1].token);
  assert.equal(bayar.status, 200);
  const dibayar = await db.pesanan.findUnique({ where: { id: order.id }, include: { pembayaran: true } });
  assert.equal(dibayar.statusPembayaran, "PAID"); assert.equal(dibayar.pembayaran.kembalian, 9999);
  assert.equal((await http(`/orders/${order.id}/payment`, "POST", { metode: "CASH", jumlahDiterima: 110000 }, operator[1].token)).status, 409);
  const invoice = await http("/invoices", "GET", undefined, operator[1].token);
  assert.equal(invoice.status, 200); assert.ok(invoice.body.some(item => item.pesananId === order.id));
  pass("Regresi kasir Project3/4: STAFF order → IN_SERVICE → COMPLETED → PAID, invoice/kembalian, pembayaran ulang 409");
  console.log(`Total: ${jumlah} kelompok F4 PASS.`);
} catch (e) { console.error(`FAIL pengujian F4 (${e.name}); credential/token tidak dicetak.`); process.exitCode = 1; }
finally {
  try {
    await db.booking.deleteMany({ where: { pelangganId: { in: pelanggan.map(p => p.id) } } });
    const pesananFixture = await db.pesanan.findMany({ where: { pelangganId: { in: pelanggan.map(p => p.id) } }, select: { id: true } });
    await db.pembayaran.deleteMany({ where: { pesananId: { in: pesananFixture.map(p => p.id) } } });
    await db.pesanan.deleteMany({ where: { id: { in: pesananFixture.map(p => p.id) } } });
    await db.pelanggan.deleteMany({ where: { id: { in: pelanggan.map(p => p.id) } } });
    await db.pengguna.deleteMany({ where: { id: { in: operator.map(p => p.id) } } });
    await db.layanan.deleteMany({ where: { id: { in: layanan.map(l => l.id) } } });
    await db.barber.deleteMany({ where: { id: { in: barber.map(b => b.id) } } });
    assert.equal(await db.pelanggan.count({ where: { id: { in: pelanggan.map(p => p.id) } } }), 0);
    assert.equal(await db.booking.count({ where: { pelangganId: { in: pelanggan.map(p => p.id) } } }), 0);
    console.log("PASS: fixture F4 dibersihkan; record existing tidak disentuh.");
  } finally {
    try { if (server) await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
    finally { await db.$disconnect(); }
  }
}
