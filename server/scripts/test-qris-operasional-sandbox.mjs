// Opt-in, database fixture saja, key Sandbox dibaca privat oleh runner di luar Git.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createServer} from 'node:http';
import jwt from 'jsonwebtoken';
import {createRequire} from 'node:module';
if(process.env.BB_REAL_SANDBOX!=='1'||process.env.MIDTRANS_IS_PRODUCTION!=='false'||!/^\/bb_guest_20261016_[a-f0-9]{8}$/.test(new URL(process.env.DATABASE_URL??'').pathname))throw Error('Wajib opt-in Sandbox dan fixture');
const temp=(await fs.readFile(path.join(process.env.TEMP,'bb-detail-tindakan-current.txt'),'utf8')).trim(),statePath=path.join(temp,'sandbox-state.json');
const {default:db}=await import('../dist/lib/prisma.js');
const {buatPembayaranOperasional,sinkronPembayaranOperasional}=await import('../dist/services/pembayaran-operasional.service.js');
const {gerbangMidtrans}=await import('../dist/lib/midtrans.js');
const requireClient=createRequire(new URL('../../client/package.json',import.meta.url)),{chromium}=requireClient('playwright');
let browser,server;
try{
 if(process.env.BB_SANDBOX_MODE==='probe'){
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();await page.goto('https://simulator.sandbox.midtrans.com/v2/qris/index');
  console.log(JSON.stringify(await page.locator('input,button,select').evaluateAll(els=>els.map(e=>({tag:e.tagName,type:e.type,id:e.id,name:e.name,text:e.textContent?.trim(),value:e.type==='submit'?e.value:undefined})))));
 }else if(process.env.BB_SANDBOX_MODE==='prepare'){
  try{await fs.access(statePath);throw Error('State Sandbox existing harus diselesaikan dahulu');}catch(e){if(e.code!=='ENOENT')throw e;}
  assert.equal(await db.pesanan.count(),0);const tag='sandbox-inline-'+randomUUID();
  const ids=await db.$transaction(async tx=>{await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;const op=await tx.pengguna.create({data:{name:'Penguji QRIS Sandbox',email:tag+'@example.invalid',passwordHash:'fixture-unused',role:'ADMIN'}}),c=await tx.pelanggan.create({data:{nama:'Pengujian QRIS Sandbox',nomorTelepon:null}}),b=await tx.barber.create({data:{nama:'Barber pengujian Sandbox'}}),l=await tx.layanan.create({data:{nama:'Layanan pengujian QRIS',harga:5000,durasiMenit:10}});const p=await tx.pesanan.create({data:{nomorPesanan:tag,pelangganId:c.id,barberId:b.id,status:'COMPLETED',subtotal:5000,total:5000,items:{create:{layananId:l.id,namaLayanan:l.nama,harga:5000,qty:1,subtotal:5000,durasiMenit:10}},riwayatStatus:{create:{status:'COMPLETED',penggunaId:op.id}}}});return{op:op.id,pelanggan:c.id,barber:b.id,layanan:l.id,pesanan:p.id,tag};});
  await fs.writeFile(statePath,JSON.stringify(ids),{flag:'wx'});
  const r=await buatPembayaranOperasional(ids.pesanan,ids.op,{metode:'QRIS',kunciIdempotensi:randomUUID(),tagihanDiharapkan:5000});
  const t=await db.pembayaranOperasional.findUniqueOrThrow({where:{id:r.transaksi.id}});await fs.writeFile(statePath,JSON.stringify({...ids,transaksi:t.id,orderId:t.providerOrderId,urlQris:t.urlQris}));
  console.log(JSON.stringify({status:t.status,fase:t.faseProvider,nominal:t.nominal,gambarTersedia:!!t.urlQris,providerStatus:t.statusProvider}));
 }else{
  const state=JSON.parse(await fs.readFile(statePath,'utf8'));if(!state.tag?.startsWith('sandbox-inline-'))throw Error('State tidak valid');
  if(process.env.BB_SANDBOX_MODE==='complete'){
   const t=await db.pembayaranOperasional.findUniqueOrThrow({where:{id:state.transaksi}});assert.ok(t.urlQris);const op=await db.pengguna.findUniqueOrThrow({where:{id:state.op}}),{default:app}=await import('../dist/app.js');server=createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,token=jwt.sign({id:op.id,role:'ADMIN'},process.env.JWT_SECRET);
   browser=await chromium.launch({channel:'chrome',headless:true});const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage();await ctx.addInitScript(({token,user})=>{localStorage.setItem('barber_token',token);localStorage.setItem('barber_user',JSON.stringify(user));},{token,user:{id:op.id,name:op.name,email:op.email,role:'ADMIN'}});await page.route('**/api/**',async route=>{const q=route.request(),u=new URL(q.url()),r=await fetch(base+u.pathname.slice(4)+u.search,{method:q.method(),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(q.postData()?{body:q.postData()}: {})});await route.fulfill({status:r.status,contentType:'application/json',body:await r.text()});});
   const out=path.resolve('../docs/ui/screenshots/detail-tindakan');await fs.mkdir(out,{recursive:true});for(const width of [1440,390]){await page.setViewportSize({width,height:width===390?844:1000});await page.goto('http://localhost:5173/?rincianPesanan='+state.pesanan);await page.locator('.dt-qris img').waitFor();await page.waitForFunction(()=>{const img=document.querySelector('.dt-qris img');return img?.complete&&img.naturalWidth>0;});await page.locator('.dt-qris').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,width+'-qris-sandbox-pending.png')});}
   assert.equal(await db.pembayaranOperasional.count({where:{pesananId:state.pesanan}}),1);
   const simulator=await browser.newPage();await simulator.goto('https://simulator.sandbox.midtrans.com/v2/qris/index');await simulator.locator('#qrCodeUrl').fill(t.urlQris);await simulator.locator('input[value="Scan QR"]').click();await simulator.locator('#issuer').selectOption({label:'GoPay'});await simulator.locator('input[value="Pay"]').click();
   let status;for(let i=0;i<20;i++){status=await gerbangMidtrans.status(state.orderId);if(status.transaction_status==='settlement')break;await new Promise(r=>setTimeout(r,1000));}assert.equal(status.transaction_status,'settlement');assert.equal(status.payment_type,'qris');assert.equal(Number(status.gross_amount),5000);
   const cek=page.getByRole('button',{name:'Periksa Status QRIS',exact:true});if(await cek.isVisible())await cek.click();await page.getByRole('dialog',{name:'Rincian pesanan'}).waitFor({state:'detached',timeout:25000});
   const signature=createHash('sha512').update(status.order_id+status.status_code+status.gross_amount+process.env.MIDTRANS_SERVER_KEY).digest('hex');for(let i=0;i<2;i++){const r=await fetch(base+'/midtrans/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...status,signature_key:signature})});assert.equal(r.status,200);}
   const paid=await db.pesanan.findUniqueOrThrow({where:{id:state.pesanan},include:{pembayaran:true}}),hasil=await db.pembayaranOperasional.findUniqueOrThrow({where:{id:state.transaksi}});assert.equal(paid.statusPembayaran,'PAID');assert.equal(hasil.status,'SUCCEEDED');assert.ok(paid.pembayaran);assert.equal(await db.pembayaran.count({where:{pesananId:state.pesanan}}),1);
   const bukti={status:'PASS',provider:'MIDTRANS_SANDBOX_GET_STATUS',order_id:status.order_id,transaction_id:status.transaction_id,nominal:Number(status.gross_amount),statusProvider:status.transaction_status,invoice:paid.pembayaran.nomorInvoice,replay:2,autoClose:true,gambarResmi:true,catatan:'Fixture PostgreSQL terisolasi, UI source asli; rekonsiliasi provider nyata. Replay HTTP lokal memakai signature dari payload Get Status; bukan bukti delivery internet webhook.'};await fs.writeFile(path.resolve('../docs/ui/DETAIL-TINDAKAN-SANDBOX.json'),JSON.stringify(bukti,null,2));await fs.writeFile(path.join(temp,'sandbox-provider-proof.json'),JSON.stringify(status));console.log(JSON.stringify({status:'PASS',nominal:5000,providerStatus:status.transaction_status,paid:paid.statusPembayaran,invoice:true,replay:2,autoClose:true}));await ctx.close();
  }else if(process.env.BB_SANDBOX_MODE==='scan'){

   const t=await db.pembayaranOperasional.findUniqueOrThrow({where:{id:state.transaksi}});assert.ok(t.urlQris);browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();await page.goto('https://simulator.sandbox.midtrans.com/v2/qris/index');await page.locator('#qrCodeUrl').fill(t.urlQris);await page.locator('input[type=submit]').click();await page.waitForTimeout(1000);console.log(JSON.stringify(await page.locator('input,button,select,a.btn').evaluateAll(els=>els.map(e=>({tag:e.tagName,type:e.type,id:e.id,name:e.name,text:e.textContent?.trim(),value:e.type==='submit'?e.value:undefined})))));
  }else if(process.env.BB_SANDBOX_MODE==='image'){
 const p=await gerbangMidtrans.status(state.orderId); const image=await fetch('https://api.sandbox.midtrans.com/v2/qris/'+encodeURIComponent(p.transaction_id)+'/qr-code',{redirect:'error'});console.log(JSON.stringify({status:image.status,type:image.headers.get('content-type')}));
  }else if(process.env.BB_SANDBOX_MODE==='inspect'){ const p=await gerbangMidtrans.status(state.orderId); console.log(JSON.stringify({actions:p.actions?.map(a=>({name:a.name,method:a.method,host:new URL(a.url).hostname,path:new URL(a.url).pathname.split('/').map((v,i)=>i===3?'[ID]':v).join('/')})),expiry:p.expiry_time,status:p.transaction_status}));
  }else if(process.env.BB_SANDBOX_MODE==='status'){
   const p=await gerbangMidtrans.status(state.orderId);console.log(JSON.stringify({status:p.transaction_status,nominal:p.gross_amount,paymentType:p.payment_type}));
  }else if(process.env.BB_SANDBOX_MODE==='sync'){
   await sinkronPembayaranOperasional(state.pesanan,state.transaksi);const p=await db.pesanan.findUniqueOrThrow({where:{id:state.pesanan},include:{pembayaran:true}}),t=await db.pembayaranOperasional.findUniqueOrThrow({where:{id:state.transaksi}});
   console.log(JSON.stringify({status:t.status,providerStatus:t.statusProvider,paid:p.statusPembayaran,invoice:!!p.pembayaran,nominal:t.nominal}));
  }else if(process.env.BB_SANDBOX_MODE==='cleanup'){
   const t=await db.pembayaranOperasional.findUniqueOrThrow({where:{id:state.transaksi}});if(t.status==='PENDING')throw Error('Tidak membersihkan intent provider Pending');
   await db.$transaction(async tx=>{await tx.pembayaranOperasional.delete({where:{id:state.transaksi}});await tx.pembayaran.deleteMany({where:{pesananId:state.pesanan}});await tx.pesanan.delete({where:{id:state.pesanan}});await tx.pelanggan.delete({where:{id:state.pelanggan}});await tx.pengguna.delete({where:{id:state.op}});await tx.barber.delete({where:{id:state.barber}});await tx.layanan.delete({where:{id:state.layanan}});});console.log('PASS cleanup ID fixture Sandbox tanpa reset');
  }
 }
}catch(e){console.error('FAIL SANDBOX',e.name,e.code??'',e.message?.split('\n').at(-1));process.exitCode=1;}
finally{await browser?.close();if(server)await new Promise(r=>server.close(r));await db.$disconnect();}
