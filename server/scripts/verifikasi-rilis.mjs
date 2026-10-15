import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const akar = path.resolve('../..');
const daftar = JSON.parse(await readFile('finalization/BERKAS-ZIP.json', 'utf8'));
const pribadi = new Set();
const snapshot = JSON.parse(await readFile(path.join(akar, 'backup-database/e2e-2026-10-15T00-47-37-807Z/snapshot.json'), 'utf8'));
for (const model of ['pelanggan', 'akunPelanggan', 'pengguna']) for (const row of snapshot[model]) {
  for (const nama of ['nama', 'name', 'email', 'nomorTelepon']) if (typeof row[nama] === 'string' && row[nama].length >= 8) pribadi.add(row[nama]);
}
const rahasia = ['DATABASE_URL', 'JWT_SECRET', 'MIDTRANS_SERVER_KEY', 'MIDTRANS_CLIENT_KEY'].map(k => process.env[k]).filter(v => v && v.length >= 8);
const terlarang = ['barberbarbar/server/src/lib/prisma.ts', 'barberbarbar-mobile/src/layar/LayarTambahPelanggan.tsx', 'barberbarbar-mobile/src/layanan/booking.ts'];
let jumlah = 0, temuanRahasia = 0, temuanPribadi = 0;
for (const rel of daftar) {
  assert.ok(!terlarang.includes(rel) && !rel.split('/').some(p => p === '.git' || p === 'node_modules' || p.startsWith('.env')));
  assert.ok(!rel.includes('..') && !path.isAbsolute(rel));
  let isi; try { isi = await readFile(path.join(akar, rel), 'utf8'); } catch (e) {
    if (e.code === 'ENOENT' && /(?:HASIL-KEAMANAN|MANIFEST-SUMBER)\.json$/.test(rel)) continue;
    throw new Error('Berkas daftar belum tersedia');
  }
  jumlah++;
  if (rahasia.some(v => isi.includes(v)) || /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|SB-Mid-server-[A-Za-z0-9_-]+|-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(isi)) temuanRahasia++;
  if ([...pribadi].some(v => isi.includes(v))) temuanPribadi++;
}
const git = (repo, args) => execFileSync('git', ['-c', `safe.directory=${repo.replaceAll('\\', '/')}`, '-C', repo, ...args], { encoding: 'utf8', windowsHide: true });
const envTracked = [];
for (const repo of ['barberbarbar', 'barberbarbar-mobile', 'barberbarbar-customer']) {
  const files = git(path.join(akar, repo), ['ls-files']).split('\n');
  envTracked.push(...files.filter(f => { const n = path.posix.basename(f); return (n === '.env' || n.startsWith('.env.')) && !['.env.example', '.env.sample'].includes(n); }));
}
const baseline = JSON.parse(await readFile('e2e/HASIL-INTEGRITAS.json', 'utf8'));
for (const item of baseline.protectedFiles) assert.equal(createHash('sha256').update(await readFile(path.join(akar, item.path))).digest('hex'), item.sha256, 'File historis berubah');
assert.ok(git(path.resolve('..'), ['ls-files', '-s', '--', 'server/src/lib/prisma.ts']).includes('6594970f6d44cfae4ac899cd83f14f6991dce0a0'));
const hasil = { tanggal: new Date().toISOString(), berkasDipindai: jumlah, temuanRahasia, temuanDataPribadi: temuanPribadi, envAsliTracked: envTracked.length, historisUtuh: true, status: temuanRahasia === 0 && temuanPribadi === 0 && envTracked.length === 0 ? 'PASS' : 'FAIL', batas: 'Pencocokan exact terhadap credential proses dan email/telepon/nama>=8 karakter pada snapshot; bukan jaminan menyeluruh semua secret/PII di seluruh repo/history.' };
if (!process.argv.includes('--tanpa-tulis')) await writeFile('finalization/HASIL-KEAMANAN.json', JSON.stringify(hasil, null, 2));
console.log(JSON.stringify(hasil));
assert.equal(hasil.status, 'PASS', 'Verifikasi rilis gagal; nilai rahasia/data pribadi tidak dicetak');
