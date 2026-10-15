import { readdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
const stage = path.resolve('../..');
const plan = JSON.parse(await readFile('../docs/cleanup/RENCANA-CLEANUP.json', 'utf8'));
const awal = JSON.parse(await readFile(path.join(plan.backup, 'RINGKASAN-AWAL.json'), 'utf8'));
const inventaris = JSON.parse(await readFile(path.join(plan.backup, 'INVENTARIS-AWAL.json'), 'utf8'));
const valid = JSON.parse(await readFile(path.join(plan.backup, 'TERVERIFIKASI.json'), 'utf8'));
const dihapus = plan.hapus.map(target => {
  const item = inventaris.filter(x => x.path === target || x.path.startsWith(target + '/'));
  return { target, files: item.filter(x => x.jenis === 'file').length, directories: item.filter(x => x.jenis === 'directory').length, bytes: item.reduce((n, x) => n + x.bytes, 0) };
});
const akhir = { files: 0, directories: 0, links: 0 };
async function hitung(folder) {
  for (const e of await readdir(folder, { withFileTypes: true })) {
    if (e.isSymbolicLink()) akhir.links++;
    else if (e.isDirectory()) { akhir.directories++; await hitung(path.join(folder, e.name)); }
    else akhir.files++;
  }
}
await hitung(stage);
await writeFile('../docs/cleanup/HASIL-CLEANUP.json', JSON.stringify({ tanggal: new Date().toISOString(), awal: { files: awal.files, directories: awal.directories, links: awal.links, bytes: awal.bytes, kategori: awal.kategori }, backup: { lokasi: plan.backup, ...valid }, dihapus, dipindahkan: plan.pindah, dependency: { dihapus: ['eslint', 'tsx'], paketDihapusOlehNpm: 71, bukti: 'Tidak ada import runtime, command package/scripts, ESLint config, CI, dynamic registration, atau test consumer. dev.mjs menjalankan TypeScript CLI dan node watch langsung. Referensi dokumentasi menjelaskan sejarah alat, bukan consumer runtime.', batas: 'Dependency lain dipertahankan bila digunakan runtime/test/type/plugin/toolchain; pengurangan paket bukan klaim advisory selesai.' }, akhir, root: await readdir(stage), batasHitungan: 'Hitungan rekursif termasuk dependency terpasang dan .git; output build dibuat ulang selama regresi, bukan ukuran source saja. Daftar dihapus menunjukkan target awal sebelum rebuild; perubahan node_modules dari uninstall dicatat terpisah.' }, null, 2));
for (const f of ['HASIL-REGRESI.json', 'HASIL-INTEGRITAS.json', 'HASIL-DEPENDENCY.json', 'HASIL-BROWSER.json', 'HASIL-LOG.json', 'HASIL-LOG-PROSES.json']) {
  try { await copyFile(`artifacts/cleanup/${f}`, `../docs/cleanup/${f}`); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}
console.log(JSON.stringify({ awalFiles: awal.files, akhir, targets: dihapus.length, filesDihapusSebelumRebuild: dihapus.reduce((n, x) => n + x.files, 0), docsDipindahkan: plan.pindah.length }));
