import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { akarCadangan, periksaCadangan } from './lokasi-cadangan.mjs';
assert.equal(periksaCadangan(path.join(akarCadangan, 'uji')), path.join(akarCadangan, 'uji'));
for (const lokasi of [akarCadangan, path.resolve('../..'), path.join(akarCadangan, '..', 'folder-lain'), akarCadangan + '-lain/uji']) assert.throws(() => periksaCadangan(lokasi));
let jumlah = 0;
for (const folder of ['scripts', '../client/scripts']) for (const f of await readdir(folder)) if (f.endsWith('.mjs')) {
  const r = spawnSync(process.execPath, ['--check', path.join(folder, f)], { windowsHide: true, stdio: 'pipe' });
  assert.equal(r.status, 0, `Sintaks ${folder}/${f}`); jumlah++;
}
const paket = JSON.parse(await readFile('package.json', 'utf8'));
assert.ok(!paket.devDependencies.eslint && !paket.devDependencies.tsx);
console.log(`PASS guard lokasi backup: satu path sah, empat path tidak sah ditolak; sintaks ${jumlah} script; dependency unused tidak terdaftar.`);
