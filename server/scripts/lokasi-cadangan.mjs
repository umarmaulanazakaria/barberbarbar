import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const akarCadangan = path.resolve(process.env.LOCALAPPDATA, 'BARBERBARBAR/database-backups');
const workspace = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
assert.ok(akarCadangan !== workspace && !akarCadangan.startsWith(workspace + path.sep));
export function periksaCadangan(folder) {
  const lokasi = path.resolve(folder);
  assert.ok(lokasi.startsWith(akarCadangan + path.sep), 'Gunakan folder backup privat di luar Stage 2');
  return lokasi;
}
