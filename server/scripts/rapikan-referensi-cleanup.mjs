import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
const stage = path.resolve('../..');
const plan = JSON.parse(await readFile('../docs/cleanup/RENCANA-CLEANUP.json', 'utf8'));
const pindah = new Map(plan.pindah.map(p => [path.resolve(stage, p.dari), path.resolve(stage, p.ke)]));
const balik = new Map([...pindah].map(([a, b]) => [b, a]));
async function jalan(folder) {
  for (const e of await readdir(folder, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', '.expo', 'generated'].includes(e.name)) continue;
    const f = path.join(folder, e.name);
    if (e.isDirectory()) { await jalan(f); continue; }
    if (!f.endsWith('.md')) continue;
    const lama = balik.get(f) ?? f, asli = await readFile(f, 'utf8');
    let isi = asli.replace(/\]\(([^)]+)\)/g, (penuh, link) => {
      if (/^(https?:|#|app:)/.test(link)) return penuh;
      const [tujuan, fragment] = link.split('#');
      const absolut = path.resolve(path.dirname(lama), tujuan);
      const baru = pindah.get(absolut) ?? absolut;
      return `](${path.relative(path.dirname(f), baru).split(path.sep).join('/')}${fragment ? '#' + fragment : ''})`;
    });
    if (balik.has(f)) isi = `> Dokumen historis dipindahkan dari \`${path.relative(stage, lama).split(path.sep).join('/')}\`. Hasil dan path bukti mencatat waktu audit; panduan aktif ada di README utama dan laporan cleanup. Arsip privat kini berada di luar Stage 2.\n\n${isi}`;
    if (isi !== asli) await writeFile(f, isi);
  }
}
for (const r of ['barberbarbar', 'barberbarbar-mobile', 'barberbarbar-customer']) await jalan(path.join(stage, r));
console.log('PASS tautan relatif dokumentasi dipetakan ke lokasi baru; bukti historis dipertahankan.');
