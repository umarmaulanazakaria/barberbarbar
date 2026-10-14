import "dotenv/config";
import assert from "node:assert/strict";
import {randomBytes,randomUUID,createHash} from "node:crypto";
import {once} from "node:events";
import bcrypt from "bcrypt";
if(!["localhost","127.0.0.1","[::1]"].includes(new URL(process.env.DATABASE_URL??"").hostname))throw new Error("Hanya fixture DB lokal");
// Tidak memakai credential merchant nyata. Semua status provider suite ini MOCK.
process.env.MIDTRANS_MERCHANT_ID="fixture-f7";process.env.MIDTRANS_SERVER_KEY=randomBytes(32).toString("hex");
process.env.MIDTRANS_CLIENT_KEY="fixture-client";process.env.MIDTRANS_IS_PRODUCTION="false";
const {default:db}=await import("../dist/lib/prisma.js");const {default:app}=await import("../dist/app.js");
const {gerbangMidtrans}=await import("../dist/lib/midtrans.js");
const {loginPelanggan}=await import("../dist/services/auth-pelanggan.service.js");
const {sinkronkanPembayaran}=await import("../dist/services/midtrans-booking.service.js");
const provider=new Map(),tanda=`uji-f7-${randomUUID()}`,password=randomBytes(18).toString("hex"),pelanggan=[],operator=[];
let barber,barberCadangan,layanan,murah,server,alamat,total=0,snapCount=0,refundCount=0,refundGagal=false;
const asli={...gerbangMidtrans};const waktu=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,19).replace("T"," ");
gerbangMidtrans.buatSnap=async data=>{
 snapCount++;provider.set(data.transaction_details.order_id,{order_id:data.transaction_details.order_id,
 transaction_id:randomUUID(),merchant_id:"fixture-f7",gross_amount:`${data.transaction_details.gross_amount}.00`,currency:"IDR",
 transaction_status:"pending",payment_type:"gopay",fraud_status:"accept",status_code:"201",transaction_time:waktu()});
 await new Promise(resolve=>setTimeout(resolve,20));return{token:randomUUID(),redirect_url:"https://app.sandbox.midtrans.com/snap/v2/test-fixture-only"};
};
gerbangMidtrans.status=async id=>structuredClone(provider.get(id));
gerbangMidtrans.refund=async(id,data)=>{
 refundCount++;if(refundGagal)throw new Error("MOCK_REFUND_FAILED");
 const p=[...provider.values()].find(p=>p.order_id===id||p.transaction_id===id);assert.ok(p);
 p.transaction_status="partial_refund";p.status_code="200";
 p.refunds??=[];if(!p.refunds.some(r=>r.refund_key===data.refund_key))p.refunds.push({refund_key:data.refund_key,
 refund_amount:`${data.amount}.00`,refund_chargeback_id:p.refunds.length+1,refund_method:"online",bank_confirmed_at:waktu()});
 return{status_code:"200"};
};
const pass=pesan=>{total++;console.log(`PASS MOCK F7: ${pesan}`);};
const http=async(path,method="GET",body,token)=>{const r=await fetch(`${alamat}${path}`,{method,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:r.status,body:await r.json()};};
const utc=kerja=>db.$transaction(async tx=>{await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;return kerja(tx);});
const hari=n=>`${new Date(Date.now()+7*3600000+n*86400000).toISOString().slice(0,10)}T10:00:00+07:00`;
const buat=async(p,n)=>{
 const r=await http("/customer/bookings","POST",{mulaiPada:hari(n),barberPilihanId:barber.id,items:[{layananId:layanan.id,qty:1}]},p.token);assert.equal(r.status,201);
 assert.equal((await http(`/bookings/${r.body.booking.id}/confirm`,"POST",{},operator[0].token)).status,200);return r.body.booking;
};
const snap=async(b,p,tujuan="dp",key=randomUUID())=>http(`/customer/bookings/${b.id}/payments/${tujuan}`,"POST",{kunciIdempotensi:key},p.token);
const notifikasi=async p=>{
 const n={...p};n.signature_key=createHash("sha512").update(n.order_id+n.status_code+n.gross_amount+process.env.MIDTRANS_SERVER_KEY).digest("hex");
 return http("/midtrans/notifications","POST",n);
};
const lunasiDp=async(b,p,metode="gopay")=>{
 const s=await snap(b,p);assert.equal(s.status,200);
 const t=await db.transaksiPembayaranBooking.findUniqueOrThrow({where:{id:s.body.transaksiId}});
 const data=provider.get(t.referensiProvider);data.payment_type=metode;data.transaction_status="settlement";data.status_code="200";data.settlement_time=waktu();
 assert.equal((await notifikasi(data)).status,200);return{t,data};
};
const ringkas=(b,p)=>http(`/customer/bookings/${b.id}/payments`,"GET",undefined,p.token);
try{
 const hash=await bcrypt.hash(password,10);barber=await db.barber.create({data:{nama:tanda}});
 barberCadangan=await db.barber.create({data:{nama:`${tanda}-cadangan`}});
 layanan=await db.layanan.create({data:{nama:tanda,harga:100000,durasiMenit:30}});murah=await db.layanan.create({data:{nama:`${tanda}-murah`,harga:30000,durasiMenit:30}});
 server=app.listen(0,"127.0.0.1");await once(server,"listening");alamat=`http://127.0.0.1:${server.address().port}`;
 for(let i=0;i<7;i++){
  const p=await db.pelanggan.create({data:{nama:tanda,nomorTelepon:`08${randomBytes(8).readBigUInt64BE().toString().slice(0,11)}`,akunPelanggan:{create:{email:`${tanda}-${i}@example.invalid`,passwordHash:hash}}}});
  pelanggan.push(p);p.token=(await loginPelanggan({identitas:`${tanda}-${i}@example.invalid`,password})).token;
 }
 for(const[i,role]of["ADMIN","STAFF","ADMIN"].entries()){
  const o=await db.pengguna.create({data:{name:tanda,email:`${tanda}-op${i}@example.invalid`,passwordHash:hash,role,...(role==="STAFF"?{barberId:barber.id}:{})}});
  operator.push(o);o.token=(await http("/auth/login","POST",{email:o.email,password})).body.token;
 }
 const[a,b,c,d,e,f,g]=pelanggan,[admin,staff,admin2]=operator;
 await db.membership.create({data:{pelangganId:a.id,memberCode:`TEST-${tanda}`,discountPercent:25}});
 const ba=await buat(a,1),key=randomUUID();
 assert.equal((await snap(ba,b)).status,404);assert.equal((await snap(ba,{token:staff.token})).status,401);
 const avant=snapCount;const duo=await Promise.all([snap(ba,a,"dp",key),snap(ba,a,"dp",key)]);
 assert.ok(duo.some(r=>r.status===200));assert.ok(duo.every(r=>[200,503].includes(r.status)));assert.equal(snapCount,avant+1);
 assert.equal((await snap(ba,a,"dp",key)).status,200);
 const ta=await db.transaksiPembayaranBooking.findFirstOrThrow({where:{bookingId:ba.id,tujuan:"DP"}});assert.equal(ta.nominal,45000);
 assert.equal((await ringkas(ba,a)).body.ringkasan.jumlahDibayar,0);
 pass("Snap member snapshot10%, DP45000, ownership/auth, concurrent reservation satu provider call, retry sama");
 const pa=provider.get(ta.referensiProvider);
 assert.equal((await http("/midtrans/notifications","POST",{...pa,signature_key:"f".repeat(128)})).status,401);
 assert.equal((await notifikasi({...pa,gross_amount:"1.00"})).status,400);
 assert.equal((await notifikasi({...pa,transaction_id:randomUUID()})).status,400);
 assert.equal((await notifikasi(pa)).status,200);assert.equal((await ringkas(ba,a)).body.ringkasan.jumlahDibayar,0);
 pa.payment_type="credit_card";pa.transaction_status="capture";pa.fraud_status="challenge";
 assert.equal((await notifikasi(pa)).status,200);assert.equal((await ringkas(ba,a)).body.ringkasan.jumlahDibayar,0);
 pa.fraud_status="accept";
 pa.status_code="200";assert.equal((await notifikasi(pa)).status,200);
 pa.transaction_status="settlement";pa.status_code="200";pa.settlement_time=waktu();
 const concurrently=await Promise.all([notifikasi(pa),notifikasi(pa),notifikasi(pa)]);assert.ok(concurrently.every(r=>r.status===200));
 assert.equal(await db.buktiProviderBooking.count({where:{transaksiId:ta.id}}),1);assert.equal((await ringkas(ba,a)).body.ringkasan.jumlahDibayar,45000);
 pa.transaction_status="pending";pa.status_code="201";assert.equal((await notifikasi(pa)).status,200);
 assert.equal((await ringkas(ba,a)).body.ringkasan.jumlahDibayar,45000);pa.transaction_status="settlement";pa.status_code="200";
 pass("Signature palsu/amount/transaction mismatch ditolak, pending nol kredit, settlement duplicate/concurrent/out-of-order satu kredit");
 assert.equal((await http(`/bookings/${ba.id}/check-in`,"POST",{},staff.token)).status,200);
 const starts=await Promise.all([http(`/bookings/${ba.id}/start`,"POST",{barberId:barber.id},staff.token),http(`/bookings/${ba.id}/start`,"POST",{barberId:barber.id},admin.token)]);
 assert.deepEqual(starts.map(r=>r.status).sort(),[200,409]);
 assert.equal(await db.pesanan.count({where:{pelangganId:a.id}}),1);
 assert.equal((await http(`/bookings/${ba.id}/services`,"PUT",{items:[{layananId:layanan.id,qty:2}]},staff.token)).status,200);
 assert.equal((await ringkas(ba,a)).body.ringkasan.balance,135000);
 assert.equal((await http(`/bookings/${ba.id}/complete`,"POST",{},staff.token)).status,200);
 const sa=await snap(ba,a,"online-settlement");assert.equal(sa.status,200);
 const pay=await db.transaksiPembayaranBooking.findUniqueOrThrow({where:{id:sa.body.transaksiId}});assert.equal(pay.nominal,135000);
 assert.equal((await http(`/bookings/${ba.id}/payments/settlement`,"POST",{metode:"CASH",jumlahDiterima:135000,kunciIdempotensi:randomUUID()},staff.token)).status,409);
 const online=provider.get(pay.referensiProvider);online.transaction_status="settlement";online.status_code="200";online.settlement_time=waktu();
 assert.equal((await notifikasi(online)).status,200);assert.equal((await notifikasi(online)).status,200);
 assert.equal((await ringkas(ba,a)).body.ringkasan.jumlahDibayar,180000);assert.equal(await db.invoiceBooking.count({where:{bookingId:ba.id}}),1);
 pass("DP sah membuka early check-in/start/barber/Pesanan sekali, service naik/balance, COMPLETED bukan PAID, Snap pelunasan dan cash race guard");
 const bb=await buat(b,2);const pb=await lunasiDp(bb,b);
 assert.equal(pb.t.nominal,50000);assert.equal((await http(`/customer/bookings/${bb.id}/cancel`,"POST",{},b.token)).status,200);
 const rb=await db.permohonanRefundBooking.findFirstOrThrow({where:{bookingId:bb.id}});assert.equal(rb.nominal,50000);assert.equal(rb.status,"PENDING_APPROVAL");
 assert.equal((await http(`/refund-requests/${rb.id}/approve`,"POST",{catatan:"setuju"},staff.token)).status,403);
 assert.equal((await http(`/refund-requests/${rb.id}/approve`,"POST",{catatan:"setuju"},b.token)).status,401);
 refundGagal=true;const decisions=await Promise.all([http(`/refund-requests/${rb.id}/approve`,"POST",{catatan:"setuju"},admin.token),http(`/refund-requests/${rb.id}/approve`,"POST",{catatan:"setuju"},admin2.token)]);
 assert.deepEqual(decisions.map(r=>r.status).sort(),[200,409]);assert.equal((await db.permohonanRefundBooking.findUnique({where:{id:rb.id}})).status,"FAILED");
 assert.equal((await ringkas(bb,b)).body.ringkasan.jumlahRefund,0);refundGagal=false;
 assert.equal((await http(`/refund-requests/${rb.id}/retry`,"POST",{},admin.token)).status,200);
 assert.equal((await db.permohonanRefundBooking.findUnique({where:{id:rb.id}})).status,"SUCCEEDED");
 assert.equal((await ringkas(bb,b)).body.ringkasan.jumlahRefund,50000);assert.equal((await ringkas(bb,b)).body.ringkasan.balance,0);
 const count=refundCount;assert.equal((await http(`/refund-requests/${rb.id}/retry`,"POST",{},admin.token)).status,409);assert.equal(refundCount,count);
 pass("Cancel>=1jam refund DP100%, ADMIN tunggal, STAFF403/CUSTOMER401, gagal tidak debit, retry key tetap dan bank-confirmed sukses");
 const bc=await buat(c,3);await lunasiDp(bc,c);await utc(tx=>tx.booking.update({where:{id:bc.id},data:{mulaiPada:new Date(Math.floor(Date.now()/60000)*60000+30*60000),selesaiPada:new Date(Math.floor(Date.now()/60000)*60000+60*60000)}}));
 assert.equal((await http(`/customer/bookings/${bc.id}/cancel`,"POST",{},c.token)).status,200);assert.equal(await db.permohonanRefundBooking.count({where:{bookingId:bc.id}}),0);
 const bd=await buat(d,4);await lunasiDp(bd,d);await utc(tx=>tx.booking.update({where:{id:bd.id},data:{mulaiPada:new Date(Math.floor(Date.now()/60000)*60000-60*60000),selesaiPada:new Date(Math.floor(Date.now()/60000)*60000-30*60000)}}));
 assert.equal((await http(`/bookings/${bd.id}/no-show`,"POST",{},staff.token)).status,200);assert.equal((await ringkas(bd,d)).body.ringkasan.balance,0);
 assert.equal(await db.permohonanRefundBooking.count({where:{bookingId:bd.id}}),0);
 pass("Cancel<1jam/NO_SHOW DP hangus, tanpa refund dan tanpa kewajiban pelunasan");
 const be=await buat(e,5);await lunasiDp(be,e);assert.equal((await http(`/bookings/${be.id}/reject`,"POST",{alasan:"Barber berhalangan"},admin.token)).status,200);
 const re=await db.permohonanRefundBooking.findFirstOrThrow({where:{bookingId:be.id}});assert.equal(re.status,"PENDING_APPROVAL");
 assert.equal((await http(`/refund-requests/${re.id}/reject`,"POST",{catatan:"Tinjau sengketa"},admin.token)).status,200);
 assert.equal((await http(`/refund-requests/${re.id}/retry`,"POST",{},admin.token)).status,409);
 pass("Booking dibayar ditolak otomatis request, keputusan reject ADMIN final tanpa refund");
 const bf=await buat(f,6);await lunasiDp(bf,f);await http(`/bookings/${bf.id}/check-in`,"POST",{},staff.token);await http(`/bookings/${bf.id}/start`,"POST",{barberId:barber.id},staff.token);
 assert.equal((await http(`/bookings/${bf.id}/services`,"PUT",{items:[{layananId:murah.id,qty:1}]},staff.token)).status,200);
 const rf=await db.permohonanRefundBooking.findFirstOrThrow({where:{bookingId:bf.id}});assert.equal(rf.nominal,20000);assert.equal(rf.status,"PENDING_APPROVAL");
 assert.equal((await ringkas(bf,f)).body.ringkasan.jumlahDibayar,50000);assert.equal((await ringkas(bf,f)).body.ringkasan.kelebihan,20000);
 assert.equal((await http(`/bookings/${bf.id}/services`,"PUT",{items:[{layananId:layanan.id,qty:1}]},staff.token)).status,409);
 await http(`/bookings/${bf.id}/complete`,"POST",{},staff.token);
 pass("Service turun paid tetap/excess20000 membuat request pending; perubahan ulang ditolak saat refund aktif");
 const bg=await buat(g,7);const pg=await lunasiDp(bg,g,"bank_transfer");
 await sinkronkanPembayaran(pg.t.id);
 await http(`/customer/bookings/${bg.id}/cancel`,"POST",{},g.token);
 const bank=await db.permohonanRefundBooking.findFirstOrThrow({where:{bookingId:bg.id}});
 const awalBank=refundCount;
 const hasilBank=await http(`/refund-requests/${bank.id}/approve`,"POST",{catatan:"Metode tidak mendukung refund online"},admin.token);
 assert.equal(hasilBank.body.refund.status,"UNSUPPORTED");assert.equal(refundCount,awalBank);
 // Fixture khusus sumber manual, bukan memanggil provider untuk pembayaran kasir.
 await utc(async tx=>{const manual=await tx.transaksiPembayaranBooking.create({data:{bookingId:bg.id,tujuan:"PELUNASAN",kanal:"KASIR",status:"SUCCEEDED",nominal:1000,metode:"CASH",jumlahDiterima:1000,kembalian:0,kunciIdempotensi:randomUUID(),sidikPermintaan:"fixture",dibayarPada:new Date()}});
 await tx.permohonanRefundBooking.create({data:{bookingId:bg.id,transaksiAsalId:manual.id,kunciSumber:randomUUID(),nominal:1000,alasan:"Fixture manual-policy"}});});
 const manual=await db.permohonanRefundBooking.findFirstOrThrow({where:{bookingId:bg.id,nominal:1000}});const appels=refundCount;
 const unsupported=await http(`/refund-requests/${manual.id}/approve`,"POST",{catatan:"butuh kebijakan manual"},admin.token);
 assert.equal(unsupported.body.refund.status,"UNSUPPORTED");assert.equal(refundCount,appels);
 pass("Refund sumber kasir UNSUPPORTED tanpa panggilan Midtrans; tidak dipalsukan sukses");
 const br=await buat(b,8);await lunasiDp(br,b);
 const proposal=await http(`/bookings/${br.id}/barber-proposals`,"POST",{barberId:barberCadangan.id,alasan:"Perubahan jadwal"},admin.token);
 assert.equal(proposal.status,200);const pid=proposal.body.booking.usulanBarber[0].id;
 assert.equal((await http(`/customer/bookings/${br.id}/barber-proposals/${pid}/reject`,"POST",{},b.token)).status,200);
 assert.equal((await http(`/customer/bookings/${br.id}/reschedule`,"POST",{mulaiPada:hari(9),items:[{layananId:murah.id,qty:1}]},b.token)).status,200);
 const rr=await db.permohonanRefundBooking.findFirstOrThrow({where:{bookingId:br.id}});assert.equal(rr.nominal,20000);
 assert.equal((await http(`/bookings/${br.id}/confirm`,"POST",{},admin.token)).status,200);
 assert.equal((await http(`/refund-requests/${rr.id}/approve`,"POST",{catatan:"Refund selisih"},admin.token)).body.refund.status,"SUCCEEDED");
 assert.equal((await ringkas(br,b)).body.ringkasan.jumlahDibayar,30000);
 assert.equal((await http(`/bookings/${br.id}/check-in`,"POST",{},staff.token)).status,200);
 pass("Paid reschedule setelah reject consent: pending/confirm ulang, snapshot10% tetap, refund selisih, DP carried-net membuka check-in");
 const bh=await buat(c,10);const sh=await snap(bh,c);assert.equal(sh.status,200);
 const th=await db.transaksiPembayaranBooking.findUniqueOrThrow({where:{id:sh.body.transaksiId}}),ph=provider.get(th.referensiProvider);
 ph.transaction_status="expire";ph.status_code="407";assert.equal((await notifikasi(ph)).status,200);
 ph.transaction_status="pending";ph.status_code="201";await notifikasi(ph);assert.equal((await db.transaksiPembayaranBooking.findUnique({where:{id:th.id}})).status,"EXPIRED");
 const sh2=await snap(bh,c);assert.equal(sh2.status,200);const th2=await db.transaksiPembayaranBooking.findUniqueOrThrow({where:{id:sh2.body.transaksiId}});
 ph.transaction_status="settlement";ph.status_code="200";ph.settlement_time=waktu();assert.equal((await notifikasi(ph)).status,200);
 const ph2=provider.get(th2.referensiProvider);ph2.transaction_status="settlement";ph2.status_code="200";ph2.settlement_time=waktu();
 assert.equal((await notifikasi(ph2)).status,200);assert.equal((await notifikasi(ph2)).status,200);
 assert.equal((await ringkas(bh,c)).body.ringkasan.jumlahDibayar,100000);
 const rh=await db.permohonanRefundBooking.findMany({where:{bookingId:bh.id}});assert.equal(rh.length,1);assert.equal(rh[0].nominal,50000);
 pass("Expire tidak dihidupkan pending; settlement terlambat/dua DP nyata tetap disimpan dan duplikat DP membuat satu refund request");
 const bi=await buat(g,11);const si=await snap(bi,g);assert.equal(si.status,200);
 const ti=await db.transaksiPembayaranBooking.findUniqueOrThrow({where:{id:si.body.transaksiId}}),pi=provider.get(ti.referensiProvider);
 await http(`/customer/bookings/${bi.id}/cancel`,"POST",{},g.token);pi.transaction_status="settlement";pi.status_code="200";pi.settlement_time=waktu();
 const transaksiAsli=db.$transaction.bind(db);
 db.$transaction=(jalan,opsi)=>transaksiAsli(async tx=>jalan(new Proxy(tx,{get(target,nama){
  if(nama==="permohonanRefundBooking")return new Proxy(target.permohonanRefundBooking,{get(del,aksi){if(aksi==="create")return async()=>{throw new Error("ROLLBACK_WEBHOOK_F7");};return Reflect.get(del,aksi);}});
  return Reflect.get(target,nama);
 }})),opsi);
 try{assert.equal((await notifikasi(pi)).status,503);}finally{db.$transaction=transaksiAsli;}
 assert.equal((await db.transaksiPembayaranBooking.findUnique({where:{id:ti.id}})).status,"PENDING");assert.equal(await db.buktiProviderBooking.count({where:{transaksiId:ti.id}}),0);
 assert.equal((await notifikasi(pi)).status,200);assert.equal(await db.permohonanRefundBooking.count({where:{bookingId:bi.id}}),1);
 pass("Webhook gagal refund allocation rollback kredit/evidence bersama; provider retry sukses tanpa double count");
 const bj=await buat(e,12),buatSnapAsli=gerbangMidtrans.buatSnap;let gagalCalls=0;
 gerbangMidtrans.buatSnap=async()=>{gagalCalls++;throw new Error("UNCERTAIN_SNAP_F7");};
 try{assert.equal((await snap(bj,e)).status,503);assert.equal((await snap(bj,e)).status,503);assert.equal(gagalCalls,1);}finally{gerbangMidtrans.buatSnap=buatSnapAsli;}
 assert.equal((await db.percobaanSnapBooking.findFirst({where:{transaksi:{bookingId:bj.id}}})).status,"UNCERTAIN");
 const bk=await buat(f,13),lama=new Date(Date.now()-2*3600000);
 await utc(tx=>tx.booking.update({where:{id:bk.id},data:{dikonfirmasiPada:lama,deadlineDp:new Date(lama.getTime()+3600000)}}));
 assert.equal((await snap(bk,f)).status,409);
 process.env.MIDTRANS_IS_PRODUCTION="true";try{assert.equal((await snap(bk,f)).status,503);}finally{process.env.MIDTRANS_IS_PRODUCTION="false";}
 assert.equal((await http(`/customer/payments/${ta.id}/sync`,"POST",{},b.token)).status,404);
 pass("Snap timeout reserved/UNCERTAIN, retry tanpa tagihan baru; deadline/Production gagal tertutup, sync own-scope");
 console.log(`Total: ${total} kelompok MOCK F7 PASS; bukan Sandbox provider nyata.`);
}catch(err){console.error(`FAIL MOCK F7 (${err.name}); detail credential/token tidak dicetak.`);process.exitCode=1;}
finally{
 Object.assign(gerbangMidtrans,asli);
 try{
  const ids=pelanggan.map(p=>p.id);const books=await db.booking.findMany({where:{pelangganId:{in:ids}},select:{id:true,pesananId:true}});const bids=books.map(b=>b.id),oids=books.filter(b=>b.pesananId).map(b=>b.pesananId);
  await utc(async tx=>{
   await tx.permohonanRefundBooking.deleteMany({where:{bookingId:{in:bids}}});await tx.invoiceBooking.deleteMany({where:{bookingId:{in:bids}}});
   await tx.transaksiPembayaranBooking.deleteMany({where:{bookingId:{in:bids},tujuan:"REFUND"}});await tx.transaksiPembayaranBooking.deleteMany({where:{bookingId:{in:bids}}});
   await tx.booking.deleteMany({where:{id:{in:bids}}});await tx.pembayaran.deleteMany({where:{pesananId:{in:oids}}});await tx.pesanan.deleteMany({where:{id:{in:oids}}});await tx.pelanggan.deleteMany({where:{id:{in:ids}}});
  });await db.pengguna.deleteMany({where:{id:{in:operator.map(o=>o.id)}}});if(layanan)await db.layanan.delete({where:{id:layanan.id}});if(murah)await db.layanan.delete({where:{id:murah.id}});if(barber)await db.barber.delete({where:{id:barber.id}});if(barberCadangan)await db.barber.delete({where:{id:barberCadangan.id}});
  console.log("PASS: fixture F7 dibersihkan.");
 }finally{try{if(server)await new Promise(resolve=>server.close(resolve));}finally{await db.$disconnect();}}
}
