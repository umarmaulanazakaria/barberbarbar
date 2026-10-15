import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const jumlah = Number(process.argv[2] ?? 5);
const label = process.argv[3] ?? 'sesudah';
assert.ok(Number.isInteger(jumlah) && jumlah >= 1 && jumlah <= 10);
assert.ok(/^[a-z-]+$/.test(label));
const hasil = [];
for (let urutan = 1; urutan <= jumlah; urutan++) {
  const output = `finalization/browser-${label}-${urutan}`;
  const mulai = Date.now();
  const anak = spawn(process.execPath, ['scripts/test-e2e-browser.mjs'], {
    env: { ...process.env, BB_AUDIT_OUTPUT_DIR: output },
    windowsHide: true, stdio: ['ignore', 'ignore', 'ignore'],
  });
  const exit = await new Promise(resolve => { anak.on('error', () => resolve(-1)); anak.on('close', resolve); });
  const bukti = JSON.parse(await readFile(path.join('../server', output, 'HASIL-BROWSER.json'), 'utf8'));
  const bersih = bukti.results.some(r => r.id === 'CLEANUP' && r.status === 'PASS');
  hasil.push({ urutan, exit, detik: Math.round((Date.now() - mulai) / 1000), status: exit === 0 && bersih ? 'PASS' : 'FAIL', cleanup: bersih, bukti: `${output}/HASIL-BROWSER.json` });
  console.log(JSON.stringify(hasil.at(-1)));
  if (!bersih) throw new Error('Cleanup gagal; hentikan sebelum fixture berikutnya');
}
await mkdir('../server/finalization', { recursive: true });
await writeFile(`../server/finalization/STABILITAS-${label}.json`, JSON.stringify({ jenis: 'Edge headless, browser UI aktual; SDK native adapter, provider MOCK', hasil }, null, 2));
if (hasil.some(r => r.status !== 'PASS')) process.exitCode = 1;
