// Tidak memuat credential dan tidak membuat transaksi. Payload kosong wajib ditolak.
import assert from 'node:assert/strict';
const target = process.argv[2] ?? 'http://127.0.0.1:3000';
const url = new URL(target);
assert.ok(url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash);
assert.ok(url.protocol === 'https:' || url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
try {
  const r = await fetch(new URL('/midtrans/notifications', url), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15000), redirect: 'error' });
  const body = await r.text();
  const ditemukan = r.status === 400 && body.includes('Notifikasi tidak valid');
  console.log(JSON.stringify({ route: '/midtrans/notifications', metode: 'POST', status: r.status, ditemukan, ngrok: /ERR_NGROK_\d+/.exec(body)?.[0] ?? null }));
  if (!ditemukan) process.exitCode = 1;
} catch { console.log('FAIL backend/tunnel belum dapat dijangkau; tidak ada transaksi dibuat.'); process.exitCode = 1; }
