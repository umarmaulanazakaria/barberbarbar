import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import bcrypt from 'bcrypt';

const koneksi = new URL(process.env.DATABASE_URL ?? '');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(koneksi.hostname));
assert.ok(/^bb_demo_[a-z0-9_]+$/.test(koneksi.pathname.slice(1)), 'Hanya database demo khusus');
const { default: db } = await import('../dist/lib/prisma.js');
const model = ['riwayatStatusPesanan', 'pembayaran', 'itemPesanan', 'pesanan', 'membership', 'pelanggan', 'pengguna', 'barber', 'layanan'];
const semua = ['akunPelanggan', 'passwordResetToken', 'permohonanPengaitanAkun', 'permohonanMembership', 'booking', 'itemBooking', 'usulanBarberBooking', 'riwayatBooking', 'transaksiPembayaranBooking', 'buktiProviderBooking', 'invoiceBooking', 'percobaanSnapBooking', 'permohonanRefundBooking', ...model];
const milik = {};
const jalankan = tambahan => spawnSync(process.execPath, ['dist/seed.js'], {
  env: { ...process.env, IZINKAN_SEED_DEMO: '', DEMO_ADMIN_PASSWORD: '', DEMO_STAFF_PASSWORD: '', ...tambahan },
  encoding: 'utf8', windowsHide: true,
});
try {
  for (const nama of semua) assert.equal(await db[nama].count(), 0, 'Fixture memerlukan database kosong');
  assert.equal(jalankan({}).status, 1);
  const sandiAdmin = randomBytes(24).toString('hex'), sandiStaff = randomBytes(24).toString('hex');
  const izin = { IZINKAN_SEED_DEMO: 'true', DEMO_ADMIN_PASSWORD: sandiAdmin, DEMO_STAFF_PASSWORD: sandiStaff };
  assert.equal(jalankan({ ...izin, DATABASE_URL: koneksi.toString().replace(koneksi.pathname, '/bukan_database_demo') }).status, 1);
  const pertama = jalankan(izin);
  // Kumpulkan hanya ID fixture dari database yang sebelumnya diverifikasi kosong.
  for (const nama of model) milik[nama] = (await db[nama].findMany({ select: { id: true } })).map(x => x.id);
  assert.equal(pertama.status, 0);
  const operator = await db.pengguna.findMany({ orderBy: { id: 'asc' } });
  assert.equal(operator.length, 2);
  for (const akun of operator) assert.ok(await bcrypt.compare(akun.role === 'ADMIN' ? sandiAdmin : sandiStaff, akun.passwordHash));
  const kedua = jalankan({ ...izin, DEMO_ADMIN_PASSWORD: randomBytes(24).toString('hex'), DEMO_STAFF_PASSWORD: randomBytes(24).toString('hex') });
  assert.equal(kedua.status, 0);
  assert.deepEqual(await db.pengguna.findMany({ orderBy: { id: 'asc' } }), operator);
  for (const nama of model) assert.deepEqual((await db[nama].findMany({ select: { id: true }, orderBy: { id: 'asc' } })).map(x => x.id), [...milik[nama]].sort((a, b) => a - b));
  assert.ok(![pertama, kedua].some(r => (r.stdout + r.stderr).includes(sandiAdmin) || (r.stdout + r.stderr).includes(sandiStaff)));
  console.log('PASS seed: izin wajib, database non-demo ditolak, password privat valid, ulang tanpa duplikat/perubahan akun, tidak mencetak credential.');
} finally {
  try {
    await db.$transaction(async tx => {
      for (const nama of model) if (milik[nama]?.length) await tx[nama].deleteMany({ where: { id: { in: milik[nama] } } });
    });
    for (const nama of semua) assert.equal(await db[nama].count(), 0, 'Cleanup fixture belum lengkap');
    console.log('PASS cleanup seed: hanya ID fixture sendiri dibersihkan; 22 model kembali kosong.');
  } finally { await db.$disconnect(); }
}
