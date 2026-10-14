import "dotenv/config";
import assert from "node:assert/strict";
import {randomBytes,randomUUID} from "node:crypto";
import {once} from "node:events";
import {createInterface} from "node:readline";
import bcrypt from "bcrypt";
if(process.env.MIDTRANS_IS_PRODUCTION!=="false" || !["localhost","127.0.0.1","[::1]"].includes(new URL(process.env.DATABASE_URL??"").hostname))throw new Error("Hanya Sandbox/database lokal");
const {default:db}=await import("../dist/lib/prisma.js"),{default:app}=await import("../dist/app.js");
const {loginPelanggan}=await import("../dist/services/auth-pelanggan.service.js");
const tanda=`sandbox-f7-${randomUUID()}`,password=randomBytes(24).toString("hex");
let p,admin,barber,layanan,b,server,alamat;
const utc=kerja=>db.$transaction(async tx=>{await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;return kerja(tx);});
const http=async(path,method="GET",body,token)=>{const r=await fetch(`${alamat}${path}`,{method,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:r.status,body:await r.json()};};
try{
 const hash=await bcrypt.hash(password,10);
 p=await db.pelanggan.create({data:{nama:tanda,nomorTelepon:`08${randomBytes(8).readBigUInt64BE().toString().slice(0,11)}`,akunPelanggan:{create:{email:`${tanda}@example.invalid`,passwordHash:hash}}}});
 admin=await db.pengguna.create({data:{name:tanda,email:`${tanda}-admin@example.invalid`,passwordHash:hash,role:"ADMIN"}});
 barber=await db.barber.create({data:{nama:tanda}});layanan=await db.layanan.create({data:{nama:tanda,harga:10000,durasiMenit:30}});
 server=app.listen(Number(process.env.PORT??3000),"127.0.0.1");await once(server,"listening");alamat=`http://127.0.0.1:${server.address().port}`;
 p.token=(await loginPelanggan({identitas:`${tanda}@example.invalid`,password})).token;
 admin.token=(await http("/auth/login","POST",{email:admin.email,password})).body.token;
 const jadwal=`${new Date(Date.now()+7*3600000+2*86400000).toISOString().slice(0,10)}T11:00:00+07:00`;
 const r=await http("/customer/bookings","POST",{mulaiPada:jadwal,barberPilihanId:barber.id,items:[{layananId:layanan.id,qty:1}]},p.token);
 assert.equal(r.status,201);b=r.body.booking;assert.equal((await http(`/bookings/${b.id}/confirm`,"POST",{},admin.token)).status,200);
 const snap=await http(`/customer/bookings/${b.id}/payments/dp`,"POST",{kunciIdempotensi:randomUUID()},p.token);
 if(snap.status!==200){const kode=/\((HTTP_\d{3}|NETWORK_OR_INVALID_RESPONSE)\)/.exec(snap.body.pesan??"")?.[1]??"UNCLASSIFIED";console.log(`Diagnosis provider: ${kode}`);throw new Error(`Snap HTTP ${snap.status}`);}
 console.log("PASS SANDBOX: Snap DP5000 dibuat provider nyata. URL checkout sementara (developer only; jangan disimpan Git/ZIP):");
 console.log(snap.body.redirect_url);
 const input=createInterface({input:process.stdin,output:process.stdout});
 console.log("Perintah: sync, start, complete, settlement, cancel, refund, finish. Tidak ada command paid/fixture proof.");
 for await(const baris of input){
  const aksi=baris.trim();
  if(aksi==="finish"){input.close();break;}
  let hasil;
  if(aksi==="sync"){
   const transaksi=await db.transaksiPembayaranBooking.findMany({where:{bookingId:b.id,kanal:"MIDTRANS",tujuan:{not:"REFUND"}},select:{id:true}});
   for(const t of transaksi)hasil=await http(`/customer/payments/${t.id}/sync`,"POST",{},p.token);
   console.log(`Sinkronisasi HTTP ${hasil?.status}`);
  }else if(aksi==="start"){
   hasil=await http(`/bookings/${b.id}/check-in`,"POST",{},admin.token);console.log(`Check-in HTTP ${hasil.status}`);
   hasil=await http(`/bookings/${b.id}/start`,"POST",{barberId:barber.id},admin.token);console.log(`Start HTTP ${hasil.status}`);
  }else if(aksi==="complete"){
   hasil=await http(`/bookings/${b.id}/complete`,"POST",{},admin.token);console.log(`Complete HTTP ${hasil.status}`);
  }else if(aksi==="settlement"){
   hasil=await http(`/customer/bookings/${b.id}/payments/online-settlement`,"POST",{kunciIdempotensi:randomUUID()},p.token);
   console.log(`Snap pelunasan HTTP ${hasil.status}`);if(hasil.status===200)console.log(hasil.body.redirect_url);
  }else if(aksi==="cancel"){
   hasil=await http(`/customer/bookings/${b.id}/cancel`,"POST",{},p.token);console.log(`Cancel HTTP ${hasil.status}`);
  }else if(aksi==="refund"){
   const req=await db.permohonanRefundBooking.findFirst({where:{bookingId:b.id},select:{id:true,status:true}});
   if(req){hasil=await http(`/refund-requests/${req.id}/${req.status==="PENDING_APPROVAL"?"approve":"retry"}`,"POST",req.status==="PENDING_APPROVAL"?{catatan:"Uji Sandbox dummy"}:{},admin.token);console.log(`Refund HTTP ${hasil.status}; ${hasil.body.refund?.status??"belum terkonfirmasi"}`);}
  }
  const ringkas=await http(`/customer/bookings/${b.id}/payments`,"GET",undefined,p.token);
  console.log(JSON.stringify({bookingId:b.id,statusPembayaran:ringkas.body.ringkasan.statusPembayaran,paid:ringkas.body.ringkasan.jumlahDibayar,refund:ringkas.body.ringkasan.jumlahRefund,balance:ringkas.body.ringkasan.balance}));
 }
}catch(err){console.error(`FAIL SANDBOX (${err instanceof Error && /^Snap HTTP \d+$/.test(err.message)?err.message:err.name}); credential tidak dicetak.`);process.exitCode=1;}
finally{
 try{
  if(p){const books=await db.booking.findMany({where:{pelangganId:p.id},select:{id:true,pesananId:true}});const ids=books.map(b=>b.id),orders=books.filter(b=>b.pesananId).map(b=>b.pesananId);
   await utc(async tx=>{await tx.permohonanRefundBooking.deleteMany({where:{bookingId:{in:ids}}});await tx.invoiceBooking.deleteMany({where:{bookingId:{in:ids}}});
    await tx.transaksiPembayaranBooking.deleteMany({where:{bookingId:{in:ids},tujuan:"REFUND"}});await tx.transaksiPembayaranBooking.deleteMany({where:{bookingId:{in:ids}}});
    await tx.booking.deleteMany({where:{id:{in:ids}}});await tx.pembayaran.deleteMany({where:{pesananId:{in:orders}}});await tx.pesanan.deleteMany({where:{id:{in:orders}}});await tx.pelanggan.delete({where:{id:p.id}});});}
  if(admin)await db.pengguna.delete({where:{id:admin.id}});if(layanan)await db.layanan.delete({where:{id:layanan.id}});if(barber)await db.barber.delete({where:{id:barber.id}});
  console.log("Fixture Sandbox lokal dibersihkan; transaksi pada dashboard Sandbox provider tetap sebagai riwayat pengujian.");
 }finally{try{if(server)await new Promise(resolve=>server.close(resolve));}finally{await db.$disconnect();}}
}
