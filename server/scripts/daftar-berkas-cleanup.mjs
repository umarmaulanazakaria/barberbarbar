import { execFileSync } from 'node:child_process';
import { lstat, writeFile } from 'node:fs/promises';
import path from 'node:path';
const stage = path.resolve('../..'), publik = [], staging = {};
const lindungi = new Set(['barberbarbar/server/src/lib/prisma.ts', 'barberbarbar-mobile/src/layar/LayarTambahPelanggan.tsx', 'barberbarbar-mobile/src/layanan/booking.ts']);
for (const r of ['barberbarbar', 'barberbarbar-mobile', 'barberbarbar-customer-web']) {
  const repo = path.join(stage, r);
  const git = args => execFileSync('git', ['-c', `safe.directory=${repo.replaceAll('\\', '/')}`, '-C', repo, ...args], { encoding: 'utf8', windowsHide: true });
  const daftar = new Set([...git(['diff', 'HEAD', '--name-only', '-z']).split('\0'), ...git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0')].filter(Boolean));
  staging[r] = [];
  for (const f of [...daftar].sort()) {
    const rel = `${r}/${f}`;
    if (lindungi.has(rel)) continue;
    if (f.split('/').some(p => ['node_modules', '.git', 'dist', '.expo', 'artifacts'].includes(p) || (p.startsWith('.env') && !['.env.example', '.env.sample'].includes(p)))) throw new Error('Path privat/output masuk daftar cleanup');
    staging[r].push(f);
    try { if ((await lstat(path.join(repo, f))).isFile()) publik.push(rel); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
}
await writeFile('artifacts/cleanup/PATH-COMMIT.json', JSON.stringify(staging, null, 2));
// Manifest ini sendiri masuk pemindaian dan staging meskipun baru dibuat.
if (!publik.includes('barberbarbar/docs/cleanup/BERKAS-CLEANUP.json')) publik.push('barberbarbar/docs/cleanup/BERKAS-CLEANUP.json');
await writeFile('../docs/cleanup/BERKAS-CLEANUP.json', JSON.stringify(publik.sort(), null, 2));
console.log(JSON.stringify({ publik: publik.length, pathPerRepo: Object.fromEntries(Object.entries(staging).map(([r, f]) => [r, f.length])) }));
