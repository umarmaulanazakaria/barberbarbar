import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import bcrypt from "bcrypt";

const alamatDatabase = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1", "[::1]"].includes(alamatDatabase.hostname)) {
  throw new Error("Pengujian fixture hanya diperbolehkan pada database lokal");
}
const { default: basisData } = await import("../dist/lib/prisma.js");
const { default: aplikasi } = await import("../dist/app.js");
const penanda = `uji-publik-${randomUUID()}`;
const passwordDummy = randomBytes(18).toString("hex");
const idLayanan = [];
const idBarber = [];
let server;

try {
  // Seluruh fixture dibuat atomik; data existing tidak diubah.
  const fixture = await basisData.$transaction(async (transaksi) => {
    const layanan = [];
    const barber = [];
    for (const aktif of [true, false]) {
      layanan.push(await transaksi.layanan.create({ data: {
        nama: `${penanda}-${aktif}`, aktif, harga: 12345, durasiMenit: 17,
      } }));
      barber.push(await transaksi.barber.create({ data: {
        nama: `${penanda}-${aktif}`, aktif, nomorTelepon: `${penanda}-${aktif}`,
        ...(aktif ? { pengguna: { create: {
          name: penanda, email: `${penanda}@example.invalid`, role: "STAFF",
          passwordHash: await bcrypt.hash(passwordDummy, 10),
        } } } : {}),
      } }));
    }
    return { layanan, barber };
  });
  idLayanan.push(...fixture.layanan.map(item => item.id));
  idBarber.push(...fixture.barber.map(item => item.id));

  server = aplikasi.listen(0, "127.0.0.1");
  await once(server, "listening");
  const alamat = `http://127.0.0.1:${server.address().port}`;
  const get = async (rute, token) => {
    const respon = await fetch(`${alamat}${rute}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return { status: respon.status, body: await respon.json() };
  };

  for (const [rute, model, dataDummy, kolom] of [
    ["/public/services", basisData.layanan, fixture.layanan, ["id", "nama", "harga", "durasiMenit"]],
    ["/public/barbers", basisData.barber, fixture.barber, ["id", "nama"]],
  ]) {
    const respon = await get(rute);
    assert.equal(respon.status, 200);
    assert.ok(Array.isArray(respon.body));
    const aktif = await model.findMany({ where: { aktif: true }, select: { id: true } });
    assert.deepEqual(respon.body.map(item => item.id).sort((a, b) => a - b), aktif.map(item => item.id).sort((a, b) => a - b));
    for (const item of respon.body) assert.deepEqual(Object.keys(item).sort(), [...kolom].sort());
    assert.ok(respon.body.some(item => item.id === dataDummy[0].id));
    assert.ok(!respon.body.some(item => item.id === dataDummy[1].id));
    const dummy = respon.body.find(item => item.id === dataDummy[0].id);
    assert.equal(dummy.nama, dataDummy[0].nama);
    if (rute.endsWith("services")) {
      assert.equal(dummy.harga, 12345);
      assert.equal(dummy.durasiMenit, 17);
    }
    console.log(`LULUS ${rute}: tanpa JWT, hanya aktif, whitelist field publik`);
  }

  for (const rute of ["/services", "/layanan", "/barbers", "/barbers/staff-accounts"]) {
    assert.equal((await get(rute)).status, 401);
    assert.equal((await get(rute, "token-tidak-valid")).status, 401);
  }
  console.log("LULUS endpoint operator: tanpa JWT/JWT palsu ditolak");

  const login = await fetch(`${alamat}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `${penanda}@example.invalid`, password: passwordDummy }),
  });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  for (const [rute, ids] of [["/services", idLayanan], ["/barbers", idBarber]]) {
    const respon = await get(rute, token);
    assert.equal(respon.status, 200);
    assert.ok(ids.every(id => respon.body.some(item => item.id === id)));
  }
  assert.equal((await get("/barbers/staff-accounts", token)).status, 403);
  console.log("LULUS kontrak operator: STAFF masih dapat membaca aktif/nonaktif; staff-accounts tetap ADMIN-only");
} finally {
  try {
    if (idLayanan.length) await basisData.layanan.deleteMany({ where: { id: { in: idLayanan } } });
    // Pengguna fixture ikut terhapus lewat FK Cascade Barber existing.
    if (idBarber.length) await basisData.barber.deleteMany({ where: { id: { in: idBarber } } });
    assert.equal(await basisData.pengguna.count({ where: { email: `${penanda}@example.invalid` } }), 0);
    assert.equal(await basisData.layanan.count({ where: { id: { in: idLayanan } } }), 0);
    assert.equal(await basisData.barber.count({ where: { id: { in: idBarber } } }), 0);
    console.log("Fixture lokal dibersihkan; data existing tidak diubah.");
  } finally {
    try {
      if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    } finally { await basisData.$disconnect(); }
  }
}
