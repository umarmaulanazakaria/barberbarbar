// Persiapan terukur: verifikasi backup setiap target sebelum PowerShell memindah/menghapus.
import { readFile, readdir, lstat, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const stage = path.resolve('../..'), backup = path.resolve(process.argv[2]);
assert.ok(backup.startsWith(path.resolve(process.env.LOCALAPPDATA, 'BARBERBARBAR/workspace-backups') + path.sep));
const hash = async f => { const h = createHash('sha256'); for await (const b of createReadStream(f)) h.update(b); return h.digest('hex'); };
const valid = JSON.parse(await readFile(path.join(backup, 'TERVERIFIKASI.json'), 'utf8'));
assert.equal(valid.status, 'PASS'); assert.equal(await hash(path.join(backup, 'MANIFEST-BACKUP.json')), valid.manifestSha256);
const manifest = JSON.parse(await readFile(path.join(backup, 'MANIFEST-BACKUP.json'), 'utf8'));
const index = new Map(manifest.files.map(f => [f.path, f]));
const repos = ['barberbarbar', 'barberbarbar-mobile', 'barberbarbar-customer'];
const hapus = (await readdir(stage)).filter(n => !repos.includes(n));
hapus.push('barberbarbar/START-HERE.txt', 'barberbarbar-mobile/assets/splash-icon.png');
for (const r of repos) for (const p of r === 'barberbarbar' ? ['server/dist', 'client/dist'] : ['dist', '.expo']) {
  try { await lstat(path.join(stage, r, p)); hapus.push(`${r}/${p}`); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}
const pindah = [];
for (const r of repos) {
  for (const f of await readdir(path.join(stage, r))) {
    if (/^F\d+-(AUDIT|SANDBOX)\.md$/.test(f)) pindah.push({ dari: `${r}/${f}`, ke: `${r}/docs/audit/${f}` });
    else if (['README-INSTALASI.md', 'README-PENGUJIAN.md', 'README-FINAL.md', 'RELEASE-CHECKLIST.md', 'PANDUAN-DEMO.md', 'README-PENGUJIAN-ANDROID.md', 'PULL-REQUEST.md', 'TEMUAN-LANJUTAN.md'].includes(f)) pindah.push({ dari: `${r}/${f}`, ke: `${r}/docs/${f}` });
  }
}
for (const f of await readdir(path.join(stage, 'barberbarbar/server'))) if (/^F\d+-(AUDIT|SANDBOX)\.md$/.test(f)) pindah.push({ dari: `barberbarbar/server/${f}`, ke: `barberbarbar/docs/audit/${f}` });
let files = 0, bytes = 0;
async function verifikasi(rel) {
  const f = path.resolve(stage, rel); assert.ok(f.startsWith(stage + path.sep));
  const s = await lstat(f); assert.ok(!s.isSymbolicLink());
  if (s.isDirectory()) { for (const n of await readdir(f)) await verifikasi(`${rel}/${n}`); return; }
  const item = index.get(rel); assert.ok(item, `Target tidak dicadangkan: ${rel}`);
  assert.equal(await hash(f), item.sha256, `Target berubah sejak backup: ${rel}`);
  assert.equal(await hash(path.join(backup, 'files', rel)), item.sha256, `Backup rusak: ${rel}`); files++; bytes += s.size;
}
for (const rel of [...hapus, ...pindah.map(x => x.dari)]) await verifikasi(rel);
await mkdir('../docs/cleanup', { recursive: true });
await writeFile('../docs/cleanup/RENCANA-CLEANUP.json', JSON.stringify({ backup, verifikasi: 'PASS', files, bytes, hapus, pindah, alasan: 'Root diarsipkan di backup privat; output dapat dibangun ulang; START-HERE duplikat usang; splash-icon tidak direferensikan konfigurasi Expo atau runtime; dokumentasi dipusatkan tanpa menghapus bukti audit.' }, null, 2));
console.log(JSON.stringify({ status: 'PASS', files, bytes, hapus: hapus.length, pindah: pindah.length }));
