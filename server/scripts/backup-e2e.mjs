import "dotenv/config";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
const { default: db } = await import("../dist/lib/prisma.js");
const model = ["pelanggan","akunPelanggan","pengguna","barber","layanan","membership","pesanan","itemPesanan","pembayaran","riwayatStatusPesanan","passwordResetToken","permohonanPengaitanAkun","permohonanMembership","booking","itemBooking","usulanBarberBooking","riwayatBooking","transaksiPembayaranBooking","buktiProviderBooking","invoiceBooking","percobaanSnapBooking","permohonanRefundBooking"];
const snapshot = () => db.$transaction(async tx => { const hasil = {}; for (const nama of model) hasil[nama] = await tx[nama].findMany({orderBy:{id:"asc"}}); return JSON.stringify(hasil); }, {isolationLevel:"RepeatableRead"});
const tool = (nama,args,env=process.env,buang=false) => { const r=spawnSync(nama,args,{env,windowsHide:true,encoding:"utf8",stdio:["ignore",buang?"ignore":"pipe","pipe"],maxBuffer:8*1024*1024}); if(r.error||r.status!==0)throw new Error("BACKUP_TOOL_GAGAL");return r.stdout??""; };
try {
 const url=new URL(process.env.DATABASE_URL??"");assert.ok(["localhost","127.0.0.1","[::1]"].includes(url.hostname));
 const akar=path.resolve("../../backup-database");
 if(process.argv[2]) {
  const folder=path.resolve(process.argv[2]);assert.ok(folder.startsWith(akar+path.sep));
  assert.equal(await snapshot(),await readFile(path.join(folder,"snapshot.json"),"utf8"));
  assert.ok(tool("pg_restore",["--list",path.join(folder,"database.dump")]).includes("TABLE DATA public Pesanan "));
  tool("pg_restore",["--file=-",path.join(folder,"database.dump")],process.env,true);
  console.log("PASS backup dapat dibaca;22 model domain identik dengan snapshot sebelum pengujian.");
 } else {
  const sebelum=await snapshot(),folder=path.join(akar,`e2e-${new Date().toISOString().replace(/[:.]/g,"-")}`);
  await mkdir(folder,{recursive:false});const arsip=path.join(folder,"database.dump");
  tool("pg_dump",["--format=custom","--no-password","--file",arsip],{...process.env,PGHOST:url.hostname,PGPORT:url.port||"5432",PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password)});
  assert.ok(tool("pg_restore",["--list",arsip]).includes("TABLE DATA public Pesanan "));tool("pg_restore",["--file=-",arsip],process.env,true);
  assert.equal(await snapshot(),sebelum);await writeFile(path.join(folder,"snapshot.json"),sebelum,{flag:"wx"});
  console.log(JSON.stringify({folder,ukuran:(await stat(arsip)).size,terverifikasi:true}));
 }
}catch(e){console.error(`FAIL backup/snapshot (${e.name}); data dan credential tidak dicetak.`);process.exitCode=1;}
finally{await db.$disconnect();}
