import 'dotenv/config';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const server=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),web=path.resolve(server,'../client'),stage=path.resolve(server,'../..');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.DATABASE_URL??'').hostname));
assert.equal(process.env.MIDTRANS_IS_PRODUCTION,'false');
const {default:db}=await import('../dist/lib/prisma.js');
const models=['pelanggan','akunPelanggan','pengguna','barber','layanan','membership','pesanan','itemPesanan','pembayaran','riwayatStatusPesanan','passwordResetToken','permohonanPengaitanAkun','permohonanMembership','booking','itemBooking','usulanBarberBooking','riwayatBooking','transaksiPembayaranBooking','buktiProviderBooking','invoiceBooking','percobaanSnapBooking','permohonanRefundBooking'];
const snapshot=()=>db.$transaction(async tx=>{const data={};for(const m of models)data[m]=await tx[m].findMany({orderBy:{id:'asc'}});return JSON.stringify(data);},{isolationLevel:'RepeatableRead'});
const digest=x=>createHash('sha256').update(x).digest('hex');
const protectedPaths=[path.join(server,'src/lib/prisma.ts'),path.join(stage,'barberbarbar-mobile/src/layar/LayarTambahPelanggan.tsx'),path.join(stage,'barberbarbar-mobile/src/layanan/booking.ts')];
const protectedBefore=await Promise.all(protectedPaths.map(async p=>digest(await readFile(p))));
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',');
const output=path.resolve(server,(process.env.BB_AUDIT_OUTPUT_DIR??'artifacts/regresi')+'/HASIL-REGRESI.json');
const baseline=await snapshot(), results=only?JSON.parse(await readFile(output,'utf8')).results:[];
const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const tasks=[
 ['backend-ts',server,['node_modules/typescript/bin/tsc','--noEmit','--noUnusedLocals','--noUnusedParameters']],
 ...['test-fondasi-pelanggan','test-reset-password-pelanggan','test-api-publik','test-membership-f3','test-booking-f4','test-operasional-f5','test-payment-f6','test-scheduler-booking','test-realtime'].map(n=>[n,server,[`scripts/${n}.mjs`]]),
 ['web-build',web,[npm,'run','build']],['web-integration',web,['scripts/test-integrasi-web.mjs']],
 ['staff-ts',path.join(stage,'barberbarbar-mobile'),['node_modules/typescript/bin/tsc','--noEmit']],
 ['staff-expo-check',path.join(stage,'barberbarbar-mobile'),['node_modules/expo/bin/cli','install','--check']],
 ['staff-android-export',path.join(stage,'barberbarbar-mobile'),['node_modules/expo/bin/cli','export','--platform','android','--output-dir','dist']],
 ['staff-integration',path.join(stage,'barberbarbar-mobile'),['scripts/test-integrasi-mobile.mjs']],
 ['customer-ts',path.join(stage,'barberbarbar-customer'),['node_modules/typescript/bin/tsc','--noEmit']],
 ['customer-expo-check',path.join(stage,'barberbarbar-customer'),['node_modules/expo/bin/cli','install','--check']],
 ['customer-android-export',path.join(stage,'barberbarbar-customer'),['node_modules/expo/bin/cli','export','--platform','android','--output-dir','dist']],
 ['customer-dropdown',path.join(stage,'barberbarbar-customer'),['scripts/test-pilihan-barber.mjs']],
 ['customer-integration',path.join(stage,'barberbarbar-customer'),['scripts/test-customer.mjs']],
 ['customer-detail',path.join(stage,'barberbarbar-customer'),['scripts/test-detail-customer.mjs']],
 ['reschedule-boundary',server,['scripts/test-batas-reschedule-e2e.mjs']],
 ['browser-e2e',web,['scripts/test-e2e-browser.mjs']],
 ['log-safety',server,['scripts/test-log-aman-e2e.mjs']],
 ['customer-draft',path.join(stage,'barberbarbar-customer'),['scripts/test-draf-jadwal-ulang.mjs']],
 ['process-log',server,['scripts/test-log-proses.mjs']],
];
await mkdir(path.dirname(output),{recursive:true});
try {
 for(const [id,cwd,args] of tasks){
  if(only&&!only.includes(id))continue;
  console.log(`MULAI ${id}`);const start=Date.now();let out='',err='';
  const child=spawn(process.execPath,args,{cwd,env:{...process.env,CI:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);
  const exit=await new Promise(resolve=>{child.on('error',()=>resolve(-1));child.on('close',resolve);});
  // Jangan menyimpan raw assertion dump yang bisa berisi data existing/credential.
  const bukti=out.split(/\r?\n/).filter(s=>/^(PASS|LULUS|Total:|TOTAL|HASIL:|Dependencies are up to date|Android Bundled|Exported:|✓ built)/.test(s));
  const same=await snapshot()===baseline;
  const r={id,status:exit===0&&same?'PASS':'FAIL',exit,detik:Math.round((Date.now()-start)/1000),bukti,snapshot22Identik:same,outputSha256:digest(out),warningPg:err.includes('DeprecationWarning'),warningBundling:err.includes('chunk'),sandboxError:/Access is denied|permission denied|EPERM/.test(out+err)};const old=results.findIndex(x=>x.id===id);if(old>=0){r.sebelumnya=[...(results[old].sebelumnya??[]),{status:results[old].status,exit:results[old].exit}];results[old]=r;}else results.push(r);
  await writeFile(output,JSON.stringify({tanggal:'2026-10-15',jenis:'regresi lokal; native adapter/provider MOCK bukan device/Sandbox nyata',results},null,2));
  console.log(`${r.status} ${id}; exit=${exit}; snapshot22=${same}; bukti=${bukti.length}`);
  if(!same)throw new Error('SNAPSHOT_EXISTING_BERUBAH: hentikan suite berikutnya');
 }
 const after=await Promise.all(protectedPaths.map(async p=>digest(await readFile(p))));assert.ok(after.every((h,i)=>h===protectedBefore[i]));
 console.log(`AKHIR ${results.filter(r=>r.status==='PASS').length}/${results.length} PASS; file historis dan 22 model identik.`);
 if(results.some(r=>r.status!=='PASS'))process.exitCode=1;
}catch(e){console.error(`FAIL orchestrator: ${e instanceof Error?e.message:'unknown'}; raw data tidak dicetak`);process.exitCode=1;}
finally{await db.$disconnect();}
