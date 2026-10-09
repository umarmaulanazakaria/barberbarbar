import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL ?? "").hostname)) {
  throw new Error("Fixture audit hanya boleh menggunakan database lokal");
}
const { default: db } = await import("../dist/lib/prisma.js");
const { default: app } = await import("../dist/app.js");
const { buatTokenResetPelanggan } = await import("../dist/services/reset-password-pelanggan.service.js");
const { batasiPercobaanPelanggan } = await import("../dist/middleware/batas-percobaan-pelanggan.middleware.js");
const tanda = `audit-f2-${randomUUID()}`;
const password = randomBytes(18).toString("hex");
const telepon = [];
const operator = [];
let barberId;
let server;
let alamat;
const nomor = () => {
  const nilai = `08${randomBytes(8).readBigUInt64BE().toString().slice(0, 11)}`;
  telepon.push(nilai);
  return nilai;
};
const email = (nama) => `${tanda}-${nama}@example.invalid`;
const dataDaftar = (nama, no = nomor()) => ({ nama: tanda, nomorTelepon: no, email: email(nama), password });
const http = async (rute, method = "GET", body, token, tambahan = {}) => {
  const hasil = await fetch(`${alamat}${rute}`, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...tambahan },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: hasil.status, body: await hasil.json(), retry: hasil.headers.get("retry-after") };
};
const daftar = (data) => http("/auth/customer/register", "POST", data);
const masuk = (identitas, sandi = password) => http("/auth/customer/login", "POST", { identitas, password: sandi });
const lulus = (nama) => console.log(`PASS: ${nama}`);
const aman = (nilai) => assert.ok(!/passwordHash|tokenHash|kredensial/.test(JSON.stringify(nilai)));
const buatExisting = () => db.pelanggan.create({ data: { nama: tanda, nomorTelepon: nomor() } });
const permohonan = (pelangganId) => db.permohonanPengaitanAkun.findFirst({ where: { pelangganId, status: "MENUNGGU" } });
const putus = (id, aksi, token) => http(`/auth/customer/requests/${id}/${aksi}`, "POST", {}, token);

try {
  const retensiLama = await db.permohonanPengaitanAkun.count({
    where: { status: { not: "MENUNGGU" }, passwordHash: { not: "" } },
  });
  const emailTidakNormal = await db.$queryRaw`
    SELECT COUNT(*)::int AS jumlah FROM "AkunPelanggan" WHERE "email" <> lower("email")
  `;
  const indeks = await db.$queryRaw`
    SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()
    AND tablename IN ('Pelanggan', 'AkunPelanggan', 'PasswordResetToken')
    AND indexdef LIKE '%UNIQUE%'
  `;
  for (const nama of ["Pelanggan_nomorTelepon_key", "AkunPelanggan_pelangganId_key", "AkunPelanggan_email_key", "PasswordResetToken_tokenHash_key"]) {
    assert.ok(indeks.some(i => i.indexname === nama));
  }
  console.log(`READ-ONLY: hash keputusan lama=${retensiLama}; email tidak lowercase=${emailTidakNormal[0].jumlah}`);
  lulus("Unique constraint DB aktual: telepon, akun per pelanggan, email dan hash token");
  const hash = await bcrypt.hash(password, 10);
  barberId = (await db.barber.create({ data: { nama: tanda } })).id;
  for (const [index, role] of ["ADMIN", "ADMIN", "STAFF"].entries()) {
    operator.push(await db.pengguna.create({ data: {
      name: tanda, email: email(`operator-${index}`), passwordHash: hash, role,
      ...(role === "STAFF" ? { barberId } : {}),
    } }));
  }
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  alamat = `http://127.0.0.1:${server.address().port}`;
  const tokenOperator = [];
  for (const akun of operator) {
    const hasil = await http("/auth/login", "POST", { email: akun.email, password });
    assert.equal(hasil.status, 200);
    tokenOperator.push(hasil.body.token);
  }
  const [adminSatu, adminDua, staff] = tokenOperator;

  const baru = dataDaftar("baru");
  const hasilBaru = await Promise.all([daftar(baru), daftar(baru)]);
  assert.deepEqual(hasilBaru.map(h => h.status).sort(), [201, 409]);
  assert.equal(await db.pelanggan.count({ where: { nomorTelepon: baru.nomorTelepon } }), 1);
  assert.equal(await db.akunPelanggan.count({ where: { email: baru.email } }), 1);
  hasilBaru.forEach(h => aman(h.body));
  lulus("Registrasi baru bersamaan: satu pelanggan dan satu akun");
  const emailSama = dataDaftar("email-sama");
  const emailBedaNomor = { ...emailSama, nomorTelepon: nomor() };
  const konflik = await Promise.all([daftar(emailSama), daftar(emailBedaNomor)]);
  assert.deepEqual(konflik.map(h => h.status).sort(), [201, 409]);
  assert.equal(await db.pelanggan.count({ where: { nomorTelepon: { in: [emailSama.nomorTelepon, emailBedaNomor.nomorTelepon] } } }), 1);
  assert.deepEqual(konflik.find(h => h.status === 409).body, hasilBaru.find(h => h.status === 409).body);
  assert.equal((await daftar({ ...baru, email: baru.email.toUpperCase(), nomorTelepon: nomor() })).status, 409);
  lulus("Konflik email normalisasi/unique: rollback pelanggan dan respons umum");
  assert.equal((await daftar({ ...dataDaftar("password-byte"), password: "🙂".repeat(30) })).status, 400);
  lulus("Registrasi menolak password lebih dari 72 byte bcrypt");

  const existing = await buatExisting();
  const dataExisting = dataDaftar("existing", existing.nomorTelepon);
  const pengajuan = await Promise.all([daftar(dataExisting), daftar(dataExisting)]);
  assert.deepEqual(pengajuan.map(h => h.status).sort(), [202, 409]);
  assert.equal(await db.permohonanPengaitanAkun.count({ where: { pelangganId: existing.id } }), 1);
  assert.equal(await db.akunPelanggan.count({ where: { pelangganId: existing.id } }), 0);
  lulus("Pengaitan existing bersamaan: satu permohonan tanpa akun prematur");
  const eSatu = await buatExisting();
  const eDua = await buatExisting();
  const pendingEmail = dataDaftar("pending-email", eSatu.nomorTelepon);
  const pengajuanEmail = await Promise.all([daftar(pendingEmail), daftar({ ...pendingEmail, nomorTelepon: eDua.nomorTelepon })]);
  assert.deepEqual(pengajuanEmail.map(h => h.status).sort(), [202, 409]);
  assert.equal(await db.permohonanPengaitanAkun.count({ where: { email: pendingEmail.email } }), 1);
  assert.equal((await daftar({ ...pendingEmail, nomorTelepon: nomor() })).status, 409);
  lulus("Email pending tidak dapat dipakai permohonan/registrasi lain");

  const minta = await permohonan(existing.id);
  for (const aksi of ["approve", "reject"]) assert.equal((await putus(minta.id, aksi, staff)).status, 403);
  assert.equal((await http("/auth/customer/requests", "GET", undefined, staff)).status, 403);
  const keputusan = await Promise.all([putus(minta.id, "approve", adminSatu), putus(minta.id, "approve", adminDua)]);
  assert.deepEqual(keputusan.map(h => h.status).sort(), [200, 409]);
  assert.equal(await db.akunPelanggan.count({ where: { pelangganId: existing.id } }), 1);
  assert.equal((await db.permohonanPengaitanAkun.findUnique({ where: { id: minta.id } })).passwordHash, "");
  assert.equal((await masuk(dataExisting.email)).status, 200);
  lulus("Dua ADMIN menyetujui: satu keputusan/satu akun; STAFF ditolak; hash dibersihkan");
  const ditolak = await buatExisting();
  assert.equal((await daftar(dataDaftar("tolak", ditolak.nomorTelepon))).status, 202);
  const pTolak = await permohonan(ditolak.id);
  assert.equal((await putus(pTolak.id, "reject", adminSatu)).status, 200);
  assert.equal((await putus(pTolak.id, "approve", adminDua)).status, 409);
  assert.equal(await db.akunPelanggan.count({ where: { pelangganId: ditolak.id } }), 0);
  assert.equal((await db.permohonanPengaitanAkun.findUnique({ where: { id: pTolak.id } })).passwordHash, "");
  lulus("Penolakan final tanpa akun dan tanpa retensi hash password");
  const campur = await buatExisting();
  assert.equal((await daftar(dataDaftar("campur", campur.nomorTelepon))).status, 202);
  const pCampur = await permohonan(campur.id);
  const hasilCampur = await Promise.all([putus(pCampur.id, "approve", adminSatu), putus(pCampur.id, "reject", adminDua)]);
  assert.deepEqual(hasilCampur.map(h => h.status).sort(), [200, 409]);
  const finalCampur = await db.permohonanPengaitanAkun.findUnique({ where: { id: pCampur.id } });
  assert.equal(await db.akunPelanggan.count({ where: { pelangganId: campur.id } }), finalCampur.status === "DISETUJUI" ? 1 : 0);
  assert.equal(finalCampur.passwordHash, "");
  lulus("Approve versus reject bersamaan: satu keputusan konsisten");
  const konflikExisting = await buatExisting();
  assert.equal((await daftar(dataDaftar("konflik-persetujuan", konflikExisting.nomorTelepon))).status, 202);
  const pKonflik = await permohonan(konflikExisting.id);
  const akunKonflik = await buatExisting();
  await db.akunPelanggan.create({ data: { pelangganId: akunKonflik.id, email: pKonflik.email, passwordHash: hash } });
  const gagalKonflik = await putus(pKonflik.id, "approve", adminSatu);
  assert.equal(gagalKonflik.status, 409);
  assert.deepEqual(Object.keys(gagalKonflik.body), ["pesan"]);
  assert.equal(await db.akunPelanggan.count({ where: { pelangganId: konflikExisting.id } }), 0);
  assert.equal((await db.permohonanPengaitanAkun.findUnique({ where: { id: pKonflik.id } })).status, "MENUNGGU");
  assert.equal((await putus(pKonflik.id, "reject", adminDua)).status, 200);
  lulus("Persetujuan dengan email sudah dipakai: 409 umum tanpa akun/keputusan parsial");

  const loginEmail = await masuk(baru.email.toUpperCase());
  const loginTelepon = await masuk(baru.nomorTelepon);
  assert.equal(loginEmail.status, 200); assert.equal(loginTelepon.status, 200);
  const customer = loginEmail.body.token;
  aman(loginEmail.body.pelanggan);
  for (const rute of ["/pelanggan", "/customers", "/services", "/barbers", "/orders", "/memberships", "/dashboard", "/auth/me", "/auth/customer/requests"]) {
    assert.equal((await http(rute, "GET", undefined, customer)).status, 401);
  }
  assert.equal((await putus(minta.id, "approve", customer)).status, 401);
  for (const token of tokenOperator) assert.equal((await http("/auth/customer/me", "GET", undefined, token)).status, 401);
  lulus("Login email/telepon dan pemisahan JWT CUSTOMER versus ADMIN/STAFF");
  const profil = await http("/auth/customer/me", "GET", undefined, customer);
  assert.equal(profil.status, 200); aman(profil.body);
  assert.equal(profil.body.akun.email, baru.email);
  const jwtLama = jwt.sign({ id: profil.body.akun.id, tipe: "CUSTOMER" }, process.env.JWT_SECRET, { expiresIn: "1d" });
  assert.equal((await http("/auth/customer/me", "GET", undefined, jwtLama)).status, 401);
  lulus("JWT CUSTOMER versi lama tanpa sidik kredensial wajib login ulang");
  assert.equal((await http("/auth/customer/me", "PATCH", { nama: "Dummy diperbarui", alamat: "Alamat dummy" }, customer)).status, 200);
  assert.equal((await http("/auth/customer/me", "PATCH", { id: existing.id, pelangganId: existing.id, email: "ubah@example.invalid", status: "AKTIF" }, customer)).status, 400);
  assert.equal((await http(`/auth/customer/me?pelangganId=${existing.id}`, "GET", undefined, customer)).body.akun.email, baru.email);
  assert.equal((await db.pelanggan.findUnique({ where: { id: existing.id } })).nama, tanda);
  lulus("Profil sendiri saja; ID/email/status injection ditolak tanpa mengubah customer lain");

  const blokir = await buatExisting();
  assert.equal((await daftar(dataDaftar("blokir", blokir.nomorTelepon))).status, 202);
  const pBlokir = await permohonan(blokir.id);
  await db.pelanggan.update({ where: { id: blokir.id }, data: { status: "DIBLOKIR" } });
  assert.equal((await putus(pBlokir.id, "approve", adminSatu)).status, 409);
  assert.equal((await daftar(dataDaftar("blokir-lagi", blokir.nomorTelepon))).status, 409);
  const akunBaru = await db.akunPelanggan.findUnique({ where: { email: baru.email } });
  await db.pelanggan.update({ where: { id: akunBaru.pelangganId }, data: { status: "DIBLOKIR" } });
  assert.equal((await masuk(baru.email)).status, 401);
  assert.equal((await http("/auth/customer/me", "GET", undefined, customer)).status, 401);
  assert.equal((await http("/auth/customer/me", "PATCH", { nama: "Terlarang" }, customer)).status, 401);
  await db.pelanggan.update({ where: { id: akunBaru.pelangganId }, data: { status: "AKTIF" } });
  lulus("DIBLOKIR ditolak pada registrasi, login, middleware dan persetujuan");

  const lupa = await http("/auth/customer/forgot-password", "POST", { email: baru.email });
  const hilang = await http("/auth/customer/forgot-password", "POST", { email: email("tidak-ada") });
  assert.equal(lupa.status, 200); assert.deepEqual(lupa.body, hilang.body); aman(lupa.body);
  const reset = await buatTokenResetPelanggan(baru.email);
  const baruPassword = randomBytes(18).toString("hex");
  assert.equal((await http("/auth/customer/reset-password", "POST", { token: reset.token, password: baruPassword })).status, 200);
  assert.equal((await http("/auth/customer/me", "GET", undefined, customer)).status, 401);
  assert.equal((await http("/auth/customer/me", "PATCH", { nama: "JWT lama" }, loginTelepon.body.token)).status, 401);
  assert.equal((await masuk(baru.email)).status, 401);
  const sesudahReset = await masuk(baru.email, baruPassword);
  assert.equal(sesudahReset.status, 200);
  assert.equal((await http("/auth/customer/me", "GET", undefined, sesudahReset.body.token)).status, 200);
  for (let i = 0; i < operator.length; i++) {
    assert.equal((await db.pengguna.findUnique({ where: { id: operator[i].id } })).passwordHash, operator[i].passwordHash);
    assert.equal((await http("/auth/me", "GET", undefined, tokenOperator[i])).status, 200);
  }
  lulus("Reset mencabut seluruh JWT CUSTOMER lama; JWT/password ADMIN/STAFF tetap berlaku");

  for (const id of [akunBaru.pelangganId, existing.id, ditolak.id]) {
    const hapus = await http(`/pelanggan/${id}`, "DELETE", undefined, adminSatu);
    assert.equal(hapus.status, 409);
    assert.ok(await db.pelanggan.findUnique({ where: { id } }));
  }
  lulus("Penghapusan operator melindungi akun aktif dan riwayat pengaitan");
  const daftarAdmin = await http("/auth/customer/requests", "GET", undefined, adminSatu);
  assert.equal(daftarAdmin.status, 200); aman(daftarAdmin.body);
  lulus("Daftar permohonan ADMIN tidak mengirim hash password");
  for (const rute of ["/pelanggan", "/customers", "/services", "/layanan", "/barbers", "/orders", "/memberships", "/auth/me"]) {
    assert.equal((await http(rute, "GET", undefined, staff)).status, 200);
  }
  lulus("Smoke API operator existing dengan JWT STAFF tetap berhasil");
  const batasUji = batasiPercobaanPelanggan(1);
  const jamAsli = Date.now;
  let jam = jamAsli();
  let lolos = 0;
  let ditahan = 0;
  const responUji = { setHeader() {}, status(kode) { assert.equal(kode, 429); return this; }, json() { ditahan++; } };
  try {
    Date.now = () => jam;
    batasUji({ ip: "alamat-satu" }, responUji, () => lolos++);
    batasUji({ ip: "alamat-satu" }, responUji, () => lolos++);
    batasUji({ ip: "alamat-dua" }, responUji, () => lolos++);
    jam += 15 * 60 * 1000;
    batasUji({ ip: "alamat-satu" }, responUji, () => lolos++);
    assert.equal(lolos, 3); assert.equal(ditahan, 1);
  } finally { Date.now = jamAsli; }
  lulus("Jendela limiter pulih setelah 15 menit dan IP berbeda dipisahkan");

  for (const [rute, batas] of [["register", 20], ["login", 20], ["forgot-password", 10], ["reset-password", 30]]) {
    let terakhir;
    for (let i = 0; i <= batas; i++) terakhir = await http(`/auth/customer/${rute}`, "POST", {});
    assert.equal(terakhir.status, 429); assert.ok(Number(terakhir.retry) > 0);
    assert.equal((await http(`/auth/customer/${rute}`, "POST", {}, undefined, { "X-Forwarded-For": "203.0.113.9" })).status, 429);
    lulus(`Pembatasan ${rute}: 429/Retry-After, spoof header tidak melewati batas`);
  }
} catch (error) {
  console.error(`FAIL: audit terhenti (${error.name}); credential/token tidak dicetak.`);
  process.exitCode = 1;
} finally {
  try {
    // Nomor didaftarkan sebelum request agar fixture hasil HTTP tetap terlacak.
    const pelanggan = await db.pelanggan.findMany({ where: {
      nomorTelepon: { in: telepon }, OR: [
        { nama: tanda }, { akunPelanggan: { email: { startsWith: tanda } } },
      ],
    }, select: { id: true } });
    const ids = pelanggan.map(p => p.id);
    await db.permohonanPengaitanAkun.deleteMany({ where: { pelangganId: { in: ids } } });
    await db.pelanggan.deleteMany({ where: { id: { in: ids } } });
    await db.pengguna.deleteMany({ where: { id: { in: operator.map(p => p.id) } } });
    if (barberId) await db.barber.delete({ where: { id: barberId } });
    assert.equal(await db.pelanggan.count({ where: { id: { in: ids } } }), 0);
    assert.equal(await db.akunPelanggan.count({ where: { email: { startsWith: tanda } } }), 0);
    assert.equal(await db.permohonanPengaitanAkun.count({ where: { email: { startsWith: tanda } } }), 0);
    console.log("PASS: fixture audit dibersihkan");
  } finally {
    try { if (server) await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
    finally { await db.$disconnect(); }
  }
}
