import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
const results = [];
for (const jenis of ['rejection', 'exception', 'disconnect']) {
  const tempat = createServer(); tempat.listen(0, '127.0.0.1'); await once(tempat, 'listening');
  const port = tempat.address().port; await new Promise(r => tempat.close(r));
  const child = fork(new URL('./jalankan-server-uji-log.mjs', import.meta.url), [], { windowsHide: true, execArgv: [], env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let keluaran = ''; child.stdout.on('data', b => keluaran += b); child.stderr.on('data', b => keluaran += b);
  const exit = once(child, 'exit');
  try {
    let siap = false;
    for (let n = 0; n < 150; n++) { try { siap = (await fetch(`http://127.0.0.1:${port}/`)).status === 200; } catch {} if (siap) break; if (child.exitCode !== null) break; await new Promise(r => setTimeout(r, 40)); }
    assert.ok(siap, 'Server uji harus siap sebelum injeksi error sintetis'); child.send(jenis);
    const [kode] = await exit;
    let tertutup = false; try { await fetch(`http://127.0.0.1:${port}/`); } catch { tertutup = true; }
    const logAman = !keluaran.includes('E2E_RAHASIA_PROSES');
    results.push({ jenis, kode, logAman, listenerTertutup: tertutup, status: kode === 1 && logAman && tertutup ? 'PASS' : 'FAIL' });
  } finally { if (child.exitCode === null) child.kill(); }
}
const output = process.env.BB_AUDIT_OUTPUT_DIR ?? 'finalization'; await mkdir(output, { recursive: true });
await writeFile(`${output}/HASIL-LOG-PROSES.json`, JSON.stringify({ jenis: 'Entrypoint aktual, error sintetis, tanpa mutasi DB/provider', results }, null, 2));
console.log(JSON.stringify(results));
assert.ok(results.every(r => r.status === 'PASS'), 'Fatal error/shutdown tidak boleh mencetak error mentah dan wajib menutup listener');
