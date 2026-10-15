import 'dotenv/config';
import { periksaCadangan } from './lokasi-cadangan.mjs';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.DATABASE_URL??'').hostname));
assert.ok(process.argv[2],'Berikan folder backup e2e');
const folder=periksaCadangan(process.argv[2]),stage=path.resolve('../..');
const {default:db}=await import('../dist/lib/prisma.js');
const models=['pelanggan','akunPelanggan','pengguna','barber','layanan','membership','pesanan','itemPesanan','pembayaran','riwayatStatusPesanan','passwordResetToken','permohonanPengaitanAkun','permohonanMembership','booking','itemBooking','usulanBarberBooking','riwayatBooking','transaksiPembayaranBooking','buktiProviderBooking','invoiceBooking','percobaanSnapBooking','permohonanRefundBooking'];
const digest=x=>createHash('sha256').update(x).digest('hex');
try{
 const data=await db.$transaction(async tx=>{const r={};for(const m of models)r[m]=await tx[m].findMany({orderBy:{id:'asc'}});return r;},{isolationLevel:'RepeatableRead'}),snapshot=JSON.stringify(data,(_k,v)=>typeof v==='bigint'?v.toString():v),baseline=await readFile(path.join(folder,'snapshot.json'),'utf8');
 assert.ok(snapshot===baseline,'22 model harus identik dengan baseline backup');
 const checks={};
 for(const [name,sql]of[
  ['bookingCustomer','SELECT count(*)::int AS n FROM "Booking" b LEFT JOIN "Pelanggan" p ON p.id=b."pelangganId" WHERE p.id IS NULL'],
  ['ledgerBooking','SELECT count(*)::int AS n FROM "TransaksiPembayaranBooking" t LEFT JOIN "Booking" b ON b.id=t."bookingId" WHERE b.id IS NULL'],
  ['invoiceBooking','SELECT count(*)::int AS n FROM "InvoiceBooking" i LEFT JOIN "Booking" b ON b.id=i."bookingId" WHERE b.id IS NULL'],
  ['refundSource','SELECT count(*)::int AS n FROM "PermohonanRefundBooking" r LEFT JOIN "TransaksiPembayaranBooking" t ON t.id=r."transaksiAsalId" WHERE t.id IS NULL OR t."bookingId"<>r."bookingId"'],
  ['invoiceDuplicate','SELECT count(*)::int AS n FROM (SELECT "bookingId" FROM "InvoiceBooking" GROUP BY "bookingId" HAVING count(*)>1) x'],
  ['hashFinal','SELECT count(*)::int AS n FROM "PermohonanPengaitanAkun" WHERE status IN (\'DISETUJUI\',\'DITOLAK\') AND "passwordHash"<>\'\''],
 ]){const [r]=await db.$queryRawUnsafe(sql);checks[name]=r.n;assert.equal(r.n,0,`Integritas ${name}`);}
 const protectedFiles=[];for(const rel of ['barberbarbar/server/src/lib/prisma.ts','barberbarbar-mobile/src/layar/LayarTambahPelanggan.tsx','barberbarbar-mobile/src/layanan/booking.ts'])protectedFiles.push({path:rel,sha256:digest(await readFile(path.join(stage,rel)))});
 const p3=path.resolve('..'),git=spawnSync('git',['-c',`safe.directory=${p3.replaceAll('\\','/')}`,'-C',p3,'ls-files','-s','server/src/lib/prisma.ts'],{encoding:'utf8',windowsHide:true});assert.ok(git.stdout.includes('6594970f6d44cfae4ac899cd83f14f6991dce0a0'));
 const hasil={status:'PASS',tanggal:new Date().toISOString(),snapshot22Identik:true,baselineSha256:digest(baseline),akhirSha256:digest(snapshot),jumlah:Object.fromEntries(models.map(m=>[m,data[m].length])),orphanDanIntegritas:checks,protectedFiles,prismaIndexTerjaga:true,catatan:'Hanya rows22 model dibandingkan; sequence fixture dapat maju. Backup/dump/snapshot berisi data sensitif tetap di luar Git/ZIP.'};
 await mkdir((process.env.BB_AUDIT_OUTPUT_DIR??'artifacts/regresi'),{recursive:true});await writeFile((process.env.BB_AUDIT_OUTPUT_DIR??'artifacts/regresi')+'/HASIL-INTEGRITAS.json',JSON.stringify(hasil,null,2));console.log(JSON.stringify({status:hasil.status,snapshot22Identik:true,checks,prismaIndexTerjaga:true}));
}finally{await db.$disconnect();}
