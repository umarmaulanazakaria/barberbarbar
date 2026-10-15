import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.DATABASE_URL??'').hostname));
const {default:db}=await import('../dist/lib/prisma.js'),{default:app}=await import('../dist/app.js');
const model=['pelanggan','akunPelanggan','pengguna','barber','layanan','membership','pesanan','itemPesanan','pembayaran','riwayatStatusPesanan','passwordResetToken','permohonanPengaitanAkun','permohonanMembership','booking','itemBooking','usulanBarberBooking','riwayatBooking','transaksiPembayaranBooking','buktiProviderBooking','invoiceBooking','percobaanSnapBooking','permohonanRefundBooking'];
const snapshot=()=>db.$transaction(async tx=>{const d={};for(const m of model)d[m]=await tx[m].findMany({orderBy:{id:'asc'}});return JSON.stringify(d);},{isolationLevel:'RepeatableRead'});
const before=await snapshot(),tag=`e2e-reschedule-${randomUUID()}`,results=[];let customer,operator,barber,backup,service,server;
const original=db.$transaction.bind(db);
try{
 const password=randomBytes(18).toString('hex'),hash=await bcrypt.hash(password,10);barber=await db.barber.create({data:{nama:tag}});backup=await db.barber.create({data:{nama:tag}});service=await db.layanan.create({data:{nama:tag,harga:10000,durasiMenit:30}});
 customer=await db.pelanggan.create({data:{nama:tag,nomorTelepon:`08${randomBytes(8).readBigUInt64BE().toString().slice(0,11)}`,akunPelanggan:{create:{email:`${tag}@example.invalid`,passwordHash:hash}}},include:{akunPelanggan:true}});
 operator=await db.pengguna.create({data:{name:tag,email:`${tag}-admin@example.invalid`,passwordHash:hash,role:'ADMIN'}});
 // Gunakan login service yang sama; password fixture hanya ada di memori.
 const {loginPelanggan}=await import('../dist/services/auth-pelanggan.service.js');
 const ct=(await loginPelanggan({identitas:`${tag}@example.invalid`,password})).token,ot=jwt.sign({id:operator.id,role:'ADMIN'},process.env.JWT_SECRET,{expiresIn:'10m'});
 server=app.listen(0,'127.0.0.1');await once(server,'listening');const url=`http://127.0.0.1:${server.address().port}`;
 const http=async(p,body,token)=>{const r=await fetch(url+p,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});return{status:r.status,body:await r.json()};};
 const hari=n=>new Date(Date.now()+7*3600000+n*86400000).toISOString().slice(0,10)+'T10:00:00+07:00';
 for(const [i,jeda]of[3599999,3600000,-60000].entries()){
  const r=await http('/customer/bookings',{mulaiPada:hari(7+i),barberPilihanId:barber.id,items:[{layananId:service.id,qty:1}]},ct);assert.equal(r.status,201);const b=r.body.booking;
  assert.equal((await http(`/bookings/${b.id}/confirm`,{},ot)).status,200);const proposal=await http(`/bookings/${b.id}/barber-proposals`,{barberId:backup.id,alasan:'Dummy E2E'},ot);assert.equal(proposal.status,200);
  const u=await db.usulanBarberBooking.findFirstOrThrow({where:{bookingId:b.id},orderBy:{id:'desc'}});assert.equal((await http(`/customer/bookings/${b.id}/barber-proposals/${u.id}/reject`,{},ct)).status,200);
  const clock=Date.parse(b.mulaiPada)-jeda;
  // Test-only clock di adapter transaksi: tidak mengubah jam OS/PostgreSQL atau endpoint.
  db.$transaction=(fn,options)=>original(tx=>fn(new Proxy(tx,{get(t,k){if(k==='$queryRaw')return(...args)=>Array.isArray(args[0])&&args[0].join('').includes('clock_timestamp')?Promise.resolve([{milidetik:clock}]):t.$queryRaw(...args);return Reflect.get(t,k);}})),options);
  let actual;try{actual=await http(`/customer/bookings/${b.id}/reschedule`,{mulaiPada:hari(10+i),barberPilihanId:null},ct);}finally{db.$transaction=original;}
  const expected=jeda>=3600000?200:409;results.push({id:`RESCHEDULE-${i}`,jedaMs:jeda,expected,actual:actual.status,status:actual.status===expected?'PASS':'FAIL'});
 }
 const weekdays=new Set();
 for(let n=1;n<=7;n++){
  const mulaiPada=hari(n).replace('T10:00','T14:13');const r=await http('/customer/bookings',{mulaiPada,barberPilihanId:null,items:[{layananId:service.id,qty:1}]},ct);const day=new Intl.DateTimeFormat('id-ID',{weekday:'long',timeZone:'Asia/Jakarta'}).format(new Date(mulaiPada));weekdays.add(day);results.push({id:`HARI-${n}`,hari:day,expected:201,actual:r.status,status:r.status===201?'PASS':'FAIL'});
 }assert.equal(weekdays.size,7);
 if(results.some(r=>r.status==='FAIL'))process.exitCode=1;console.log(JSON.stringify(results));
}finally{
 db.$transaction=original;
 try{if(customer){await db.booking.deleteMany({where:{pelangganId:customer.id}});await db.pelanggan.delete({where:{id:customer.id}});}if(operator)await db.pengguna.delete({where:{id:operator.id}});if(service)await db.layanan.delete({where:{id:service.id}});await db.barber.deleteMany({where:{id:{in:[barber?.id,backup?.id].filter(Boolean)}}});assert.ok(await snapshot()===before);console.log('PASS cleanup reschedule:22 model existing identik.');}
 finally{if(server)await new Promise(r=>server.close(r));await db.$disconnect();await mkdir((process.env.BB_AUDIT_OUTPUT_DIR??'e2e'),{recursive:true});await writeFile((process.env.BB_AUDIT_OUTPUT_DIR??'e2e')+'/HASIL-RESCHEDULE.json',JSON.stringify({jenis:'HTTP regression dengan clock transaksi test-only',results},null,2));}
}
