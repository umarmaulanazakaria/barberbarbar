// Pengujian HTTP nyata; wajib fixture existing, tidak pernah database utama/provider.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import jwt from 'jsonwebtoken';
if (!/^\/bb_guest_20261016_[a-f0-9]{8}$/.test(new URL(process.env.DATABASE_URL ?? '').pathname)) throw Error('Wajib fixture terisolasi');
const { default: db } = await import('../dist/lib/prisma.js'), { default: app } = await import('../dist/app.js');
const tag = 'uji-walkin-' + randomUUID(), ids = { pelanggan: [], pengguna: [], barber: [], layanan: [] };
const models = ['permintaanWalkIn','pengguna','pelanggan','barber','layanan','pesanan','itemPesanan','pembayaran','riwayatStatusPesanan','booking','akunPelanggan','transaksiPembayaranBooking'];
for (const m of models) assert.equal(await db[m].count(), 0, 'Fixture wajib kosong');
let server, browser, n = 0;
const pass = s => console.log(`PASS WALKIN ${++n}: ${s}`);
try {
  const admin = await db.pengguna.create({ data: { name: tag, email: tag+'@example.invalid', passwordHash: 'fixture-unused', role: 'ADMIN' } }); ids.pengguna.push(admin.id);
  const staff = await db.pengguna.create({ data: { name: tag, email: 'staff-'+tag+'@example.invalid', passwordHash: 'fixture-unused', role: 'STAFF' } }); ids.pengguna.push(staff.id);
  const c = await db.pelanggan.create({ data: { nama: tag+' Lama', nomorTelepon: '081234567891', membership: { create: { memberCode: tag, discountPercent: 10 } } } }); ids.pelanggan.push(c.id);
  const l = await db.layanan.create({ data: { nama: tag+' Potong', harga: 30000, durasiMenit: 30 } }); ids.layanan.push(l.id);
  const l2 = await db.layanan.create({ data: { nama: tag+' Cuci', harga: 10000, durasiMenit: 10 } }); ids.layanan.push(l2.id);
  const barber = await db.barber.create({ data: { nama: tag+' Barber' } }); ids.barber.push(barber.id);
  server = createServer(app); await new Promise(r => server.listen(0,'127.0.0.1',r));
  const base = 'http://127.0.0.1:'+server.address().port, token = jwt.sign({ id: admin.id, role: 'ADMIN' }, process.env.JWT_SECRET);
  const req = async (path, body, auth = token, method = body ? 'POST' : 'GET') => { const r = await fetch(base+path, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer '+auth } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, data: await r.json() }; };
  const payload = (extra={}) => ({ pelanggan: { jenis: 'LAMA', id: c.id }, items: [{layananId:l.id,qty:1,hargaDiharapkan:l.harga}],barberId:null,totalDiharapkan:27000,kunciIdempotensi:randomUUID(),...extra });
  assert.equal((await req('/orders/walk-in',payload(),'')).status,401);
  assert.equal((await req('/orders/walk-in',payload(),jwt.sign({id:admin.id,role:'CUSTOMER'},process.env.JWT_SECRET))).status,401); pass('Tanpa JWT dan JWT CUSTOMER ditolak');
  const count = await db.pelanggan.count(), p = payload({items:[{layananId:l.id,qty:1,hargaDiharapkan:30000},{layananId:l2.id,qty:1,hargaDiharapkan:10000}],totalDiharapkan:36000});
  const concurrent = await Promise.all([req('/orders/walk-in',p),req('/orders/walk-in',p)]);
  assert.deepEqual(concurrent.map(x=>x.status).sort(),[200,201]); assert.equal(concurrent[0].data.data.id,concurrent[1].data.data.id); assert.equal(await db.pelanggan.count(),count); assert.equal(await db.pesanan.count(),1);
  const order = await db.pesanan.findUniqueOrThrow({where:{id:concurrent[0].data.data.id},include:{items:true,pembayaran:true,riwayatStatus:true}});
  assert.equal(order.items.length,2); assert.equal(order.total,36000); assert.equal(order.discountPercent,10); assert.equal(order.status,'WAITING'); assert.equal(order.statusPembayaran,'UNPAID'); assert.equal(order.barberId,null); assert.equal(order.pembayaran,null); assert.equal(order.riwayatStatus.length,1); pass('Dua POST bersamaan satu order multi-layanan, membership resmi, pelanggan lama tidak duplikat, WAITING/UNPAID tanpa DP');
  assert.equal((await req('/orders/walk-in',{...p,totalDiharapkan:1})).data.kode,'IDEMPOTENSI_BERBEDA');
  assert.equal((await req('/orders/walk-in/requests/'+p.kunciIdempotensi)).data.data.id,order.id);
  assert.equal((await req('/orders/walk-in/requests/'+p.kunciIdempotensi,undefined,jwt.sign({id:staff.id,role:'STAFF'},process.env.JWT_SECRET))).status,404); pass('Replay, konflik payload dan recovery GET terikat operator');
  const baru = nama => payload({pelanggan:{jenis:'BARU',nama},totalDiharapkan:30000});
  let r = await req('/orders/walk-in',baru(tag+' Tanpa HP')); assert.equal(r.status,201); const tanpaHp=await db.pesanan.findUniqueOrThrow({where:{id:r.data.data.id},include:{pelanggan:true}}); ids.pelanggan.push(tanpaHp.pelangganId); assert.equal(tanpaHp.pelanggan.nomorTelepon,null);
  r=await req('/orders/walk-in',baru(tag+' Tanpa HP Kedua')); assert.equal(r.status,201); ids.pelanggan.push((await db.pesanan.findUniqueOrThrow({where:{id:r.data.data.id}})).pelangganId);
  r=await req('/orders/walk-in',{...baru(tag+' HP'),pelanggan:{jenis:'BARU',nama:tag+' HP',nomorTelepon:'+62 812-3456-7892'},barberId:barber.id});assert.equal(r.status,201); const denganHp=await db.pesanan.findUniqueOrThrow({where:{id:r.data.data.id},include:{pelanggan:true}});ids.pelanggan.push(denganHp.pelangganId);assert.equal(denganHp.pelanggan.nomorTelepon,'081234567892');assert.equal(denganHp.barberId,barber.id);assert.equal(denganHp.status,'WAITING'); pass('Pelanggan baru HP valid/canonical, dua NULL unik sah, barber opsional atau dipilih tetap Menunggu');
  const before = await db.pelanggan.count();
  for (const body of [{...baru(' ')} ,{...baru(tag),items:[]},{...baru(tag),pelanggan:{jenis:'BARU',nama:tag,nomorTelepon:'salah'}}]) assert.equal((await req('/orders/walk-in',body)).status,400);
  for (const body of [baru(tag+' Harga salah'),{...baru(tag),items:[{layananId:999999,qty:1,hargaDiharapkan:30000}]}]) { if(body.pelanggan.nama.endsWith('Harga salah'))body.totalDiharapkan=1; assert.equal((await req('/orders/walk-in',body)).status,409); }
  assert.equal((await req('/orders/walk-in',{...baru(tag),pelanggan:{jenis:'BARU',nama:tag,nomorTelepon:'+6281234567891'}})).data.kode,'HP_TERPAKAI');
  await db.layanan.update({where:{id:l2.id},data:{aktif:false}});assert.equal((await req('/orders/walk-in',{...baru(tag),items:[{layananId:l2.id,qty:1,hargaDiharapkan:10000}],totalDiharapkan:10000})).status,409);
  await db.layanan.update({where:{id:l2.id},data:{aktif:true}});
  await db.barber.update({where:{id:barber.id},data:{aktif:false}});assert.equal((await req('/orders/walk-in',{...baru(tag),barberId:barber.id})).status,409);await db.barber.update({where:{id:barber.id},data:{aktif:true}});
  assert.equal(await db.pelanggan.count(),before);pass('Nama kosong, HP salah, tanpa layanan, harga berubah, layanan hilang/inaktif, barber inaktif dan HP duplikat ditolak tanpa orphan');
  await db.pelanggan.update({where:{id:c.id},data:{status:'DIBLOKIR'}});assert.equal((await req('/orders/walk-in',payload())).data.kode,'PELANGGAN_DIBLOKIR');await db.pelanggan.update({where:{id:c.id},data:{status:'AKTIF'}});
  assert.equal((await req('/orders/'+tanpaHp.id+'/status',{status:'IN_SERVICE'},token,'PATCH')).status,409);
  assert.equal((await req('/orders/'+denganHp.id+'/status',{status:'IN_SERVICE'},token,'PATCH')).status,200);
  assert.equal((await req('/orders/walk-in',{...baru(tag),barberId:barber.id})).data.kode,'BARBER_SIBUK');
  assert.equal((await req('/orders/'+denganHp.id+'/status',{status:'COMPLETED'},token,'PATCH')).status,200);
  assert.equal((await req('/orders/'+denganHp.id+'/payment',{metode:'CASH',jumlahDiterima:30000})).status,200); pass('Blokir pelanggan, barber wajib sebelum mulai, barber sibuk ditolak; lifecycle dan kasir/invoice resmi berjalan');
  const daftar=await req('/pelanggan');assert.equal(daftar.data.find(x=>x.id===tanpaHp.pelangganId).nomorTelepon,'');
  assert.equal((await req('/orders/'+tanpaHp.id)).data.pelanggan.nomorTelepon,'');
  assert.equal((await req('/barbers')).data.find(x=>x.id===barber.id).nomorTelepon,null);
  assert.equal((await req('/orders', {pelangganId:c.id,items:[{layananId:l.id,qty:1}]})).status,201);
  assert.equal((await req('/orders/walk-in',payload(),jwt.sign({id:staff.id,role:'STAFF'},process.env.JWT_SECRET))).status,201);
  assert.equal((await req('/orders/'+tanpaHp.id+'/status',{status:'IN_SERVICE',barberId:barber.id},token,'PATCH')).status,200);
  assert.equal((await req('/orders/'+tanpaHp.id+'/status',{status:'COMPLETED'},token,'PATCH')).status,200);
  assert.equal((await req('/orders/'+tanpaHp.id+'/payment',{metode:'CASH',jumlahDiterima:30000})).status,200);
  assert.equal((await req('/management/history/WALK_IN/'+tanpaHp.id)).data.nomorTelepon,'');
  const invoices=(await req('/invoices')).data;assert.ok(Array.isArray(invoices));
  assert.equal(invoices.find(i=>i.pesananId===tanpaHp.id).pesanan.pelanggan.nomorTelepon,'');pass('Kontrak DTO Staff tetap string tanpa HP; NULL barber tidak diubah; POST orders legacy tetap berjalan');
  const dashboard=await req('/management/dashboard?jenis=WALK_IN'); assert.equal(dashboard.status,200); assert.ok(dashboard.data.aktivitas.data.some(x=>x.pesananId===tanpaHp.id));assert.equal(dashboard.data.kpi.bookingHariIni,0);assert.equal(await db.booking.count(),0);assert.equal(await db.transaksiPembayaranBooking.count(),0);pass('Dashboard memuat Walk-in nyata tanpa menambah KPI Booking atau ledger booking');
  if(process.env.BB_WALKIN_BROWSER==='1') {
    const requireClient=createRequire(new URL('../../client/package.json',import.meta.url)),{chromium}=requireClient('playwright');browser=await chromium.launch({channel:'chrome',headless:true});
    const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await context.addInitScript(({token,user})=>{localStorage.setItem('barber_token',token);localStorage.setItem('barber_user',JSON.stringify(user));},{token,user:{id:admin.id,name:tag,email:admin.email,role:'ADMIN'}});
    // Seluruh API dialihkan ke HTTP fixture nyata; HTML/CSS/JS tetap Vite source asli.
    let lost=false,posts=0;await page.route('**/api/**',async route=>{const request=route.request(),url=new URL(request.url());const response=await fetch(base+url.pathname.slice(4)+url.search,{method:request.method(),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(request.postData()?{body:request.postData()}: {})}); const body=await response.text();if(url.pathname==='/api/orders/walk-in'&&request.method()==='POST'){posts++;if(lost){lost=false;return route.abort('failed');}}await route.fulfill({status:response.status,contentType:'application/json',body});});
    await page.goto('http://localhost:5173/');await page.getByRole('tab',{name:'Walk-in',exact:true}).click();await page.getByRole('textbox',{name:'Cari aktivitas'}).fill(tag);await page.waitForTimeout(400);
    await page.getByRole('button',{name:'+ Tambah Walk-in',exact:true}).click();const drawer=page.getByRole('dialog',{name:'Tambah Walk-in',exact:true});await drawer.waitFor();assert.equal(new URL(page.url()).pathname,'/');assert.equal(await drawer.getByRole('tab',{name:'Pelanggan Lama'}).getAttribute('aria-selected'),'true');
    const submit=drawer.getByRole('button',{name:'Buat Pesanan',exact:true});assert.equal(await submit.isDisabled(),true);
    await page.locator('#wi-cari').fill('081234567891');await drawer.getByRole('radio').check();await drawer.getByRole('checkbox').first().check();assert.equal(await submit.isEnabled(),true);
    await page.locator('#wi-cari').fill(tag+' Lama');assert.equal(await drawer.getByRole('radio').count(),1);await drawer.getByRole('checkbox').nth(1).check();await drawer.getByRole('button',{name:'Batal',exact:true}).click();await page.getByRole('button',{name:'Lanjutkan mengisi',exact:true}).click();assert.equal(await drawer.isVisible(),true);
    // Harga berubah setelah pilihan ditampilkan: HTTP menolak dan form tidak hilang.
    await db.layanan.update({where:{id:l.id},data:{harga:31000}});await submit.click();await drawer.getByRole('alert').waitFor();assert.equal(await drawer.locator('input[type=radio]:checked').count(),1);assert.equal(await drawer.locator('input[type=checkbox]:checked').count(),2);
    await drawer.locator('.wi-services').getByText(/31.000/).waitFor();await page.getByRole('button',{name:'Tutup Tambah Walk-in',exact:true}).click();await page.getByRole('button',{name:'Buang perubahan',exact:true}).click();
    await page.getByRole('button',{name:'+ Tambah Walk-in',exact:true}).click();await page.locator('#wi-cari').fill(tag+' Lama');await drawer.getByRole('radio').check();await drawer.getByRole('checkbox').first().check();await drawer.getByRole('checkbox').nth(1).check();
    await submit.evaluate(el=>{el.click();el.click();});await drawer.waitFor({state:'detached'});assert.equal(await page.getByRole('tab',{name:'Walk-in',exact:true}).getAttribute('aria-selected'),'true');assert.equal(await page.getByRole('textbox',{name:'Cari aktivitas'}).inputValue(),tag);assert.equal(posts,2);pass('Browser fixture: tombol/drawer tanpa route; pencarian nama/HP, validasi, multi-layanan, dirty confirm, sukses tutup dan state Dashboard/refetch');
    await page.getByRole('button',{name:'+ Tambah Walk-in',exact:true}).click();await drawer.getByRole('tab',{name:'Pelanggan Baru'}).click();await page.locator('#wi-nama').fill(tag+' Browser timeout');await drawer.getByRole('checkbox').first().check();lost=true;await submit.click();await drawer.getByRole('button',{name:'Periksa status',exact:true}).waitFor();
    await page.evaluate(()=>window.dispatchEvent(new Event('auth:logout')));await page.reload();await page.getByRole('button',{name:'+ Tambah Walk-in',exact:true}).click();await drawer.getByRole('button',{name:'Periksa status',exact:true}).waitFor();
    await drawer.getByRole('button',{name:'Periksa status',exact:true}).click();await drawer.waitFor({state:'detached'});assert.equal(posts,3);assert.equal(await db.pelanggan.count({where:{nama:tag+' Browser timeout'}}),1);pass('Browser fixture: respons POST hilang setelah commit; GET memulihkan hasil tanpa POST ulang/duplikasi');
    assert.deepEqual(errors,[]);await context.close();
  }
  console.log(`TOTAL ${n} kelompok PASS; hanya fixture, tidak ada transaksi provider.`);
} catch(e) {console.error('FAIL WALKIN',e.name,e.code??'',e.message?.split('\n').slice(-3).join(' '));process.exitCode=1;}
finally {
  await browser?.close();if(server)await new Promise(r=>server.close(r));
  // Hanya ID pelanggan/operator milik run ini, bukan delete global.
  const pelanggan=await db.pelanggan.findMany({where:{OR:[{id:{in:ids.pelanggan}},{nama:{startsWith:tag}}]},select:{id:true}}),cids=pelanggan.map(x=>x.id);
  const orders=await db.pesanan.findMany({where:{pelangganId:{in:cids}},select:{id:true}}),oids=orders.map(x=>x.id);
  await db.$transaction(async tx=>{await tx.permintaanWalkIn.deleteMany({where:{penggunaId:{in:ids.pengguna}}});await tx.pembayaran.deleteMany({where:{pesananId:{in:oids}}});await tx.pesanan.deleteMany({where:{id:{in:oids}}});await tx.pelanggan.deleteMany({where:{id:{in:cids}}});await tx.pengguna.deleteMany({where:{id:{in:ids.pengguna}}});await tx.barber.deleteMany({where:{id:{in:ids.barber}}});await tx.layanan.deleteMany({where:{id:{in:ids.layanan}}});});
  for(const m of models)assert.equal(await db[m].count(),0);await db.$disconnect();console.log('PASS cleanup seluruh model fixture kosong; tanpa reset.');
}
