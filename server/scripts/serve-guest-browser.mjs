import {createServer} from 'node:http';
import {randomUUID,createHash} from 'node:crypto';
import bcrypt from 'bcrypt';
if(!/^\/bb_guest_20261016_[a-f0-9]{8}$/.test(new URL(process.env.DATABASE_URL??'').pathname))throw Error('Wajib database fixture guest');
process.env.GUEST_BOOKING_ENABLED='true';process.env.MIDTRANS_MERCHANT_ID='fixture-browser';process.env.MIDTRANS_SERVER_KEY='fixture-server-only';process.env.MIDTRANS_CLIENT_KEY='fixture-client';process.env.MIDTRANS_IS_PRODUCTION='false';
const {default:db}=await import('../dist/lib/prisma.js'),{default:app}=await import('../dist/app.js');
const {gerbangMidtrans}=await import('../dist/lib/midtrans.js');const {notifikasiMidtrans}=await import('../dist/services/midtrans-booking.service.js');
const {verifikasiAksesTamu}=await import('../dist/services/guest-booking.service.js');
const {checkInBooking,mulaiLayananBooking,selesaikanBooking}=await import('../dist/services/operasional-booking.service.js');
const tanda='browser-guest-'+randomUUID(),provider=new Map(),bids=new Set();let berhenti=false;
const barber=await db.barber.create({data:{nama:tanda}}),layanan=await db.layanan.create({data:{nama:'Guest Browser Haircut',harga:10000,durasiMenit:30}}),wash=await db.layanan.create({data:{nama:'Guest Browser Wash',harga:5000,durasiMenit:15}});
const op=await db.pengguna.create({data:{name:tanda,email:tanda+'@example.invalid',passwordHash:await bcrypt.hash('fixture-only-browser',10),role:'STAFF',barberId:barber.id}});
const waktu=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,19).replace('T',' ');
gerbangMidtrans.buatSnap=async p=>{provider.set(p.transaction_details.order_id,{order_id:p.transaction_details.order_id,transaction_id:randomUUID(),merchant_id:'fixture-browser',gross_amount:p.transaction_details.gross_amount+'.00',currency:'IDR',transaction_status:'pending',payment_type:'gopay',status_code:'201',transaction_time:waktu()});return{token:'fixture-snap-'+randomUUID(),redirect_url:'https://app.sandbox.midtrans.com/snap/v2/fixture'};};
gerbangMidtrans.status=async id=>structuredClone(provider.get(id));gerbangMidtrans.refund=async()=>{throw Error('Provider refund tidak diizinkan');};
const server=createServer((req,res)=>{
 if(!req.url.startsWith('/__fixture/'))return app(req,res);
 void(async()=>{try{
  if(req.method==='GET'&&req.url==='/__fixture/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end('{"fixture":true}');}
  if(req.method==='POST'&&req.url==='/__fixture/shutdown'){res.end('{}');await tutup();return;}
  const token=/^Guest ([a-f0-9]{64})$/.exec(req.headers.authorization??'')?.[1]??'',id=await verifikasiAksesTamu(token);bids.add(id);
  if(req.url==='/__fixture/settle'&&req.method==='POST'){
   const tr=await db.transaksiPembayaranBooking.findFirstOrThrow({where:{bookingId:id,kanal:'MIDTRANS',tujuan:{not:'REFUND'}},orderBy:{id:'desc'}});const p=provider.get(tr.referensiProvider);p.status_code='200';p.transaction_status='settlement';p.settlement_time=waktu();const n={...p,signature_key:createHash('sha512').update(p.order_id+p.status_code+p.gross_amount+process.env.MIDTRANS_SERVER_KEY).digest('hex')};await notifikasiMidtrans(n);
  }else if(req.url==='/__fixture/complete'&&req.method==='POST'){await checkInBooking(id,op.id);await mulaiLayananBooking(id,barber.id,op.id);await selesaikanBooking(id,op.id);}
  else if(req.url==='/__fixture/audit'&&req.method==='GET'){
   const creditCount=await db.transaksiPembayaranBooking.count({where:{bookingId:id,status:'SUCCEEDED',tujuan:{in:['DP','PELUNASAN']}}}),invoiceCount=await db.invoiceBooking.count({where:{bookingId:id}});res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({creditCount,invoiceCount}));
  }else{res.writeHead(404);return res.end('{}');}
  res.writeHead(200,{'Content-Type':'application/json'});res.end('{"fixture":true}');
 }catch{res.writeHead(409,{'Content-Type':'application/json'});res.end('{"pesan":"Fixture tidak dapat diproses"}');}})();
});
async function tutup(){if(berhenti)return;berhenti=true;server.close();
 const books=await db.booking.findMany({where:{items:{some:{layananId:{in:[layanan.id,wash.id]}}}},select:{id:true,pelangganId:true,pesananId:true}}),ids=books.map(b=>b.id),oids=books.flatMap(b=>b.pesananId?[b.pesananId]:[]);
 await db.$transaction(async tx=>{await tx.aksesBookingTamu.deleteMany({where:{bookingId:{in:ids}}});await tx.permohonanRefundBooking.deleteMany({where:{bookingId:{in:ids}}});await tx.invoiceBooking.deleteMany({where:{bookingId:{in:ids}}});await tx.transaksiPembayaranBooking.deleteMany({where:{bookingId:{in:ids},tujuan:'REFUND'}});await tx.transaksiPembayaranBooking.deleteMany({where:{bookingId:{in:ids}}});await tx.booking.deleteMany({where:{id:{in:ids}}});await tx.pembayaran.deleteMany({where:{pesananId:{in:oids}}});await tx.pesanan.deleteMany({where:{id:{in:oids}}});await tx.pelanggan.deleteMany({where:{id:{in:books.map(b=>b.pelangganId)}}});});await db.pengguna.delete({where:{id:op.id}});await db.layanan.deleteMany({where:{id:{in:[layanan.id,wash.id]}}});await db.barber.delete({where:{id:barber.id}});await db.$disconnect();console.log('PASS browser fixture cleanup; data existing tidak disentuh.');}
process.on('SIGINT',()=>void tutup());process.on('SIGTERM',()=>void tutup());
server.listen(3185,'127.0.0.1',()=>console.log('Fixture backend siap http://127.0.0.1:3185; provider MOCK, bukan Sandbox nyata.'));
