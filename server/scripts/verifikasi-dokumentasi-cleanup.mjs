import { readdir, readFile, access, writeFile } from 'node:fs/promises';
import path from 'node:path';
const stage = path.resolve('../..'), hasil = [], rusak = [];
async function jalan(folder) {
  for (const e of await readdir(folder, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', '.expo', 'generated'].includes(e.name)) continue;
    const f = path.join(folder, e.name);
    if (e.isDirectory()) { await jalan(f); continue; }
    if (!f.endsWith('.md')) continue;
    const isi = await readFile(f, 'utf8');
    for (const m of isi.matchAll(/\]\(([^)]+)\)/g)) {
      const tujuan = m[1].split('#')[0];
      if (!tujuan || /^(https?:|app:|mailto:)/.test(tujuan)) continue;
      const lokasi = path.resolve(path.dirname(f), tujuan);
      try { await access(lokasi); hasil.push({ dokumen: path.relative(stage, f).replaceAll('\\', '/'), tujuan }); }
      catch { rusak.push({ dokumen: path.relative(stage, f).replaceAll('\\', '/'), tujuan }); }
    }
  }
}
for (const r of ['barberbarbar', 'barberbarbar-mobile', 'barberbarbar-customer']) await jalan(path.join(stage, r));
await writeFile('../docs/cleanup/TAUTAN-DOKUMENTASI.json', JSON.stringify({ lokalDiperiksa: hasil.length + rusak.length, valid: hasil.length, rusak, batas: 'Memeriksa keberadaan target tautan Markdown lokal; tidak menguji anchor atau URL eksternal.' }, null, 2));
console.log(JSON.stringify({ valid: hasil.length, rusak }));
if (rusak.length) process.exitCode = 1;
