import assert from 'node:assert/strict';
import { readdir, lstat, mkdir, readFile, writeFile, copyFile, statfs } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const stage = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const basis = path.resolve(process.env.LOCALAPPDATA, 'BARBERBARBAR/workspace-backups');
assert.ok(!basis.startsWith(stage + path.sep) && basis !== stage);
const folder = process.argv[3] ? path.resolve(process.argv[3]) : path.join(basis, `cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
assert.ok(folder.startsWith(basis + path.sep), 'Cadangan harus di folder privat yang ditentukan');
const repo = ['barberbarbar', 'barberbarbar-mobile', 'barberbarbar-customer-web'];
const hash = async lokasi => { const h = createHash('sha256'); for await (const b of createReadStream(lokasi)) h.update(b); return h.digest('hex'); };
const kategori = rel => {
  if (rel.split('/').some(p => p === '.git') || /(^|\/)(package(-lock)?\.json|tsconfig[^/]*|app\.json|\.env[^/]*|[^/]*config[^/]*)$/.test(rel)) return 'B';
  if (/(^|\/)(dist|build|coverage|\.expo|\.cache|node_modules)(\/|$)|\.tsbuildinfo$|\.log$/.test(rel)) return 'F';
  if (!repo.some(r => rel.startsWith(r + '/'))) return rel === '.hintrc' ? 'G' : 'E';
  if (/\.(zip|sha256|dump)$|\/F\d+-(AUDIT|SANDBOX)\.md$|\/server\/(e2e|finalization)\//.test(rel)) return 'E';
  if (/\/scripts\/|\.(test|spec)\./.test(rel)) return 'C';
  if (/\.(md|txt)$/.test(rel)) return 'D';
  return 'A';
};
const dipilih = rel => !rel.includes('/node_modules/') || rel.startsWith('barberbarbar/server/node_modules/') || rel.includes('/node_modules/.cache/');

if (process.argv[2] === 'inventaris') {
  await mkdir(basis, { recursive: true }); await mkdir(folder, { recursive: false });
  const semua = [], antre = ['']; let laporBerikutnya = 10000;
  while (antre.length) {
    const rel = antre.pop();
    for (const e of await readdir(path.join(stage, rel), { withFileTypes: true })) {
      const p = path.posix.join(rel, e.name), s = await lstat(path.join(stage, p));
      const jenis = e.isDirectory() ? 'directory' : e.isSymbolicLink() ? 'link' : 'file';
      semua.push({ path: p, jenis, bytes: jenis === 'file' ? s.size : 0, kategori: kategori(p), dicadangkan: jenis === 'file' && dipilih(p) });
      if (jenis === 'directory') antre.push(p);
    }
    if (semua.length >= laporBerikutnya) { console.log(`Inventaris ${semua.length} item`); laporBerikutnya += 10000; }
  }
  const ringkas = { stage, folder, tanggal: new Date().toISOString(), files: semua.filter(x => x.jenis === 'file').length, directories: semua.filter(x => x.jenis === 'directory').length, links: semua.filter(x => x.jenis === 'link').length, bytes: semua.reduce((n, x) => n + x.bytes, 0), kategori: Object.fromEntries('ABCDEFGH'.split('').map(k => [k, semua.filter(x => x.kategori === k).length])), pilihan: semua.filter(x => x.dicadangkan).length, byteCadangan: semua.filter(x => x.dicadangkan).reduce((n, x) => n + x.bytes, 0), pengecualian: 'node_modules Mobile/Web dipertahankan, kecuali .cache yang dibackup; server node_modules dicadangkan penuh untuk uninstall dependency terverifikasi' };
  await writeFile(path.join(folder, 'INVENTARIS-AWAL.json'), JSON.stringify(semua));
  await writeFile(path.join(folder, 'RINGKASAN-AWAL.json'), JSON.stringify(ringkas, null, 2));
  console.log(JSON.stringify(ringkas));
} else if (process.argv[2] === 'cadangkan') {
  const semua = JSON.parse(await readFile(path.join(folder, 'INVENTARIS-AWAL.json'), 'utf8')).filter(x => x.dicadangkan);
  const total = semua.reduce((n, x) => n + x.bytes, 0), disk = await statfs(basis);
  assert.ok(disk.bavail * disk.bsize > total + 512 * 1024 * 1024, 'Ruang backup tidak cukup');
  const hasil = []; let posisi = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (posisi < semua.length) {
      const item = semua[posisi++];
      assert.ok(!path.isAbsolute(item.path) && !item.path.split('/').includes('..'));
      const asal = path.resolve(stage, item.path), tujuan = path.resolve(folder, 'files', item.path);
      assert.ok(asal.startsWith(stage + path.sep) && tujuan.startsWith(path.join(folder, 'files') + path.sep));
      await mkdir(path.dirname(tujuan), { recursive: true });
      const sebelum = await hash(asal); await copyFile(asal, tujuan);
      const sesudah = await hash(tujuan); assert.equal(sesudah, sebelum, 'Hash cadangan tidak cocok');
      hasil.push({ path: item.path, bytes: item.bytes, sha256: sesudah });
      if (hasil.length % 5000 === 0) console.log(`Backup terverifikasi ${hasil.length}/${semua.length}`);
    }
  }));
  for (const r of repo) for (const [nama, arg] of [['unstaged.patch', ['diff', '--binary']], ['staged.patch', ['diff', '--cached', '--binary']]]) {
    const p = path.join(stage, r);
    const isi = execFileSync('git', ['-c', `safe.directory=${p.replaceAll('\\', '/')}`, '-C', p, ...arg], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    await mkdir(path.join(folder, 'git-state', r), { recursive: true }); await writeFile(path.join(folder, 'git-state', r, nama), isi);
  }
  hasil.sort((a, b) => a.path.localeCompare(b.path));
  const manifest = path.join(folder, 'MANIFEST-BACKUP.json');
  await writeFile(manifest, JSON.stringify({ tanggal: new Date().toISOString(), stage, jumlah: hasil.length, total, files: hasil }, null, 2));
  await writeFile(path.join(folder, 'MANIFEST-BACKUP.sha256'), `${await hash(manifest)}  MANIFEST-BACKUP.json\n`);
  await writeFile(path.join(folder, 'TERVERIFIKASI.json'), JSON.stringify({ status: 'PASS', files: hasil.length, total, setiapFileDibacaDanSHA256Cocok: true, manifestSha256: await hash(manifest) }, null, 2));
  console.log(JSON.stringify({ folder, status: 'PASS', files: hasil.length, total }));
} else throw new Error('Gunakan inventaris atau cadangkan');
