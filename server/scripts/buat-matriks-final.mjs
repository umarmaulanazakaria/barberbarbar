import { readFile, writeFile } from 'node:fs/promises';

const awal = JSON.parse(await readFile('e2e/MATRIKS-E2E.json', 'utf8'));
const regresi = JSON.parse(await readFile('finalization/HASIL-REGRESI.json', 'utf8')).results;
const dependency = JSON.parse(await readFile('finalization/HASIL-DEPENDENCY.json', 'utf8'));
const lulus = id => regresi.find(r => r.id === id)?.status === 'PASS';
const klasifikasi = r => {
  if (r.jenis === 'E') return ['B'];
  if (/email aktual/i.test(r.fitur)) return ['D'];
  if (/ubah password|perubahan email/i.test(r.fitur)) return ['E', 'G'];
  if (/REQ-14-17[789]|REQ-14-18[0-3]/.test(r.id)) return ['C', 'E', 'G'];
  if (r.jenis === 'F') return ['B', 'C'];
  if (/REQ-17/.test(r.id)) return ['F', 'G'];
  return ['A'];
};
const ditunda = awal.filter(r => r.status === 'DEFERRED').map(r => ({ id: r.id, fitur: r.fitur, kategori: klasifikasi(r), statusAwal: r.status, kebutuhan: r.catatan }));
const baris = awal.map(r => ({ ...r, riwayat: [{ fase: 'F13', status: r.status, actual: r.actual, bukti: r.bukti }], validasi: 'F14', kategori: r.status === 'DEFERRED' ? klasifikasi(r) : ['A'] }));
const ubah = (id, status, jenis, bukti, actual) => {
  const r = baris.find(x => x.id === id); if (!r) throw new Error('ID matriks tidak ditemukan');
  Object.assign(r, { status, jenis, bukti, actual, catatan: actual });
};
if (lulus('test-scheduler-booking')) ubah('REQ-11-111', 'PASS', 'G', 'HASIL-REGRESI.json:test-scheduler-booking', 'Proposal tetap PENDING dan booking CONFIRMED setelah2jam dengan DP sah sebelum jadwal; deadline booking normal tetap berlaku. Provider MOCK.');
if (lulus('test-realtime')) for (const id of ['REQ-14-158', 'REQ-14-164']) ubah(id, 'PASS', 'C', 'HASIL-REGRESI.json:test-realtime -> test-midtrans-f7', 'HTTP reschedule items/qty dan total60000->90000 dengan DP50000 cukup PASS; kenaikan memerlukan DPlebih besar ditolak409 dan row/items utuh. UI Customer edit service/qty belum tersedia, tidak diklaim PASS. Provider MOCK.');
if (dependency.results.every(r => r.lengkap?.jumlah && r.omitDev?.jumlah && r.terpasang)) for (const id of ['REQ-17-258', 'REQ-17-259', 'REQ-17-260', 'REQ-17-262', 'REQ-17-263']) ubah(id, 'PASS', 'G', 'HASIL-DEPENDENCY.json; F14-AUDIT.md', 'Audit versi terpasang/full/omit-dev dan triage source selesai; patch F13 dipertahankan. PASS pemeriksaan, bukan berarti advisory diperbaiki atau aman dieksploitasi; upgrade baru tidak dilakukan.');
ubah('REQ-17-261', 'DEFERRED', 'G', 'HASIL-DEPENDENCY.json; RELEASE-CHECKLIST.md', 'Koreksi pemetaan F13: suite realtime tidak membuktikan exploitability dependency. Reachability source ditinjau, exploit aktual belum dibuktikan; memerlukan analisis keamanan terpisah.');
ubah('REQ-16-243', 'NOT APPLICABLE', 'A', 'README-PENGUJIAN-ANDROID.md', 'Instruksi menandai device test, bukan assertion fitur. Seluruh UI Android tetap DEFERRED.');
baris.push({ id: 'BUG-04', fitur: 'Draf reschedule tidak ditimpa refetch detail', project: '5', prasyarat: 'Native host/hook adapter', langkah: 'node scripts/test-draf-jadwal-ulang.mjs', expected: 'Pilihan barber22/null bertahan; route2 memuat barber33', actual: 'Sebelum fix11 menggantikan22; setelah guard inisialisasi perID PASS', jenis: 'B', status: lulus('customer-draft') ? 'PASS' : 'FAIL', bukti: 'HASIL-REGRESI.json:customer-draft', catatan: 'Bukan UI Android', riwayat: [] });
baris.push({ id: 'BUG-05', fitur: 'Dialog Web memiliki semantik/fokus/Tab/Escape', project: '3', prasyarat: 'Edge headless existing', langkah: 'node client/scripts/test-e2e-browser.mjs', expected: 'Role/nama dialog, fokus cancel dan restore, Tab tetap di dalam, Escape membatalkan tanpa mutasi', actual: 'Role dialog tidak ditemukan sebelum fix; lihat checkpoint WEB-DIALOG sesudah fix', jenis: 'D', status: lulus('browser-e2e') ? 'PASS' : 'FAIL', bukti: 'HASIL-BROWSER.json:WEB-DIALOG', catatan: 'Tidak mengubah desain; bukan Android', riwayat: [] });
baris.push({ id: 'BUG-06', fitur: 'Fatal error dan shutdown tidak mencetak credential dalam error mentah', project: '3', prasyarat: 'Child entrypoint lokal, scheduler mati', langkah: 'node scripts/test-log-proses.mjs', expected: 'Tiga sentinel tidak masuk log; exit1 dan listener tertutup', actual: 'Ketiga kasus gagal sebelum fix; lihat hasil entrypoint sesudah perbaikan', jenis: 'G', status: lulus('process-log') ? 'PASS' : 'FAIL', bukti: 'HASIL-LOG-PROSES.json', catatan: 'Tidak mengubah data atau auth operator', riwayat: [] });
for (const r of ditunda) r.hasilAkhir = baris.find(x => x.id === r.id).status;
await writeFile('finalization/DEFERRED-54.json', JSON.stringify(ditunda, null, 2));
await writeFile('finalization/MATRIKS-E2E.json', JSON.stringify(baris, null, 2));
const aman = x => String(x ?? '').replaceAll('|', '/').replaceAll('\n', ' ');
await writeFile('finalization/MATRIKS-E2E.md', ['# Revalidasi matriks pengujian', '', 'Riwayat F13 ada pada setiap row JSON dan file e2e/MATRIKS-E2E.json tetap dipertahankan. PASS API/adapter bukan UI Android. Provider MOCK bukan Sandbox nyata. Kategori A=lingkungan saat ini; B=device; C=Midtrans; D=email; E=keputusan bisnis/ADMIN; F=dependency/sistem; G=input eksternal.', '', '|ID|Skenario|F13|F14|Jenis|Bukti dan batas|', '|---|---|---|---|---|---|', ...baris.map(r => '|' + [r.id, r.fitur, r.riwayat[0]?.status ?? '-', r.status, r.jenis, `${r.bukti}: ${r.actual}`].map(aman).join('|') + '|')].join('\n') + '\n');
console.log(JSON.stringify({ baris: baris.length, status: baris.reduce((d, r) => (d[r.status] = (d[r.status] ?? 0) + 1, d), {}), awalDitunda: ditunda.length }));
