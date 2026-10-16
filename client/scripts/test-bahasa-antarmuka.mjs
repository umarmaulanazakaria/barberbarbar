import assert from 'node:assert/strict';
import { readFile, readdir, writeFile, unlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { build } from 'esbuild';
const require = createRequire(path.resolve('package.json'));
const stage = path.resolve('../..');
const files = ['barberbarbar/client/src/lib/teks.ts', 'barberbarbar-mobile/src/layanan/teks.ts'];
const sumber = await Promise.all(files.map(f => readFile(path.join(stage, f), 'utf8')));
assert.ok(sumber.every(s => s === sumber[0]), 'Kamus operator Web dan Staff harus konsisten');
const js = ts.transpileModule(sumber[0], { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const teks = await import('data:text/javascript,' + encodeURIComponent(js));
for (const [kode, label] of Object.entries({ PENDING_CONFIRMATION: 'Menunggu Konfirmasi', CONFIRMED: 'Booking Dikonfirmasi',
  CHECKED_IN: 'Sudah Check-in', IN_SERVICE: 'Sedang Dilayani', COMPLETED: 'Layanan Selesai', PAID: 'Pembayaran Berhasil',
  OVERDUE: 'Pembayaran Belum Dilunasi', AWAITING_DP: 'Menunggu Pembayaran Uang Muka' })) assert.equal(teks.statusRamah(kode), label);
assert.notEqual(teks.statusRamah('PENDING'), teks.statusRamah('PAID'));
assert.notEqual(teks.statusRamah('PROCESSING'), teks.statusRamah('SUCCEEDED'));
assert.equal(teks.statusRamah('INTERNAL_UNKNOWN'), 'Status Diperbarui');
for (const raw of ['JWT expired', 'RAHASIA_TANPA_SPASI', 'Internal Server Error', '{"error":"secret"}', 'Prisma Error: internal', 'at handler (app.ts:1)', '<html>bad</html>', 'https://internal/endpoint']) assert.equal(teks.pesanAman(raw, 'AMAN'), 'AMAN');
assert.equal(teks.pesanAman('Pilih tanggal dan jam yang valid.'), 'Pilih tanggal dan jam yang valid.');
assert.equal(teks.rincianRamah({ passwordHash: 'RAHASIA', order_id: 'INTERNAL', alasan: 'Barber berhalangan' }), 'Barber berhalangan');
let jumlahFile = 0; const temuan = [];
async function scan(folder) {
  for (const e of await readdir(folder, { withFileTypes: true })) {
    const f = path.join(folder, e.name);
    if (e.isDirectory()) { await scan(f); continue; }
    if (!f.endsWith('.tsx') || f.endsWith('Pratinjau.tsx')) continue;
    jumlahFile++;
    const ast = ts.createSourceFile(f, await readFile(f, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(n) {
      let tampil;
      if (ts.isJsxText(n)) tampil = n.text;
      if (ts.isJsxAttribute(n) && /^(?:title|subtitle|description|placeholder|aria-label|accessibilityLabel|judul|pesan)$/.test(n.name.getText(ast)) && n.initializer && ts.isStringLiteral(n.initializer)) tampil = n.initializer.text;
      if (tampil && /\b(?:backend|webhook|callback|endpoint|JWT|API|scheduler|snapshot|provider|developer|debug|mock|F1[234]|Project [345])\b/i.test(tampil)) temuan.push(path.relative(stage, f));
      if (ts.isJsxExpression(n) && n.expression && ts.isCallExpression(n.expression) && n.expression.expression.getText(ast) === 'JSON.stringify') temuan.push(path.relative(stage, f));
      ts.forEachChild(n, visit);
    } visit(ast);
  }
}
for (const r of ['barberbarbar/client/src', 'barberbarbar-mobile/src', 'barberbarbar-customer-web/src']) await scan(path.join(stage, r));
assert.deepEqual(temuan, [], 'Literal UI teknis/JSON mentah masih ditemukan');
const output = path.join(os.tmpdir(), `bb-copy-${randomUUID()}.mjs`);
try {
  const hasil = await build({ stdin: { contents: `export {default as PembayaranBooking} from './src/components/PembayaranBooking'; export {ToastProvider} from './src/context/ToastContext'; export {renderToStaticMarkup} from 'react-dom/server'; export {createElement} from 'react'; export {QueryClient, QueryClientProvider} from '@tanstack/react-query';`, resolveDir: process.cwd(), sourcefile: 'uji-copy.tsx' }, bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external', plugins: [{ name: 'paket-lokal', setup(b) { b.onResolve({ filter: /^[^./]/ }, a => a.path.startsWith('node:') ? undefined : { path: pathToFileURL(require.resolve(a.path)).href, external: true }); } }] });
  await writeFile(output, hasil.outputFiles[0].text);
  const m = await import(pathToFileURL(output));
  for (const percobaan of [true, false]) {
    const q = new m.QueryClient({ defaultOptions: { queries: { retry: false } } });
    const b = { id: 1, nomorBooking: 'DUMMY', status: 'CONFIRMED', dibuatPada: new Date().toISOString(), mulaiPada: new Date().toISOString(), discountPercent: 0, riwayat: [], usulanBarber: [] };
    q.setQueryData(['booking-payments', 1], { pembayaranPercobaan: percobaan, statusPembayaran: 'AWAITING_DP', subtotal: 10000, total: 10000, diskon: 0, nominalDpAwal: 5000, dpTerverifikasi: false, jumlahDibayar: 0, balance: 10000, kelebihan: 0, invoice: null, transaksi: [] });
    const html = m.renderToStaticMarkup(m.createElement(m.QueryClientProvider, { client: q }, m.createElement(m.ToastProvider, null, m.createElement(m.PembayaranBooking, { booking: b }))));
    assert.equal(html.includes(teks.pesanPembayaranPercobaan), percobaan);
    assert.ok(html.includes('Menunggu Pembayaran Uang Muka'));
    assert.ok(!html.includes('Pembayaran Berhasil'));
    assert.ok(!/Sandbox|COMPLETED|PAID|backend|provider/.test(html));
    q.clear();
  }
} finally { await unlink(output).catch(() => {}); }
console.log(`PASS UI-COPY: ${jumlahFile} file TSX dipindai; label tiga aplikasi, pesan aman, dan komponen pembayaran Web mode percobaan/non-percobaan PASS. SSR/adapter bukan device.`);
