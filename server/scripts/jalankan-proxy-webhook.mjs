// Development: hanya route webhook yang boleh diteruskan ke backend lokal.
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
const port = Number(process.env.WEBHOOK_PROXY_PORT ?? 3001);
const backend = Number(process.env.WEBHOOK_BACKEND_PORT ?? 3000);
for (const n of [port, backend]) assert.ok(Number.isInteger(n) && n > 1023 && n <= 65535);
assert.notEqual(port, backend);
const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST' || req.url !== '/midtrans/notifications') { res.writeHead(404); res.end(); return; }
  if (!req.headers['content-type']?.startsWith('application/json')) { res.writeHead(415); res.end(); return; }
  let ukuran = 0; const bagian = [];
  try {
    for await (const b of req) { ukuran += b.length; if (ukuran > 65536) { res.writeHead(413); res.end(); return; } bagian.push(b); }
    const jawaban = await fetch(`http://127.0.0.1:${backend}/midtrans/notifications`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: Buffer.concat(bagian), signal: AbortSignal.timeout(25000), redirect: 'error',
    });
    res.writeHead(jawaban.status, { 'Content-Type': 'application/json' }); res.end(await jawaban.text());
  } catch { if (!res.headersSent) res.writeHead(503); res.end('{"pesan":"Pembayaran belum dapat diverifikasi. Silakan coba lagi."}'); }
});
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.listen(port, '127.0.0.1', () => console.log(`Proxy webhook lokal siap pada port ${port}; route lain ditolak.`));
for (const sinyal of ['SIGINT', 'SIGTERM']) process.once(sinyal, () => server.close());
