import "dotenv/config";
import assert from "node:assert/strict";
import {randomBytes,randomUUID,createHash} from "node:crypto";
import {once} from "node:events";
import bcrypt from "bcrypt";
if(!["localhost","127.0.0.1","[::1]"].includes(new URL(process.env.DATABASE_URL??"").hostname))throw new Error("Fixture hanya DB lokal");
const {default:db}=await import("../dist/lib/prisma.js");
const {default:app}=await import("../dist/app.js");
const {loginPelanggan}=await import("../dist/services/auth-pelanggan.service.js");
const {hitungUangBooking}=await import("../dist/lib/uang-booking.js");
const {bayarPelunasanKasirBooking}=await import("../dist/services/pembayaran-booking.service.js");
const tanda=`uji-f6-${randomUUID()}`,password=randomBytes(18).toString("hex");
const customers=[],operators=[];let barber,layanan,server,alamat,lulus=0;
const pass=nama=>{lulus++;console.log(`PASS: ${nama}`);};
const hari=n=>`${new Date(Date.now()+7*3600000+n*86400000).toISOString().slice(0,10)}T10:00:00+07:00`;
const http=async(path,method="GET",body,token)=>{
 const hasil=await fetch(`${alamat}${path}`,{method,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:hasil.status,body:await hasil.json()};
};
const txUtc=aksi=>db.$transaction(async tx=>{await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;return aksi(tx);});
const ringkas=(id,p)=>http(`/customer/bookings/${id}/payments`,"GET",undefined,p.token);
const bayar=(id,body,op)=>http(`/bookings/${id}/payments/settlement`,"POST",body,op.token);
const booking=async(p,hariN)=>{
 const b=await http("/customer/bookings","POST",{mulaiPada:hari(hariN),barberPilihanId:barber.id,items:[{layananId:layanan.id,qty:1}]},p.token);
 assert.equal(b.status,201);return b.body.booking;
};
// HANYA fixture acak milik suite: ini data simulasi private sink F7, BUKAN
// verifikasi signature/provider nyata. Tidak menerima ID/email existing/argumen.
const seedBuktiFixture=async(id)=>txUtc(async tx=>{
 const b=await tx.booking.findUniqueOrThrow({where:{id}});
 assert.ok(customers.some(p=>p.id===b.pelangganId));
 const ref=`fixture-only-${randomUUID()}`;
 return tx.transaksiPembayaranBooking.create({data:{bookingId:id,tujuan:"DP",kanal:"MIDTRANS",status:"SUCCEEDED",
  nominal:b.nominalDp,kunciIdempotensi:`fixture-${randomUUID()}`,sidikPermintaan:"fixture-private-sink-only",referensiProvider:ref,
  roundKonfirmasiPada:b.dikonfirmasiPada,deadlinePada:b.deadlineDp,dibayarPada:b.dikonfirmasiPada,
  buktiProvider:{create:{referensiProvider:ref,nominal:b.nominalDp,fingerprintPayload:createHash("sha256").update(ref).digest("hex"),terverifikasiPada:b.dikonfirmasiPada}}}});
});
const selesaiFixture=id=>txUtc(async tx=>{
 const b=await tx.booking.findUniqueOrThrow({where:{id}});assert.ok(customers.some(p=>p.id===b.pelangganId));
 const selesai=new Date(Date.now()-2*3600000);
 return tx.booking.update({where:{id},data:{status:"COMPLETED",layananSelesaiPada:selesai,deadlinePelunasan:new Date(selesai.getTime()+3600000)}});
});
try{
 const u=hitungUangBooking([{harga:100001,qty:2},{harga:25000,qty:1}],10,[50000]);
 assert.equal(u.subtotal,225002);assert.equal(u.total,202502);assert.equal(u.nominalDp,101251);assert.equal(u.balance,152502);
 const naik=hitungUangBooking([{harga:150000,qty:1}],10,[50000]);assert.equal(naik.jumlahDibayar,50000);assert.equal(naik.balance,85000);
 const turun=hitungUangBooking([{harga:40000,qty:1}],10,[50000]);assert.equal(turun.jumlahDibayar,50000);assert.equal(turun.kelebihan,14000);
 const refund=hitungUangBooking([{harga:40000,qty:1}],10,[50000],[10000]);assert.equal(refund.jumlahDibayarBruto,50000);assert.equal(refund.jumlahRefund,10000);
 assert.throws(()=>hitungUangBooking([{harga:1,qty:1}],10,[10],[11]));
 pass("Rupiah BigInt, snapshot10%, DPceil50%, total naik/turun, paid tidak hilang, excess/refund teridentifikasi");
 const hash=await bcrypt.hash(password,10);
 barber=await db.barber.create({data:{nama:tanda}});layanan=await db.layanan.create({data:{nama:tanda,harga:100000,durasiMenit:30}});
 server=app.listen(0,"127.0.0.1");await once(server,"listening");alamat=`http://127.0.0.1:${server.address().port}`;
 for(let i=0;i<5;i++){
  const p=await db.pelanggan.create({data:{nama:tanda,nomorTelepon:`08${randomBytes(8).readBigUInt64BE().toString().slice(0,11)}`,akunPelanggan:{create:{email:`${tanda}-${i}@example.invalid`,passwordHash:hash}}}});
  customers.push(p);p.token=(await loginPelanggan({identitas:`${tanda}-${i}@example.invalid`,password})).token;
 }
 for(const[i,role]of["ADMIN","STAFF"].entries()){
  const op=await db.pengguna.create({data:{name:tanda,email:`${tanda}-op${i}@example.invalid`,role,passwordHash:hash,...(role==="STAFF"?{barberId:barber.id}:{})}});
  operators.push(op);op.token=(await http("/auth/login","POST",{email:op.email,password})).body.token;
 }
 const[admin,staff]=operators,[a,b,c,d,e]=customers;
 await db.membership.create({data:{pelangganId:a.id,memberCode:`TEST-${tanda}`,discountPercent:25}});
 const ba=await booking(a,1);
 const intent={kunciIdempotensi:randomUUID()};
 assert.equal((await http(`/customer/bookings/${ba.id}/payments/dp-intent`,"POST",intent,a.token)).status,409);
 assert.equal((await http(`/bookings/${ba.id}/confirm`,"POST",{},admin.token)).status,200);
 const intents=await Promise.all([http(`/customer/bookings/${ba.id}/payments/dp-intent`,"POST",intent,a.token),http(`/customer/bookings/${ba.id}/payments/dp-intent`,"POST",{kunciIdempotensi:randomUUID()},a.token)]);
 assert.ok(intents.every(h=>h.status===200));assert.equal(intents[0].body.transaksi.id,intents[1].body.transaksi.id);
 assert.equal(intents[0].body.transaksi.nominal,45000);assert.equal(intents[0].body.transaksi.status,"PENDING");
 assert.equal((await ringkas(ba.id,a)).body.ringkasan.jumlahDibayar,0);
 assert.equal((await db.booking.findUnique({where:{id:ba.id}})).status,"CONFIRMED");
 assert.equal((await http(`/customer/bookings/${ba.id}/payments/dp-intent`,"POST",{...intent,nominal:1,status:"SUCCEEDED"},a.token)).status,400);
 assert.equal((await ringkas(ba.id,b)).status,404);
 assert.equal((await http(`/bookings/${ba.id}/payments`,"GET",undefined,a.token)).status,401);
 pass("DP intent setelah confirm, satu pending per round, nominal authoritative, tidak PAID/mengubah booking, own-scope/injection");
 await assert.rejects(()=>txUtc(tx=>tx.transaksiPembayaranBooking.update({where:{id:intents[0].body.transaksi.id},data:{status:"SUCCEEDED",dibayarPada:new Date()}})));
 await assert.rejects(()=>txUtc(tx=>tx.transaksiPembayaranBooking.create({data:{bookingId:ba.id,tujuan:"DP",kanal:"KASIR",status:"SUCCEEDED",nominal:45000,
  metode:"CASH",jumlahDiterima:45000,kembalian:0,kunciIdempotensi:randomUUID(),sidikPermintaan:"fixture",dibayarPada:new Date()}})));
 assert.equal((await bayar(ba.id,{metode:"CASH",jumlahDiterima:45000,kunciIdempotensi:randomUUID(),tujuan:"DP"},staff)).status,400);
 const body={metode:"CASH",jumlahDiterima:50000,kunciIdempotensi:randomUUID()};
 assert.equal((await bayar(ba.id,body,staff)).status,409);
 await selesaiFixture(ba.id);assert.equal((await bayar(ba.id,body,staff)).status,409);
 assert.equal((await http(`/bookings/${ba.id}/payments/finalize-invoice`,"POST",{},admin.token)).status,409);
 assert.equal(await db.invoiceBooking.count({where:{bookingId:ba.id}}),0);
 pass("DP tanpa bukti provider ditolak DB; manualDP ditolak; pelunasan sebelum COMPLETED/tanpa DP valid ditolak; invoice palsu tidak dibuat");
 const bb=await booking(b,2);assert.equal((await http(`/bookings/${bb.id}/confirm`,"POST",{},staff.token)).status,200);
 const bukti=await seedBuktiFixture(bb.id);
 const sebelum=await ringkas(bb.id,b);assert.equal(sebelum.body.ringkasan.dpTerverifikasi,true);assert.equal(sebelum.body.ringkasan.balance,50000);
 assert.equal(sebelum.body.ringkasan.invoice,null);
 assert.equal((await http(`/bookings/${bb.id}/check-in`,"POST",{},staff.token)).status,409); // F5 tetap locked walau fixture proof ada.
 await txUtc(tx=>tx.booking.update({where:{id:bb.id},data:{status:"IN_SERVICE"}}));
 assert.equal((await http(`/bookings/${bb.id}/complete`,"POST",{},staff.token)).status,200);
 const lengkap=await db.booking.findUniqueOrThrow({where:{id:bb.id}});
 assert.equal(lengkap.deadlinePelunasan.getTime()-lengkap.layananSelesaiPada.getTime(),3600000);
 assert.equal((await ringkas(bb.id,b)).body.ringkasan.statusPembayaran,"PARTIALLY_PAID");
 await selesaiFixture(bb.id);
 const due=(await ringkas(bb.id,b)).body.ringkasan;assert.equal(due.statusPembayaran,"OVERDUE");assert.equal(due.balance,50000);
 assert.equal((await db.pelanggan.findUnique({where:{id:b.id}})).status,"AKTIF");
 const bayarBody={metode:"CASH",jumlahDiterima:60000,kunciIdempotensi:randomUUID()};
 const hasil=await bayar(bb.id,bayarBody,staff);assert.equal(hasil.status,200);assert.equal(hasil.body.transaksi.nominal,50000);assert.equal(hasil.body.transaksi.kembalian,10000);
 assert.equal(hasil.body.ringkasan.statusPembayaran,"PAID");assert.equal(hasil.body.ringkasan.jumlahDibayar,100000);
 assert.equal((await bayar(bb.id,bayarBody,admin)).body.transaksi.id,hasil.body.transaksi.id);
 assert.equal((await bayar(bb.id,{...bayarBody,jumlahDiterima:70000},admin)).status,409);
 assert.equal(await db.invoiceBooking.count({where:{bookingId:bb.id}}),1);
 assert.equal((await db.booking.findUnique({where:{id:bb.id}})).status,"COMPLETED");
 await assert.rejects(()=>txUtc(tx=>tx.buktiProviderBooking.create({data:{transaksiId:bukti.id,referensiProvider:bukti.referensiProvider,nominal:bukti.nominal,
  fingerprintPayload:"a".repeat(64),terverifikasiPada:new Date()}})),err=>err.code==="P2002");
 pass("Fixture sink F7: COMPLETED/balance valid, OVERDUE tidak block, kasir bayar balance, retry idempotent, satu invoice, bukti unik");
 const bc=await booking(c,3);await http(`/bookings/${bc.id}/confirm`,"POST",{},admin.token);await seedBuktiFixture(bc.id);await selesaiFixture(bc.id);
 const serentak=await Promise.all([bayar(bc.id,{...body,kunciIdempotensi:randomUUID()},admin),bayar(bc.id,{...body,kunciIdempotensi:randomUUID()},staff)]);
 assert.deepEqual(serentak.map(h=>h.status).sort(),[200,409]);assert.equal((await ringkas(bc.id,c)).body.ringkasan.jumlahDibayar,100000);
 assert.equal(await db.transaksiPembayaranBooking.count({where:{bookingId:bc.id,tujuan:"PELUNASAN"}}),1);
 const kredit=await db.transaksiPembayaranBooking.findFirstOrThrow({where:{bookingId:bc.id,tujuan:"PELUNASAN"}});
 const ulang={...body,kunciIdempotensi:kredit.kunciIdempotensi.split(":").at(-1)};
 const ulangSerentak=await Promise.all([bayar(bc.id,ulang,admin),bayar(bc.id,ulang,staff)]);
 assert.ok(ulangSerentak.every(h=>h.status===200));assert.equal(ulangSerentak[0].body.transaksi.id,kredit.id);
 assert.equal(await db.transaksiPembayaranBooking.count({where:{bookingId:bc.id,tujuan:"PELUNASAN"}}),1);
 pass("Concurrent settlement berbeda-key tidak overpay, satu ledger kredit/satu invoice");
 const bd=await booking(d,4);await http(`/bookings/${bd.id}/confirm`,"POST",{},admin.token);await seedBuktiFixture(bd.id);await selesaiFixture(bd.id);
 const order=await db.pesanan.create({data:{nomorPesanan:`TEST-${tanda}`,pelangganId:d.id,barberId:barber.id,status:"COMPLETED",subtotal:100000,discountPercent:0,diskon:0,total:100000,
  items:{create:{layananId:layanan.id,namaLayanan:tanda,durasiMenit:30,harga:100000,qty:1,subtotal:100000}}}});
 await db.booking.update({where:{id:bd.id},data:{pesananId:order.id}});
 const item=await db.itemPesanan.findFirstOrThrow({where:{pesananId:order.id}});
 await db.itemPesanan.update({where:{id:item.id},data:{harga:150000,subtotal:150000}});
 const meningkat=(await ringkas(bd.id,d)).body.ringkasan;
 assert.equal(meningkat.jumlahDibayar,50000);assert.equal(meningkat.balance,100000);
 await db.itemPesanan.update({where:{id:item.id},data:{harga:40000,subtotal:40000}});
 const menurun=(await ringkas(bd.id,d)).body.ringkasan;
 assert.equal(menurun.jumlahDibayar,50000);assert.equal(menurun.kelebihan,10000);assert.equal(menurun.perluRefund,true);
 assert.equal(menurun.invoice,null);assert.equal(await db.transaksiPembayaranBooking.count({where:{bookingId:bd.id,tujuan:"REFUND"}}),0);
 await db.itemPesanan.update({where:{id:item.id},data:{harga:100000,subtotal:100000}});
 pass("Total linked-order naik/turun dihitung ulang dari items, paid tetap, excess terdeteksi tanpa refund/invoice otomatis");
 assert.equal((await http(`/orders/${order.id}/payment`,"POST",{metode:"CASH",jumlahDiterima:50000,purpose:"DP"},staff.token)).status,400);
 const legacy=await http(`/orders/${order.id}/payment`,"POST",{metode:"CASH",jumlahDiterima:60000},staff.token);
 assert.equal(legacy.status,200);assert.equal(legacy.body.data.pesanan.statusPembayaran,"PAID");assert.equal(legacy.body.data.pembayaran.kembalian,10000);
 assert.equal((await http(`/orders/${order.id}/payment`,"POST",{metode:"CASH",jumlahDiterima:60000},staff.token)).status,409);
 assert.equal((await http("/invoices","GET",undefined,staff.token)).status,200);
 assert.equal(await db.pembayaran.count({where:{pesananId:order.id}}),1);
 pass("Kasir Project3/4 payload existing mengkredit hanya balance, DTO/invoice legacy kompatibel; DP/manual/duplikat ditolak");
 const be=await booking(e,5);await http(`/bookings/${be.id}/confirm`,"POST",{},admin.token);await seedBuktiFixture(be.id);await selesaiFixture(be.id);
 const asli=db.$transaction.bind(db);
 db.$transaction=(jalan,opsi)=>asli(async tx=>jalan(new Proxy(tx,{get(target,nama){
  if(nama==="invoiceBooking")return new Proxy(target.invoiceBooking,{get(del,aksi){if(aksi==="create")return async()=>{throw new Error("ROLLBACK_INVOICE_F6");};return Reflect.get(del,aksi);}});
  return Reflect.get(target,nama);
 }})),opsi);
 try{await assert.rejects(()=>bayarPelunasanKasirBooking(be.id,staff.id,{metode:"CASH",jumlahDiterima:50000,kunciIdempotensi:randomUUID()}),/ROLLBACK_INVOICE_F6/);}finally{db.$transaction=asli;}
 assert.equal((await ringkas(be.id,e)).body.ringkasan.jumlahDibayar,50000);
 assert.equal(await db.transaksiPembayaranBooking.count({where:{bookingId:be.id,tujuan:"PELUNASAN"}}),0);
 assert.equal(await db.invoiceBooking.count({where:{bookingId:be.id}}),0);
 assert.equal((await bayar(be.id,{...body,kunciIdempotensi:randomUUID()},staff)).status,200);
 pass("Kegagalan invoice rollback kredit pelunasan/saldo; retry valid berhasil");
 console.log(`Total: ${lulus} kelompok F6 PASS. Provider/webhook/refund nyata DEFERRED F7; fixture bukti bukan verifikasi Midtrans.`);
}catch(err){console.error(`FAIL F6 (${err.name}); credential/token tidak dicetak.`);process.exitCode=1;}
finally{
 try{
  const ids=customers.map(p=>p.id);const books=await db.booking.findMany({where:{pelangganId:{in:ids}},select:{id:true,pesananId:true}});const bookIds=books.map(b=>b.id);
  await txUtc(async tx=>{
   await tx.invoiceBooking.deleteMany({where:{bookingId:{in:bookIds}}});
   await tx.transaksiPembayaranBooking.deleteMany({where:{bookingId:{in:bookIds},tujuan:"REFUND"}});
   await tx.transaksiPembayaranBooking.deleteMany({where:{bookingId:{in:bookIds}}});
   await tx.booking.deleteMany({where:{id:{in:bookIds}}});
   const pesananIds=books.filter(b=>b.pesananId!==null).map(b=>b.pesananId);
   await tx.pembayaran.deleteMany({where:{pesananId:{in:pesananIds}}});await tx.pesanan.deleteMany({where:{id:{in:pesananIds}}});
   await tx.pelanggan.deleteMany({where:{id:{in:ids}}});
  });
  await db.pengguna.deleteMany({where:{id:{in:operators.map(p=>p.id)}}});if(layanan)await db.layanan.delete({where:{id:layanan.id}});if(barber)await db.barber.delete({where:{id:barber.id}});
  assert.equal(await db.booking.count({where:{pelangganId:{in:ids}}}),0);console.log("PASS: seluruh fixture pembayaran/bukti/invoice dibersihkan, data existing tidak diubah.");
 }finally{try{if(server)await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));}finally{await db.$disconnect();}}
}
