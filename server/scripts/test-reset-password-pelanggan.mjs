import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { createInterface } from "node:readline/promises";
import bcrypt from "bcrypt";

// Script hanya untuk DB lokal; tidak menerima identitas customer existing.
const alamatDatabase = new URL(process.env.DATABASE_URL ?? "");
if (!['localhost', '127.0.0.1', '[::1]'].includes(alamatDatabase.hostname)) {
  throw new Error("Pengujian hanya diperbolehkan pada database lokal");
}
const modeToken = process.argv.includes("--token-local");
if (modeToken && (!process.stdout.isTTY || !process.stdin.isTTY)) {
  throw new Error("Token lokal hanya boleh ditampilkan pada terminal interaktif");
}

const { default: basisData } = await import("../dist/lib/prisma.js");
const { default: aplikasi } = await import("../dist/app.js");
const { buatTokenResetPelanggan, resetPasswordPelanggan } = await import("../dist/services/reset-password-pelanggan.service.js");
const hash = (nilai) => createHash("sha256").update(nilai).digest("hex");
const penanda = `uji-f2-${randomUUID()}`;
const email = `${penanda}@example.invalid`;
const passwordLama = randomBytes(18).toString("hex");
const passwordBaru = randomBytes(18).toString("hex");
const idPengguna = [];
let idPelanggan;
let idBarber;
let server;
let jumlahLulus = 0;
const lulus = (nama) => { jumlahLulus++; console.log(`LULUS: ${nama}`); };
const sidikPengguna = async () => hash(JSON.stringify(await basisData.pengguna.findMany({
  where: { id: { notIn: idPengguna } },
  select: { id: true, passwordHash: true }, orderBy: { id: "asc" },
})));

try {
  const pelanggan = await basisData.pelanggan.create({ data: {
    nama: penanda,
    nomorTelepon: `08${randomBytes(8).readBigUInt64BE().toString().slice(0, 11)}`,
    akunPelanggan: { create: { email, passwordHash: await bcrypt.hash(passwordLama, 12) } },
  }, include: { akunPelanggan: true } });
  idPelanggan = pelanggan.id;
  const idAkun = pelanggan.akunPelanggan.id;

  server = aplikasi.listen(0, "127.0.0.1");
  await once(server, "listening");
  const alamat = `http://127.0.0.1:${server.address().port}`;
  const post = async (rute, body) => {
    const respon = await fetch(`${alamat}${rute}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    return { status: respon.status, body: await respon.json() };
  };
  const reset = (token, password = passwordBaru) => post("/auth/customer/reset-password", { token, password });
  const tokenBaru = async () => {
    const hasil = await buatTokenResetPelanggan(email);
    assert.ok(hasil, "Token dummy harus tersedia");
    return hasil;
  };

  if (modeToken) {
    const { token, kedaluwarsaPada } = await tokenBaru();
    console.log("AKUN DUMMY SEMENTARA — jangan salin token ke file/log/repository.");
    console.log(`Email: ${email}\nPassword dummy: ${passwordLama}\nToken: ${token}\nKedaluwarsa: ${kedaluwarsaPada.toISOString()}`);
    console.log(`API simulasi: ${alamat}/auth/customer/reset-password`);
    const terminal = createInterface({ input: process.stdin, output: process.stdout });
    try { await terminal.question("Tekan Enter setelah simulasi untuk menghapus akun dan token dummy. "); }
    finally { terminal.close(); }
  } else {
    const sidikSebelum = await sidikPengguna();
    const terdaftar = await post("/auth/customer/forgot-password", { email: email.toUpperCase() });
    const tidakTerdaftar = await post("/auth/customer/forgot-password", { email: `${penanda}-tidak-ada@example.invalid` });
    assert.equal(terdaftar.status, 200);
    assert.deepEqual(terdaftar, tidakTerdaftar);
    assert.deepEqual(Object.keys(terdaftar.body), ["pesan"]);
    lulus("Respons email terdaftar/tidak terdaftar identik, tanpa token");

    const tokenSebelumnya = await tokenBaru();
    const awal = Date.now();
    const valid = await tokenBaru();
    const tersimpan = await basisData.passwordResetToken.findUnique({ where: { tokenHash: hash(valid.token) } });
    assert.ok(tersimpan && tersimpan.tokenHash !== valid.token);
    assert.ok(valid.kedaluwarsaPada.getTime() >= awal + 30 * 60 * 1000);
    assert.ok(valid.kedaluwarsaPada.getTime() <= Date.now() + 30 * 60 * 1000);
    lulus("Token random 32 byte, hanya SHA-256 tersimpan, expiry 30 menit");

    assert.equal((await reset(valid.token)).status, 200);
    const akunSetelah = await basisData.akunPelanggan.findUnique({ where: { id: idAkun } });
    assert.ok(await bcrypt.compare(passwordBaru, akunSetelah.passwordHash));
    assert.equal(await basisData.passwordResetToken.count({ where: { akunPelangganId: idAkun, digunakanPada: null } }), 0);
    lulus("Token valid mengubah hash password dan membatalkan seluruh token sebelumnya");
    assert.equal((await reset(valid.token)).status, 400);
    assert.equal((await reset(tokenSebelumnya.token)).status, 400);
    lulus("Token bekas dan token sebelumnya ditolak");

    assert.equal((await post("/auth/customer/login", { identitas: email, password: passwordLama })).status, 401);
    assert.equal((await post("/auth/customer/login", { identitas: email, password: passwordBaru })).status, 200);
    lulus("Password lama gagal login; password baru berhasil login");

    const kedaluwarsa = await tokenBaru();
    await basisData.passwordResetToken.update({ where: { tokenHash: hash(kedaluwarsa.token) }, data: { kedaluwarsaPada: new Date(Date.now() - 1000) } });
    assert.equal((await reset(kedaluwarsa.token)).status, 400);
    assert.equal((await reset(randomBytes(32).toString("hex"))).status, 400);
    assert.equal((await reset("token-palsu")).status, 400);
    lulus("Token kedaluwarsa, palsu, dan format tidak valid ditolak");
    const lemah = await tokenBaru();
    assert.equal((await reset(lemah.token, "pendek")).status, 400);
    assert.equal((await reset(lemah.token, "🙂".repeat(30))).status, 400);
    assert.equal((await basisData.passwordResetToken.findUnique({ where: { tokenHash: hash(lemah.token) } })).digunakanPada, null);
    lulus("Password invalid tidak menghabiskan token; batas bcrypt 72 byte");

    // Fault injection pada client proses uji saja, tanpa DDL/trigger/migration.
    const tokenRollback = await tokenBaru();
    const hashSebelumRollback = (await basisData.akunPelanggan.findUnique({ where: { id: idAkun } })).passwordHash;
    const transaksiAsli = basisData.$transaction.bind(basisData);
    basisData.$transaction = (jalankan) => transaksiAsli(async (transaksi) =>
      jalankan(new Proxy(transaksi, { get(target, properti) {
        if (properti === "akunPelanggan") return new Proxy(target.akunPelanggan, {
          get(delegate, aksi) {
            if (aksi === "update") return async () => { throw new Error("SIMULASI_ROLLBACK_F2"); };
            return Reflect.get(delegate, aksi);
          },
        });
        return Reflect.get(target, properti);
      } })),
    );
    try {
      await assert.rejects(() => resetPasswordPelanggan(tokenRollback.token, passwordBaru), /SIMULASI_ROLLBACK_F2/);
    } finally { basisData.$transaction = transaksiAsli; }
    assert.equal((await basisData.passwordResetToken.findUnique({ where: { tokenHash: hash(tokenRollback.token) } })).digunakanPada, null);
    assert.ok((await basisData.akunPelanggan.findUnique({ where: { id: idAkun } })).passwordHash === hashSebelumRollback);
    assert.equal((await reset(tokenRollback.token)).status, 200);
    lulus("Kegagalan update password rollback klaim token; token masih dapat dipakai");

    const bersamaan = await tokenBaru();
    const hasil = await Promise.all([reset(bersamaan.token), reset(bersamaan.token)]);
    assert.deepEqual(hasil.map(h => h.status).sort(), [200, 400]);
    lulus("Dua request bersamaan: token yang sama hanya berhasil sekali");
    const [satu, dua] = [await tokenBaru(), await tokenBaru()];
    const berbeda = await Promise.all([reset(satu.token), reset(dua.token)]);
    assert.deepEqual(berbeda.map(h => h.status).sort(), [200, 400]);
    lulus("Dua token untuk akun sama tidak dapat reset bersamaan dua kali");

    assert.equal(await sidikPengguna(), sidikSebelum);
    const barber = await basisData.barber.create({ data: { nama: penanda } });
    idBarber = barber.id;
    for (const role of ["ADMIN", "STAFF"]) {
      const emailOperator = role === "ADMIN" ? email : `${penanda}-staff@example.invalid`;
      const operator = await basisData.pengguna.create({ data: {
        name: penanda, email: emailOperator, role, passwordHash: await bcrypt.hash(passwordLama, 10),
        ...(role === "STAFF" ? { barberId: idBarber } : {}),
      } });
      idPengguna.push(operator.id);
      await post("/auth/customer/forgot-password", { email: emailOperator });
      if (role === "ADMIN") assert.equal((await reset((await tokenBaru()).token)).status, 200);
      assert.equal((await post("/auth/login", { email: emailOperator, password: passwordLama })).status, 200);
      const sesudah = await basisData.pengguna.findUnique({ where: { id: operator.id } });
      assert.ok(sesudah.passwordHash === operator.passwordHash);
    }
    assert.equal(await basisData.akunPelanggan.count({ where: { email: `${penanda}-staff@example.invalid` } }), 0);
    assert.equal(await sidikPengguna(), sidikSebelum);
    lulus("Hash operator existing tetap; login ADMIN/STAFF dummy tidak terpengaruh");
    console.log(`Total: ${jumlahLulus} kelompok pengujian lulus.`);
  }
} catch (kesalahan) {
  console.error(`Pengujian gagal (${kesalahan.name}); periksa kondisi lokal tanpa mencetak token/credential.`);
  process.exitCode = 1;
} finally {
  // Hanya ID yang dibuat oleh proses ini; token/account terhapus lewat Cascade.
  try {
    if (idPengguna.length) await basisData.pengguna.deleteMany({ where: { id: { in: idPengguna } } });
    if (idBarber) await basisData.barber.delete({ where: { id: idBarber } });
    if (idPelanggan) await basisData.pelanggan.delete({ where: { id: idPelanggan } });
    assert.equal(await basisData.pelanggan.count({ where: { nama: penanda } }), 0);
    assert.equal(await basisData.akunPelanggan.count({ where: { email } }), 0);
    console.log("Data dummy proses ini telah dibersihkan.");
  } finally {
    try {
      if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    } finally { await basisData.$disconnect(); }
  }
}
