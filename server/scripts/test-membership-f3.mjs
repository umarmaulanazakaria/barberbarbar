import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import bcrypt from "bcrypt";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL ?? "").hostname)) throw new Error("Fixture hanya database lokal");
const { default: db } = await import("../dist/lib/prisma.js");
const { default: app } = await import("../dist/app.js");
const { putuskanPermohonanMembership } = await import("../dist/services/permohonan-membership.service.js");
const tanda = `uji-f3-${randomUUID()}`;
const password = randomBytes(18).toString("hex");
const ids = [];
const operator = [];
let barberId, layananId, server, alamat;
let lulus = 0;
const pass = nama => { console.log(`PASS: ${nama}`); lulus++; };
const http = async (rute, metode = "GET", body, token) => {
  const hasil = await fetch(`${alamat}${rute}`, { method: metode,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: hasil.status, body: await hasil.json() };
};
const status = token => http("/customer/membership", "GET", undefined, token);
const ajukan = token => http("/customer/membership/requests", "POST", {}, token);
const putus = (id, aksi, token) => http(`/membership-requests/${id}/${aksi}`, "POST", {}, token);
const aman = body => assert.ok(!/passwordHash|tokenHash|nomorTelepon|email/.test(JSON.stringify(body)));
try {
  const hash = await bcrypt.hash(password, 10);
  barberId = (await db.barber.create({ data: { nama: tanda } })).id;
  layananId = (await db.layanan.create({ data: { nama: tanda, harga: 100000, durasiMenit: 30 } })).id;
  for (const [i, role] of ["ADMIN", "ADMIN", "STAFF"].entries()) {
    operator.push(await db.pengguna.create({ data: { name: tanda, email: `${tanda}-op${i}@example.invalid`, role,
      passwordHash: hash, ...(role === "STAFF" ? { barberId } : {}) } }));
  }
  server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  alamat = `http://127.0.0.1:${server.address().port}`;
  const tokenOp = [];
  for (const akun of operator) {
    const hasil = await http("/auth/login", "POST", { email: akun.email, password });
    assert.equal(hasil.status, 200); tokenOp.push(hasil.body.token);
  }
  const [admin, adminDua, staff] = tokenOp;
  const customer = [];
  for (let i = 0; i < 7; i++) {
    const p = await db.pelanggan.create({ data: { nama: tanda,
      nomorTelepon: `08${randomBytes(8).readBigUInt64BE().toString().slice(0, 11)}`,
      akunPelanggan: { create: { email: `${tanda}-${i}@example.invalid`, passwordHash: hash } },
    } });
    ids.push(p.id);
    const login = await http("/auth/customer/login", "POST", { identitas: `${tanda}-${i}@example.invalid`, password });
    assert.equal(login.status, 200); customer.push({ ...p, token: login.body.token });
  }
  const [satu, dua, tiga, empat, lima, enam, tujuh] = customer;
  assert.equal((await status(satu.token)).body.status, "NON_MEMBER");
  assert.equal((await status()).status, 401);
  assert.equal((await status(admin)).status, 401);
  pass("Non-member melihat status sendiri; autentikasi CUSTOMER wajib");
  assert.equal((await http("/customer/membership/requests", "POST", { pelangganId: dua.id, discountPercent: 100 }, satu.token)).status, 400);
  const serentak = await Promise.all([ajukan(satu.token), ajukan(satu.token)]);
  assert.deepEqual(serentak.map(h => h.status).sort(), [201, 409]);
  const permohonanSatu = serentak.find(h => h.status === 201).body.permohonan.id;
  assert.equal(await db.permohonanMembership.count({ where: { pelangganId: satu.id, status: "PENDING_APPROVAL" } }), 1);
  assert.equal((await status(satu.token)).body.status, "PENDING_APPROVAL");
  assert.equal((await status(dua.token)).body.status, "NON_MEMBER");
  await assert.rejects(() => db.permohonanMembership.create({ data: { pelangganId: satu.id } }), e => e.code === "P2002");
  pass("Pengajuan tanpa formulir; duplicate bersamaan dan constraint pending; injection ditolak");
  const daftar = await http("/membership-requests", "GET", undefined, admin);
  assert.equal(daftar.status, 200); aman(daftar.body);
  assert.ok(daftar.body.data.some(p => p.id === permohonanSatu));
  assert.equal((await http("/membership-requests", "GET", undefined, staff)).status, 403);
  assert.equal((await http("/membership-requests", "GET", undefined, satu.token)).status, 401);
  for (const aksi of ["approve", "reject"]) {
    assert.equal((await putus(permohonanSatu, aksi, staff)).status, 403);
    assert.equal((await putus(permohonanSatu, aksi, satu.token)).status, 401);
  }
  const milikDua = await http(`/customer/membership?pelangganId=${satu.id}`, "GET", undefined, dua.token);
  assert.equal(milikDua.body.status, "NON_MEMBER");
  assert.equal((await http(`/customer/membership/requests/${permohonanSatu}`, "GET", undefined, dua.token)).status, 404);
  pass("Daftar ADMIN aman; STAFF/CUSTOMER ditolak keputusan; customer tidak membaca customer lain");
  const pesananAwal = await http("/orders", "POST", { pelangganId: satu.id, barberId,
    items: [{ layananId, qty: 1 }] }, staff);
  assert.equal(pesananAwal.status, 201);
  const awalDb = await db.pesanan.findFirst({ where: { pelangganId: satu.id } });
  assert.equal(awalDb.discountPercent, 0); assert.equal(awalDb.total, 100000);
  pass("Non-member tetap dapat dibuatkan pesanan operator tanpa diskon (bukan booking F4)");
  const keputusan = await Promise.all([putus(permohonanSatu, "approve", admin), putus(permohonanSatu, "approve", adminDua)]);
  assert.deepEqual(keputusan.map(h => h.status).sort(), [200, 409]);
  assert.equal(await db.membership.count({ where: { pelangganId: satu.id } }), 1);
  const aktif = await status(satu.token); aman(aktif.body);
  assert.equal(aktif.body.status, "ACTIVE"); assert.equal(aktif.body.diskonPersen, 10);
  assert.match(aktif.body.membership.memberCode, /^MEM-\d{3,}$/);
  assert.equal((await ajukan(satu.token)).status, 409);
  assert.equal((await db.pesanan.findUnique({ where: { id: awalDb.id } })).total, 100000);
  pass("Dua ADMIN approve: satu keputusan/satu Membership existing, diskon 10%, order historis tetap");
  const kedua = (await ajukan(dua.token)).body.permohonan.id;
  assert.equal((await putus(kedua, "reject", admin)).status, 200);
  assert.equal((await status(dua.token)).body.status, "NON_MEMBER");
  assert.equal(await db.membership.count({ where: { pelangganId: dua.id } }), 0);
  assert.equal((await putus(kedua, "approve", adminDua)).status, 409);
  assert.equal((await ajukan(dua.token)).status, 201);
  pass("Reject kembali NON_MEMBER, keputusan final tidak berulang, dapat mengajukan ulang");
  const ketiga = (await ajukan(tiga.token)).body.permohonan.id;
  const campur = await Promise.all([putus(ketiga, "approve", admin), putus(ketiga, "reject", adminDua)]);
  assert.deepEqual(campur.map(h => h.status).sort(), [200, 409]);
  const final = await db.permohonanMembership.findUnique({ where: { id: ketiga } });
  assert.equal(await db.membership.count({ where: { pelangganId: tiga.id } }), final.status === "APPROVED" ? 1 : 0);
  pass("Approve versus reject serentak: satu keputusan konsisten");
  const operatorMember = await http("/memberships", "POST", { pelangganId: empat.id }, staff);
  assert.equal(operatorMember.status, 201);
  assert.equal((await status(empat.token)).body.status, "ACTIVE");
  const idMember = operatorMember.body.data.id;
  assert.equal((await http(`/memberships/${idMember}`, "PATCH", { isActive: false }, staff)).status, 403);
  assert.equal((await http(`/memberships/${idMember}`, "PATCH", { isActive: false }, admin)).status, 200);
  assert.equal((await status(empat.token)).body.status, "INACTIVE");
  assert.equal((await ajukan(empat.token)).status, 409);
  assert.equal((await http(`/memberships/${idMember}`, "PATCH", { isActive: true, discountPercent: 15 }, admin)).status, 200);
  assert.equal((await status(empat.token)).body.diskonPersen, 15);
  assert.equal((await http("/memberships", "GET", undefined, staff)).status, 200);
  pass("Regresi operator STAFF create/ADMIN update; INACTIVE reaktivasi ADMIN; diskon legacy authoritative");
  const pendingLima = (await ajukan(lima.token)).body.permohonan.id;
  await db.pelanggan.update({ where: { id: lima.id }, data: { status: "DIBLOKIR" } });
  assert.equal((await putus(pendingLima, "approve", admin)).status, 409);
  assert.equal((await status(lima.token)).status, 401);
  assert.equal((await ajukan(lima.token)).status, 401);
  assert.equal((await putus(pendingLima, "reject", admin)).status, 200);
  pass("Customer DIBLOKIR tidak dapat mengajukan/diapprove; ADMIN dapat menolak");
  const pendingEnam = (await ajukan(enam.token)).body.permohonan.id;
  const transaksiAsli = db.$transaction.bind(db);
  db.$transaction = jalankan => transaksiAsli(async transaksi => jalankan(new Proxy(transaksi, {
    get(target, properti) {
      if (properti === "membership") return new Proxy(target.membership, { get(delegate, aksi) {
        if (aksi === "create") return async () => { throw new Error("SIMULASI_ROLLBACK_MEMBERSHIP"); };
        return Reflect.get(delegate, aksi);
      } });
      return Reflect.get(target, properti);
    },
  })));
  try { await assert.rejects(() => putuskanPermohonanMembership(pendingEnam, operator[0].id, true), /SIMULASI_ROLLBACK_MEMBERSHIP/); }
  finally { db.$transaction = transaksiAsli; }
  assert.equal((await db.permohonanMembership.findUnique({ where: { id: pendingEnam } })).status, "PENDING_APPROVAL");
  assert.equal(await db.membership.count({ where: { pelangganId: enam.id } }), 0);
  assert.equal((await putus(pendingEnam, "approve", admin)).status, 200);
  pass("Kegagalan pembuatan Membership rollback keputusan; request masih dapat diapprove");
  const pendingTujuh = (await ajukan(tujuh.token)).body.permohonan.id;
  const lintasFlow = await Promise.all([putus(pendingTujuh, "approve", admin), http("/memberships", "POST", { pelangganId: tujuh.id }, staff)]);
  assert.equal(lintasFlow[0].status, 200);
  assert.ok([201, 409].includes(lintasFlow[1].status));
  assert.equal(await db.membership.count({ where: { pelangganId: tujuh.id } }), 1);
  assert.equal((await status(tujuh.token)).body.status, "ACTIVE");
  pass("Approval versus pendaftaran operator: satu Membership, benefit tetap existing");
  const pesanMember = await http("/orders", "POST", { pelangganId: satu.id, barberId, items: [{ layananId, qty: 1 }], discountPercent: 100 }, staff);
  assert.equal(pesanMember.status, 201);
  const pesananTerbaru = await db.pesanan.findFirst({ where: { pelangganId: satu.id }, orderBy: { id: "desc" } });
  assert.equal(pesananTerbaru.discountPercent, 10); assert.equal(pesananTerbaru.total, 90000);
  assert.equal((await http(`/memberships/${aktif.body.membership.id}`, "PATCH", { discountPercent: 20 }, admin)).status, 200);
  assert.equal((await db.pesanan.findUnique({ where: { id: pesananTerbaru.id } })).total, 90000);
  pass("Benefit backend existing authoritative dan snapshot pesanan tetap; DP/booking F4 tidak ditambahkan");
  console.log(`Total: ${lulus} kelompok F3 PASS.`);
} catch (error) { console.error(`FAIL pengujian F3 (${error.name}); credential/token tidak dicetak.`); process.exitCode = 1; }
finally {
  try {
    await db.pesanan.deleteMany({ where: { pelangganId: { in: ids } } });
    await db.permohonanMembership.deleteMany({ where: { pelangganId: { in: ids } } });
    await db.pelanggan.deleteMany({ where: { id: { in: ids } } });
    await db.pengguna.deleteMany({ where: { id: { in: operator.map(p => p.id) } } });
    if (barberId) await db.barber.delete({ where: { id: barberId } });
    if (layananId) await db.layanan.delete({ where: { id: layananId } });
    assert.equal(await db.pelanggan.count({ where: { id: { in: ids } } }), 0);
    assert.equal(await db.permohonanMembership.count({ where: { pelangganId: { in: ids } } }), 0);
    console.log("PASS: seluruh fixture F3 dibersihkan.");
  } finally {
    try { if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
    finally { await db.$disconnect(); }
  }
}
