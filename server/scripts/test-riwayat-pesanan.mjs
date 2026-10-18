import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import jwt from 'jsonwebtoken';
if(!/^\/bb_guest_20261016_[a-f0-9]{8}$/.test(new URL(process.env.DATABASE_URL??'').pathname))throw Error('Wajib database fixture terisolasi');
const {default:db}=await import('../dist/lib/prisma.js');
const {default:app}=await import('../dist/app.js');
const {daftarRiwayatPesanan,detailRiwayatPesanan,skemaRiwayatPesanan}=await import('../dist/services/riwayat-pesanan.service.js');
const models=['pengguna','pelanggan','barber','layanan','pesanan','itemPesanan','pembayaran','riwayatStatusPesanan','booking','itemBooking','riwayatBooking','transaksiPembayaranBooking','buktiProviderBooking','invoiceBooking'];
const dalam=fn=>db.$transaction(async tx=>{await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;return fn(tx);});
for(const m of models)assert.equal(await db[m].count(),0,'Database fixture wajib kosong');
const tag='arsip-'+randomUUID(),sekarang=new Date('2026-10-17T08:00:00Z'),waktu=s=>new Date(s),ids={booking:[],pesanan:[],pelanggan:[],pengguna:[],barber:[],layanan:[]},ekspektasi=[];
const baca=(f={})=>daftarRiwayatPesanan(skemaRiwayatPesanan.parse(f),sekarang),semua={periode:'RENTANG',mulai:'2026-01-01',selesai:'2026-10-31'};
let server,kelompok=0;const lulus=s=>console.log(`PASS RIWAYAT ${++kelompok}: ${s}`);
try{
 const customer=await dalam(tx=>tx.pelanggan.create({data:{nama:'Pelanggan Arsip Terisolasi',nomorTelepon:'0812 3456-7890'}}));ids.pelanggan.push(customer.id);
 const barber=await db.barber.create({data:{nama:tag}});ids.barber.push(barber.id);
 const layanan=await db.layanan.create({data:{nama:tag,harga:10000,durasiMenit:30}});ids.layanan.push(layanan.id);
 const item={layananId:layanan.id,namaLayanan:'Layanan arsip',harga:10000,qty:1,subtotal:10000,durasiMenit:30};
 const booking=async(n,status,penutupan,{aksi,kolom=true,extra={}}={})=>{
   const b=await dalam(tx=>tx.booking.create({data:{nomorBooking:n+'-'+tag,pelangganId:customer.id,status,...(status==='AWAITING_DP'?{sumberBooking:'TAMU',deadlineDp:waktu('2026-08-01T00:15:00Z')}:{}),
    mulaiPada:waktu('2026-09-01T03:00:00Z'),selesaiPada:waktu('2026-09-01T03:30:00Z'),durasiMenit:30,subtotal:10000,total:10000,nominalDp:5000,membershipAktif:false,discountPercent:0,diskon:0,
    dibuatPada:waktu('2026-08-01T00:00:00Z'),items:{create:item},...(status==='REJECTED'?{alasanPenolakan:'Fixture ditolak'}:{}),
    ...(kolom&&penutupan?status==='COMPLETED'?{layananSelesaiPada:penutupan}:status==='CANCELLED'?{dibatalkanPada:penutupan}:status==='REJECTED'?{ditolakPada:penutupan}:{}:{}),
    ...(penutupan?{riwayat:{create:{aksi:aksi??(status==='COMPLETED'?'COMPLETE':status==='NO_SHOW'?'NO_SHOW':'CANCEL'),statusSebelum:'CONFIRMED',statusSetelah:status,dibuatPada:penutupan}}}:{}),...extra}}));
   ids.booking.push(b.id);if(['COMPLETED','CANCELLED','REJECTED','NO_SHOW'].includes(status))ekspektasi.push({jenis:'BOOKING',id:b.id,penutupan:penutupan?.toISOString()??null});return b;
 };
 const walk=async(n,status,penutupan,{paid=false,extra={}}={})=>{
   const p=await dalam(tx=>tx.pesanan.create({data:{nomorPesanan:n+'-'+tag,pelangganId:customer.id,barberId:barber.id,status,statusPembayaran:paid?'PAID':'UNPAID',checkInTime:waktu('2026-09-01T00:00:00Z'),subtotal:10000,total:10000,items:{create:item},
    ...(penutupan?{riwayatStatus:{create:{status,diubahPada:penutupan}}}:{}),...(paid?{pembayaran:{create:{nomorInvoice:'INV-'+n+'-'+tag,metode:'CASH',jumlahDiterima:12000,kembalian:2000,dibayarPada:sekarang}}}:{}),...extra}}));
   ids.pesanan.push(p.id);if(['COMPLETED','CANCELLED'].includes(status))ekspektasi.push({jenis:'WALK_IN',id:p.id,penutupan:penutupan?.toISOString()??null});return p;
 };
 for(let i=0;i<28;i++){const at=new Date(sekarang.getTime()-i*60000);if(i%2)await walk('W-'+i,'COMPLETED',at);else await booking('B-'+i,'COMPLETED',at);}
 const timeout=await booking('TIMEOUT','CANCELLED',waktu('2026-10-17T07:20:00Z'),{aksi:'TIMEOUT_DP'});
 const manual=await booking('MANUAL','CANCELLED',waktu('2026-10-17T07:19:00Z'));
 const rejected=await booking('REJECT','REJECTED',waktu('2026-10-17T07:18:00Z'));
 const noShow=await booking('NO-SHOW','NO_SHOW',waktu('2026-10-17T07:17:00Z'));
 const fallback=await booking('HISTORY-FALLBACK','COMPLETED',waktu('2026-10-10T03:00:00Z'),{kolom:false});
 await db.riwayatBooking.create({data:{bookingId:fallback.id,aksi:'PAYMENT_OVERDUE',statusSebelum:'COMPLETED',statusSetelah:'COMPLETED',dibuatPada:sekarang}});
 const unknown=await booking('NO-CLOSURE','COMPLETED',null);
 await booking('OLD','COMPLETED',waktu('2026-01-01T00:00:00Z'));
 await booking('BEFORE-MIDNIGHT','CANCELLED',waktu('2026-10-16T16:59:59.999Z'));
 const midnight=await booking('MIDNIGHT','COMPLETED',waktu('2026-10-16T17:00:00Z'));
 const paidWalk=await walk('W-PAID','COMPLETED',waktu('2026-10-17T06:30:00Z'),{paid:true});
 await walk('W-CANCEL','CANCELLED',waktu('2026-10-17T06:00:00Z'));
 const active=await booking('ACTIVE','IN_SERVICE',null);await booking('WAIT-DP','AWAITING_DP',null);await walk('WAIT','WAITING',null);await walk('SERVING','IN_SERVICE',null);
 const linked=await walk('LINKED','COMPLETED',waktu('2026-10-17T04:00:00Z'));
 const linkedBooking=await booking('LINKED-B','COMPLETED',waktu('2026-10-17T04:00:00Z'),{extra:{pesananId:linked.id}});
 ekspektasi.splice(ekspektasi.findIndex(x=>x.jenis==='WALK_IN'&&x.id===linked.id),1);
 const sorted=ekspektasi.filter(x=>x.penutupan).sort((a,b)=>b.penutupan.localeCompare(a.penutupan)||a.jenis.localeCompare(b.jenis)||b.id-a.id);
 const data=[];let d=await baca(semua);for(let halaman=1;halaman<=d.totalHalaman;halaman++)data.push(...(await baca({...semua,halaman})).data);
 assert.equal(d.batas,20);assert.equal(d.data.length,20);assert.equal(d.total,sorted.length);assert.deepEqual(data.map(x=>[x.jenis,x.id]),sorted.map(x=>[x.jenis,x.id]));assert.equal(new Set(data.map(x=>x.jenis+':'+x.id)).size,d.total);assert.ok(data.some(x=>x.jenis==='BOOKING')&&data.some(x=>x.jenis==='WALK_IN'));lulus('Union global terminal, tie-break dan pagination20 tanpa duplikasi Pesanan linked');
 for(const jenis of ['BOOKING','WALK_IN'])assert.ok((await baca({...semua,jenis})).data.every(x=>x.jenis===jenis));
 assert.ok(data.every(x=>['COMPLETED','CANCELLED','REJECTED','NO_SHOW'].includes(x.statusBackend)));assert.equal(await detailRiwayatPesanan('BOOKING',active.id),null);lulus('Tab kedua jenis, status aktif tidak masuk, drawer aktif 404');
 const expired=await baca({...semua,status:'EXPIRED'});assert.equal(expired.total,1);assert.equal(expired.data[0].id,timeout.id);
 const cancelled=(await baca({...semua,status:'CANCELLED'})).data;for(const b of [manual,rejected,noShow])assert.ok(cancelled.some(x=>x.jenis==='BOOKING'&&x.id===b.id));lulus('Mapping timeout, pembatalan manual, ditolak dan tidak hadir tanpa mengubah lifecycle');
 assert.equal(d.tanpaWaktuPenutupan,1);assert.equal((await detailRiwayatPesanan('BOOKING',unknown.id)).penutupan,null);assert.equal(data.find(x=>x.jenis==='BOOKING'&&x.id===fallback.id).penutupan.toISOString(),'2026-10-10T03:00:00.000Z');lulus('Closure field/history transisi resmi, self-event pembayaran diabaikan, waktu hilang tidak dibuat-buat');
 const today=await baca({periode:'HARI_INI',cari:'MIDNIGHT-'});assert.equal(today.total,1);assert.equal(today.data[0].id,midnight.id);assert.equal((await baca({periode:'HARI_INI',cari:'BEFORE-MIDNIGHT-'})).total,0);
 assert.ok((await baca()).total<d.total);assert.equal((await baca({periode:'RENTANG',mulai:'2026-01-01',selesai:'2026-01-01'})).total,1);for(const periode of ['TUJUH_HARI','TIGA_PULUH_HARI'])assert.ok((await baca({periode})).data.every(x=>x.penutupan>=waktu(periode==='TUJUH_HARI'?'2026-10-10T17:00:00Z':'2026-09-17T17:00:00Z')));lulus('Hari ini,7,30hari dan rentang historis mengikuti closure dan batas tengah malam WIB');
 for(const cari of ['Pelanggan Arsip','B-0-','081234567890','+62 812 3456 7890'])assert.ok((await baca({...semua,cari})).total>0);
 assert.equal((await baca({...semua,cari:"%' OR true --"})).total,0);assert.equal((await baca({...semua,jenis:'BOOKING',status:'EXPIRED',cari:'TIMEOUT'})).total,1);assert.equal((await baca({...semua,halaman:999})).halaman,d.totalHalaman);lulus('Pencarian nama/nomor/telepon ternormalisasi, gabungan filter, injeksi dan page clamp');
 const before=data.map(x=>x.jenis+':'+x.id),unpaidWalk=data.find(x=>x.jenis==='WALK_IN'&&x.statusPembayaran==='UNPAID');
 await dalam(tx=>tx.pembayaran.create({data:{pesananId:unpaidWalk.id,nomorInvoice:'AFTER-'+tag,metode:'CASH',jumlahDiterima:10000,kembalian:0,dibayarPada:new Date(sekarang.getTime()+3600000)}}));await db.pesanan.update({where:{id:unpaidWalk.id},data:{statusPembayaran:'PAID'}});
 const after=[];for(let halaman=1;halaman<=d.totalHalaman;halaman++)after.push(...(await baca({...semua,halaman})).data);assert.deepEqual(after.map(x=>x.jenis+':'+x.id),before);assert.ok(after.some(x=>x.jenis==='WALK_IN'&&x.statusPembayaran==='UNPAID'));lulus('Selesai belum lunas diarsip; pembayaran setelah closure tidak mengubah urutan');
 const detail=await detailRiwayatPesanan('WALK_IN',paidWalk.id);assert.equal(detail.pembayaran.jumlahDibayar,10000);assert.equal(detail.pembayaran.balance,0);assert.ok(detail.pembayaran.invoice.nomorInvoice.startsWith('INV-'));assert.equal(detail.riwayat.length,1);assert.ok(detail.nomorTelepon);assert.equal((await detailRiwayatPesanan('BOOKING',linkedBooking.id)).items[0].namaLayanan,item.namaLayanan);lulus('Detail aktual, receipt sah, invoice tersimpan, layanan dan histori nyata');
 const key=randomUUID(),paidBook=await booking('B-PAID','COMPLETED',waktu('2026-10-17T03:30:00Z'),{extra:{dikonfirmasiPada:waktu('2026-09-01T00:00:00Z'),deadlineDp:waktu('2026-09-01T01:00:00Z')}});
 await db.transaksiPembayaranBooking.create({data:{bookingId:paidBook.id,tujuan:'DP',kanal:'MIDTRANS',status:'SUCCEEDED',nominal:5000,referensiProvider:key,kunciIdempotensi:key,sidikPermintaan:key,roundKonfirmasiPada:paidBook.dikonfirmasiPada,deadlinePada:paidBook.deadlineDp,dibayarPada:waktu('2026-09-01T00:30:00Z'),buktiProvider:{create:{referensiProvider:key,nominal:5000,mataUang:'IDR',fingerprintPayload:createHash('sha256').update(key).digest('hex'),terverifikasiPada:sekarang}}}});
 const dbukti=await detailRiwayatPesanan('BOOKING',paidBook.id);assert.equal(dbukti.pembayaran.jumlahDibayar,5000);assert.equal(dbukti.pembayaran.balance,5000);assert.equal(dbukti.pembayaran.invoice,null);lulus('Ledger Booking memakai bukti sah; DP tidak dianggap lunas dan tidak membuat invoice');
 const admin=await db.pengguna.create({data:{name:tag,email:tag+'@example.invalid',passwordHash:'fixture-unused',role:'ADMIN'}});ids.pengguna.push(admin.id);
 server=createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/management/history';
 const snapshot=()=>dalam(async tx=>{const data={};for(const m of models)data[m]=await tx[m].findMany({orderBy:{id:'asc'}});return createHash('sha256').update(JSON.stringify(data,(_,v)=>typeof v==='bigint'?v.toString():v)).digest('hex');});const awal=await snapshot();
 assert.equal((await fetch(url)).status,401);assert.equal((await fetch(url,{headers:{Authorization:'Bearer '+jwt.sign({id:admin.id,role:'CUSTOMER'},process.env.JWT_SECRET)}})).status,401);
 for(const role of ['ADMIN','STAFF']){const headers={Authorization:'Bearer '+jwt.sign({id:admin.id,role},process.env.JWT_SECRET)};const r=await fetch(url,{headers});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.ok(!/nomorTelepon|passwordHash|referensiProvider|sidikPermintaan|tokenHash/.test(JSON.stringify(await r.json())));assert.equal((await fetch(url+'/BOOKING/'+active.id,{headers})).status,404);assert.equal((await fetch(url+'/WALK_IN/'+paidWalk.id,{headers})).status,200);for(const q of ['?periode=RENTANG&mulai=2026-10-20&selesai=2026-10-01','?batas=21','?halaman=0','?periode=RENTANG&mulai=2026-02-30&selesai=2026-03-02'])assert.equal((await fetch(url+q,{headers})).status,400);assert.equal((await fetch(url,{method:'POST',headers})).status,404);}
 assert.equal(await snapshot(),awal);lulus('HTTP auth/roles,validasi,DTO list tanpa telepon/rahasia,GET read-only dan tanpa endpoint mutasi');
 console.log(`TOTAL ${kelompok} kelompok PASS. Hanya database fixture, tanpa request provider.`);
}catch(e){console.error('FAIL RIWAYAT',e.name,e.code??'',e.name==='AssertionError'?e.message:e.meta?.driverAdapterError?.cause?.message??e.cause?.message??e.message?.split('\n').at(-1));process.exitCode=1;}
finally{
 if(server)await new Promise(r=>server.close(r));
 await dalam(async tx=>{await tx.buktiProviderBooking.deleteMany({where:{transaksi:{bookingId:{in:ids.booking}}}});await tx.transaksiPembayaranBooking.deleteMany({where:{bookingId:{in:ids.booking}}});await tx.booking.deleteMany({where:{id:{in:ids.booking}}});await tx.pembayaran.deleteMany({where:{pesananId:{in:ids.pesanan}}});await tx.pesanan.deleteMany({where:{id:{in:ids.pesanan}}});await tx.pelanggan.deleteMany({where:{id:{in:ids.pelanggan}}});await tx.pengguna.deleteMany({where:{id:{in:ids.pengguna}}});await tx.barber.deleteMany({where:{id:{in:ids.barber}}});await tx.layanan.deleteMany({where:{id:{in:ids.layanan}}});});
 for(const m of models)assert.equal(await db[m].count(),0);await db.$disconnect();console.log('PASS cleanup: hanya ID fixture, seluruh model kembali kosong.');
}
