import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
let jumlah = 0;
const backend = createServer((req, res) => { jumlah++; assert.equal(req.url, '/midtrans/notifications'); res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"pesan":"Notifikasi tidak valid"}'); });
backend.listen(0, '127.0.0.1'); await once(backend, 'listening');
const tempat = createServer(); tempat.listen(0, '127.0.0.1'); await once(tempat, 'listening'); const port = tempat.address().port; await new Promise(r => tempat.close(r));
const child = spawn(process.execPath, ['scripts/jalankan-proxy-webhook.mjs'], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, WEBHOOK_PROXY_PORT: String(port), WEBHOOK_BACKEND_PORT: String(backend.address().port) } });
try {
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('PROXY_TIMEOUT')), 5000); child.stdout.once('data', () => { clearTimeout(timer); resolve(); }); child.once('error', reject); });
  const alamat = `http://127.0.0.1:${port}`;
  for (const jalur of ['/', '/orders', '/auth/login', '/public/services', '/midtrans/notifications?x=1']) assert.equal((await fetch(alamat + jalur, { method: 'POST' })).status, 404);
  assert.equal((await fetch(alamat + '/midtrans/notifications')).status, 404);
  assert.equal((await fetch(alamat + '/midtrans/notifications', { method: 'POST', body: '{}' })).status, 415);
  assert.equal(jumlah, 0);
  assert.equal((await fetch(alamat + '/midtrans/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
  assert.equal(jumlah, 1);
  await new Promise(r => backend.close(r));
  assert.equal((await fetch(alamat + '/midtrans/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 503);
  console.log('PASS WEBHOOK-PROXY: hanya POST JSON path tepat diteruskan; enam route/metode lain ditolak; backend gagal menghasilkan 503, bukan 200. Tanpa DB/provider.');
} finally { child.kill(); if (backend.listening) await new Promise(r => backend.close(r)); }
