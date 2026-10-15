import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import bcrypt from "bcrypt";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL ?? "").hostname)) throw new Error("Fixture hanya DB lokal");
const {default:db}=await import("../dist/lib/prisma.js");
const {default:app}=await import("../dist/app.js");
const {loginPelanggan}=await import("../dist/services/auth-pelanggan.service.js");
const {putuskanBooking}=await import("../dist/services/operasional-booking.service.js");
const tanda=`uji-f5-${randomUUID()}`, password=randomBytes(18).toString("hex");
const customer=[], operators=[], barbers=[];
let layanan, server, alamat, lulus=0;
const pass=nama=>{lulus++;console.log(`PASS: ${nama}`);};
const hari=(jarak,jam="10:00")=>`${new Date(Date.now()+7*3600000+jarak*86400000).toISOString().slice(0,10)}T${jam}:00+07:00`;
const http=async(rute,method="GET",body,token)=>{
 const hasil=await fetch(`${alamat}${rute}`,{method,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:hasil.status,body:await hasil.json()};
};
const op=(id,aksi,token,body={})=>http(`/bookings/${id}/${aksi}`,"POST",body,token);
const own=(id,aksi,token,body={})=>http(`/customer/bookings/${id}/${aksi}`,"POST",body,token);
const detail=(id,token)=>http(`/customer/bookings/${id}`,"GET",undefined,token);
const buat=async(p,jarak,pilihan=barbers[0].id,jam="10:00")=>{
 const hasil=await http("/customer/bookings","POST",{mulaiPada:hari(jarak,jam),barberPilihanId:pilihan,items:[{layananId:layanan.id,qty:1}]},p.token);
 assert.equal(hasil.status,201);return hasil.body.booking;
};
const seedStatus=async(id,status)=>db.$transaction(async tx=>{
 await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
 return tx.booking.update({where:{id},data:{status,...(status==="CHECKED_IN"?{checkInPada:new Date()}:{layananMulaiPada:new Date()})}});
});
try{
 const hash=await bcrypt.hash(password,10);
 for(let i=0;i<3;i++)barbers.push(await db.barber.create({data:{nama:tanda}}));
 layanan=await db.layanan.create({data:{nama:tanda,harga:100000,durasiMenit:30}});
 server=app.listen(0,"127.0.0.1");await once(server,"listening");alamat=`http://127.0.0.1:${server.address().port}`;
 for(let i=0;i<4;i++){
  const p=await db.pelanggan.create({data:{nama:tanda,nomorTelepon:`08${randomBytes(8).readBigUInt64BE().toString().slice(0,11)}`,akunPelanggan:{create:{email:`${tanda}-${i}@example.invalid`,passwordHash:hash}}},include:{akunPelanggan:{select:{id:true}}}});
  customer.push(p);p.token=(await loginPelanggan({identitas:`${tanda}-${i}@example.invalid`,password})).token;
 }
 for(const [i,role]of["ADMIN","STAFF"].entries()){
  const akun=await db.pengguna.create({data:{name:tanda,email:`${tanda}-op${i}@example.invalid`,role,passwordHash:hash,...(role==="STAFF"?{barberId:barbers[0].id}:{})}});
  operators.push(akun);const login=await http("/auth/login","POST",{email:akun.email,password});assert.equal(login.status,200);akun.token=login.body.token;
 }
 const [admin,staff]=operators,[satu,dua,tiga]=customer;
 const sebelumPembayaran=await db.pembayaran.count();
 const b1=await buat(satu,1),b2=await buat(dua,2);
 for(const [b,akun]of[[b1,admin],[b2,staff]]){
  const hasil=await op(b.id,"confirm",akun.token);assert.equal(hasil.status,200);
  assert.equal(hasil.body.booking.status,"CONFIRMED");
  assert.equal(new Date(hasil.body.booking.deadlineDp)-new Date(hasil.body.booking.dikonfirmasiPada),3600000);
  assert.equal(hasil.body.booking.pesananId,null);assert.equal(hasil.body.booking.checkInPada,null);
 }
 pass("ADMIN/STAFF confirm, deadline tepat1 jam, tidak menandai DP paid/membuat Pesanan");
 assert.equal((await op(b1.id,"confirm",staff.token)).status,409);
 assert.equal((await op(b1.id,"reject",admin.token,{alasan:"ulang"})).status,409);
 const b3=await buat(tiga,3);
 assert.equal((await op(b3.id,"reject",staff.token)).status,400);
 assert.equal((await op(b3.id,"reject",staff.token,{alasan:"   "})).status,400);
 assert.equal((await op(b3.id,"reject",staff.token,{alasan:"Barber tidak tersedia"})).status,200);
 const ditolak=await detail(b3.id,tiga.token);assert.equal(ditolak.body.booking.alasanPenolakan,"Barber tidak tersedia");
 assert.equal((await op(b3.id,"confirm",admin.token)).status,409);
 assert.equal((await op(b3.id,"check-in",admin.token)).status,409);
 assert.equal((await op(b3.id,"complete",admin.token)).status,409);
 pass("Reject wajib alasan, customer own dapat membaca, terminal tidak bisa diputuskan/check-in ulang");
 const b4=await buat(satu,4),b5=await buat(dua,5);
 assert.deepEqual((await Promise.all([op(b4.id,"confirm",admin.token),op(b4.id,"confirm",staff.token)])).map(h=>h.status).sort(),[200,409]);
 assert.deepEqual((await Promise.all([op(b5.id,"confirm",admin.token),op(b5.id,"reject",staff.token,{alasan:"keputusan serentak"})])).map(h=>h.status).sort(),[200,409]);
 assert.equal(await db.riwayatBooking.count({where:{bookingId:b4.id,aksi:"CONFIRM"}}),1);
 pass("Double confirm / confirm-versus-reject serentak: satu keputusan dan audit record");
 assert.equal((await http("/bookings","GET",undefined,admin.token)).status,200);
 assert.equal((await http("/bookings","GET",undefined,staff.token)).status,200);
 assert.equal((await http("/bookings","GET",undefined,satu.token)).status,401);
 for(const aksi of["confirm","reject","check-in","start","complete"]){
  assert.equal((await op(b1.id,aksi,satu.token,{alasan:"x",barberId:barbers[1].id})).status,401);
 }
 assert.equal((await detail(b1.id,dua.token)).status,404);
 pass("Operator list/detail tersedia; CUSTOMER tidak memutuskan/check-in; own-booking scope");
 for(const akun of[admin,staff]){
  const early=await op(b1.id,"check-in",akun.token);assert.equal(early.status,409);assert.match(early.body.pesan,/bukti DP/);
 }
 assert.equal((await op(b1.id,"check-in",staff.token,{dpPaid:true})).status,400);
 assert.equal((await db.booking.findUnique({where:{id:b1.id}})).status,"CONFIRMED");
 pass("Check-in lebih awal dan seluruh check-in tanpa bukti DP diblokir sesuai keputusan C; payload fake-paid ditolak");
 const usulkan=await op(b1.id,"barber-proposals",staff.token,{barberId:barbers[1].id,alasan:"Pengganti tersedia"});
 assert.equal(usulkan.status,200);const proposal=usulkan.body.booking.usulanBarber[0].id;
 assert.equal((await op(b1.id,"barber-proposals",admin.token,{barberId:barbers[2].id,alasan:"ganda"})).status,409);
 await assert.rejects(()=>db.usulanBarberBooking.create({data:{bookingId:b1.id,barberId:barbers[2].id,alasan:"duplikat constraint",diusulkanOlehId:admin.id}}),e=>e.code==="P2002");
 assert.equal((await own(b1.id,`barber-proposals/${proposal}/accept`,dua.token)).status,404);
 await seedStatus(b1.id,"CHECKED_IN"); // Fixture status masa depan, bukan bukti/pembayaran DP palsu.
 const pendingStart=await op(b1.id,"start",staff.token,{barberId:barbers[1].id});
 assert.equal(pendingStart.status,409);assert.match(pendingStart.body.pesan,/belum diputuskan/);
 const terima=await Promise.all([own(b1.id,`barber-proposals/${proposal}/accept`,satu.token),own(b1.id,`barber-proposals/${proposal}/accept`,satu.token)]);
 assert.deepEqual(terima.map(h=>h.status).sort(),[200,409]);
 assert.equal((await detail(b1.id,satu.token)).body.booking.barberDisetujuiId,barbers[1].id);
 assert.equal((await op(b1.id,"start",admin.token,{barberId:barbers[0].id})).status,409);
 const dpStart=await op(b1.id,"start",staff.token,{barberId:barbers[1].id});assert.equal(dpStart.status,409);assert.match(dpStart.body.pesan,/bukti DP/);
 assert.equal((await detail(b1.id,satu.token)).body.booking.barberFinalId,null);
 pass("Proposal pending tidak boleh start; own consent atomik, pengganti lain ditolak, final assignment tetap gate DP/F6");
 assert.equal((await http("/customer/bookings","POST",{mulaiPada:hari(1),barberPilihanId:barbers[1].id,items:[{layananId:layanan.id,qty:1}]},dua.token)).status,409);
 assert.equal((await buat(dua,1,barbers[0].id)).barberPilihanId,barbers[0].id);
 pass("Persetujuan pengganti memindahkan barber efektif; F4 tetap menahan CHECKED_IN/pilihan disetujui");
 const propose2=await op(b2.id,"barber-proposals",admin.token,{barberId:barbers[2].id,alasan:"Opsi lain"});assert.equal(propose2.status,200);
 const p2=propose2.body.booking.usulanBarber[0].id;
 assert.equal((await own(b2.id,`barber-proposals/${p2}/reject`,dua.token)).status,200);
 const lama=(await detail(b2.id,dua.token)).body.booking;
 assert.equal((await own(b2.id,"reschedule",satu.token,{mulaiPada:hari(6)})).status,404);
 assert.equal((await own(b2.id,"reschedule",dua.token,{mulaiPada:hari(16)})).status,400);
 const pindah=await own(b2.id,"reschedule",dua.token,{mulaiPada:hari(6),barberPilihanId:barbers[2].id});assert.equal(pindah.status,200);
 assert.equal(pindah.body.booking.status,"PENDING_CONFIRMATION");assert.equal(pindah.body.booking.deadlineDp,null);
 for(const key of["total","discountPercent","nominalDp","durasiMenit"])assert.equal(pindah.body.booking[key],lama[key]);
 assert.equal((await op(b2.id,"confirm",staff.token)).status,200);
 const ulang=(await detail(b2.id,dua.token)).body.booking;
 assert.equal(new Date(ulang.deadlineDp)-new Date(ulang.dikonfirmasiPada),3600000);
 assert.ok(ulang.riwayat.some(h=>h.aksi==="RESCHEDULE"));
 assert.equal((await own(b2.id,"reschedule",dua.token,{mulaiPada:hari(9)})).status,409);
 pass("Customer reject usulan→reschedule tervalidasi→PENDING→konfirmasi ulang/deadline baru, snapshot harga utuh");
 const any=await buat(tiga,7,null);assert.equal((await op(any.id,"confirm",staff.token)).status,200);
 await seedStatus(any.id,"CHECKED_IN");
 const anyStart=await op(any.id,"start",admin.token,{barberId:barbers[2].id});assert.equal(anyStart.status,409);assert.match(anyStart.body.pesan,/bukti DP/);
 assert.equal((await detail(any.id,tiga.token)).body.booking.barberFinalId,null);
 pass("Any menerima pilihan barber aktif pada validasi; alokasi final tidak dipersistenkan tanpa DP");
 await seedStatus(any.id,"IN_SERVICE"); // Hanya fixture uji transisi masa depan; tidak membuat Payment/Pesanan.
 assert.equal((await http(`/bookings/${any.id}/services`,"PUT",{items:[]},staff.token)).status,400);
 const complete=await Promise.all([op(any.id,"complete",admin.token),op(any.id,"complete",staff.token)]);
 assert.deepEqual(complete.map(h=>h.status).sort(),[200,409]);
 const selesai=(await detail(any.id,tiga.token)).body.booking;assert.equal(selesai.status,"COMPLETED");assert.ok(selesai.layananSelesaiPada);
 assert.equal(selesai.pesananId,null);
 assert.equal(await db.pembayaran.count(),sebelumPembayaran);
 assert.equal(await db.pesanan.count({where:{pelangganId:{in:customer.map(p=>p.id)}}}),0);
 pass("Fixture IN_SERVICE→COMPLETED tidak berarti PAID; layanan/item/Pesanan deferred B, pembayaran legacy tidak disentuh");
 const rollback=await buat(customer[3],8);
 const asli=db.$transaction.bind(db);
 db.$transaction=(jalan,opsi)=>asli(async tx=>jalan(new Proxy(tx,{get(target,nama){
  if(nama==="riwayatBooking")return new Proxy(target.riwayatBooking,{get(delegate,aksi){if(aksi==="create")return async()=>{throw new Error("ROLLBACK_AUDIT_F5");};return Reflect.get(delegate,aksi);}});
  return Reflect.get(target,nama);
 }})),opsi);
 try{await assert.rejects(()=>putuskanBooking(rollback.id,admin.id,true),/ROLLBACK_AUDIT_F5/);}finally{db.$transaction=asli;}
 assert.equal((await detail(rollback.id,customer[3].token)).body.booking.status,"PENDING_CONFIRMATION");
 assert.equal((await detail(rollback.id,customer[3].token)).body.booking.deadlineDp,null);
 assert.equal((await op(rollback.id,"confirm",admin.token)).status,200);
 pass("Kegagalan audit rollback status/deadline keputusan atomik");
 console.log(`Total: ${lulus} kelompok foundation F5 PASS; operasi dengan DP valid belum dapat diuji sampai F6.`);
}catch(e){console.error(`FAIL F5 (${e.name}); credential/token tidak dicetak.`);process.exitCode=1;}
finally{
 try{
  const ids=customer.map(p=>p.id);
  await db.booking.deleteMany({where:{pelangganId:{in:ids}}});
  await db.pelanggan.deleteMany({where:{id:{in:ids}}});
  await db.pengguna.deleteMany({where:{id:{in:operators.map(p=>p.id)}}});
  if(layanan)await db.layanan.delete({where:{id:layanan.id}});
  await db.barber.deleteMany({where:{id:{in:barbers.map(b=>b.id)}}});
  assert.equal(await db.booking.count({where:{pelangganId:{in:ids}}}),0);
  console.log("PASS: fixture F5 dan riwayat/proposal cascade dibersihkan.");
 }finally{try{if(server)await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}finally{await db.$disconnect();}}
}
