import assert from 'node:assert/strict';
import {join} from 'node:path';
import {chromium,expect} from '@playwright/test';

// Sesi operator disediakan runner privat. Tidak membuat akun/fixture atau menulis DB.
const token=process.env.ADMIN_UI_TOKEN,artifacts=process.env.ADMIN_UI_ARTIFACTS;
if(!token)throw Error('ADMIN_UI_TOKEN wajib disediakan secara privat');
const origin='http://localhost:5173';
const browser=await chromium.launch({channel:'chrome',headless:true});
const singkat={WAITING:'Menunggu',PENDING_CONFIRMATION:'Menunggu',AWAITING_DP:'Menunggu DP',CONFIRMED:'Dikonfirmasi',CHECKED_IN:'Check-in',IN_SERVICE:'Dilayani',COMPLETED:'Selesai',CANCELLED:'Dibatalkan',REJECTED:'Ditolak',NO_SHOW:'Tidak hadir'};
let total=0;const pass=label=>console.log(`PASS UI ${++total}: ${label}`);
try{
 const context=await browser.newContext({viewport:{width:1440,height:1100}}),errors=[],writes=[],provider=[];
 context.setDefaultTimeout(15000);
 await context.addInitScript(t=>{localStorage.setItem('barber_token',t)},token);
 await context.route('**/api/**',async route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){writes.push(true);return route.abort()}return route.continue()});
 context.on('request',r=>{if(/(?:api|app)\.sandbox\.midtrans\.com/.test(r.url()))provider.push(true)});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.name));
 const api=async q=>{const r=await context.request.get(origin+'/api/management/orders'+q,{headers:{Authorization:'Bearer '+token}});assert.equal(r.status(),200);return r.json()};
 const today=await api('?periode=HARI_INI&batas=7&ringkasan=true'),all=await api('?periode=SEMUA&batas=50');
 assert.ok(today.data.length,'Data hari ini diperlukan untuk pengujian presentasi');
 assert.equal(new Set(today.data.map(r=>`${r.jenis}:${r.id}`)).size,today.data.length);
 const hari=iso=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
 assert.ok(today.data.every(r=>hari(r.jadwal)===today.hariIni));
 const allToday=all.data.filter(r=>hari(r.jadwal)===today.hariIni);assert.deepEqual(today.data.map(r=>`${r.jenis}:${r.id}`).sort(),allToday.slice(0,7).map(r=>`${r.jenis}:${r.id}`).sort());
 await page.goto(origin);const table=page.getByRole('table',{name:'Pesanan terbaru'});
 await expect(table).toBeVisible();assert.deepEqual(await table.getByRole('columnheader').allTextContents(),['Pelanggan','Jam','Barber','Status']);
 await expect(table.locator('tbody tr')).toHaveCount(today.data.length);assert.ok(!/BKG-|ORD-|INV-/.test(await table.textContent()));
 assert.ok(await table.evaluate(e=>e.scrollWidth<=e.clientWidth));pass('Dashboard empat kolom tanpa kode/pembayaran/check-in, data asli hari ini WIB tanpa duplikasi');
 for(const [i,row]of today.data.entries()){
  const cells=table.locator('tbody tr').nth(i).getByRole('cell');await expect(cells.nth(0)).toContainText(row.pelanggan);await expect(cells.nth(0)).toContainText(row.jenis==='BOOKING'?'Booking':'Walk-in');
  await expect(cells.nth(1)).toHaveText(new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(row.jadwal)));
  await expect(cells.nth(2)).toHaveText(row.barber??'Belum ditentukan');await expect(cells.nth(3)).toHaveText(singkat[row.status]);
 }
 if(artifacts)await page.screenshot({path:join(artifacts,'dashboard-ringkas-desktop.png'),fullPage:true});pass('Nama, jenis, jam WIB, barber dan badge sesuai respons backend');
 const linked=today.data.find(r=>r.bookingId!==null&&r.pesananId!==null);assert.ok(linked,'Booking linked existing diperlukan');
 const index=today.data.findIndex(r=>r.id===linked.id&&r.jenis===linked.jenis);
 await table.locator('tbody tr').nth(index).getByRole('cell').nth(2).click();await expect(page).toHaveURL(origin+'/orders/booking/'+linked.bookingId);
 await expect(page.getByText(linked.nomor,{exact:true})).toBeVisible();
 if(linked.nomorInvoice)await expect(page.getByText('Invoice final: '+linked.nomorInvoice)).toBeVisible();
 pass('Klik baris booking linked membuka detail operasional ID asli, nomor lengkap/invoice tetap tersedia');

 await page.goto(origin+'/orders?periode=SEMUA');await expect(page.getByRole('table',{name:'Daftar pesanan'})).toBeVisible();
 await page.getByLabel('Cari pesanan').fill(linked.nomor);await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page.locator('tbody')).not.toContainText(linked.nomor);await expect(page.locator('tbody')).toContainText(linked.pelanggan);
 const orderNumber=all.data.find(r=>r.nomorPesanan)?.nomorPesanan;assert.ok(orderNumber);await page.getByLabel('Cari pesanan').fill(orderNumber);await expect(page.locator('tbody tr')).toHaveCount(1);
 pass('Pencarian nomor booking dan order tetap berfungsi meskipun kode tidak tampil di daftar');
 await page.getByLabel('Cari pesanan').fill('');await expect(page.getByRole('button',{name:'Berikutnya',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Berikutnya',exact:true}).click();await expect(page).toHaveURL(/halaman=2/);await expect(page.locator('tbody tr')).toHaveCount(all.total-20);
 await page.getByLabel('Jenis pesanan').selectOption('WALK_IN');await expect(page.locator('tbody tr')).toHaveCount(all.data.filter(r=>r.jenis==='WALK_IN').length);
 const walk=all.data.find(r=>r.jenis==='WALK_IN');assert.ok(walk);await page.getByLabel('Cari pesanan').fill(walk.nomor);await expect(page.locator('tbody tr')).toHaveCount(1);await page.locator('tbody tr').getByRole('link',{name:'Detail',exact:true}).click();await expect(page).toHaveURL(new RegExp('[?&]pesananId='+walk.pesananId+'(?:&|$)'));await expect(page.getByRole('heading',{name:'Detail Pesanan',exact:true})).toBeVisible();await expect(page.getByText(walk.nomor,{exact:true}).first()).toBeVisible();await page.keyboard.press('Escape');
 pass('Pagination, filter jenis dan detail walk-in memakai ID order asli');
 await page.goto(origin+'/orders?periode=SEMUA&jenis=BOOKING');const future=all.data.find(r=>hari(r.jadwal)>today.hariIni&&r.jenis==='BOOKING');assert.ok(future);await expect(page.locator('tbody a[href="/orders/booking/'+future.bookingId+'"]').first()).toBeVisible();
 await page.getByLabel('Status pesanan',{exact:true}).selectOption(future.status);await expect(page.locator('tbody a[href="/orders/booking/'+future.bookingId+'"]').first()).toBeVisible();await page.getByLabel('Status pembayaran',{exact:true}).selectOption('PAID');const paid=await api('?periode=SEMUA&jenis=BOOKING&status='+future.status+'&pembayaran=PAID');await expect(page.locator('tbody tr')).toHaveCount(paid.data.length);
 pass('Booking mendatang serta filter status dan pembayaran tetap tersedia');
 await page.goto(origin+'/orders?periode=SEMUA');await expect(page.locator('tbody tr')).toHaveCount(20);assert.ok(!/BKG-|ORD-|INV-/.test(await page.locator('tbody').textContent()));if(artifacts)await page.screenshot({path:join(artifacts,'pesanan-ringkas-desktop.png'),fullPage:true});
 for(const width of [320,375,430,768,1024,1440]){
  await page.setViewportSize({width,height:1050});await page.goto(origin);await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();
  const list=width<768?page.getByRole('list',{name:'Pesanan terbaru'}):page.getByRole('table',{name:'Pesanan terbaru'});await expect(list).toBeVisible();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await list.evaluate(e=>e.scrollWidth<=e.clientWidth));
  if(width===375){if(artifacts)await page.screenshot({path:join(artifacts,'dashboard-ringkas-mobile.png'),fullPage:true});await list.locator('a').first().click();await expect(page).toHaveURL(origin+'/orders/booking/'+today.data[0].bookingId);}
  await page.goto(origin+'/orders?periode=SEMUA');const orders=width<1024?page.getByRole('list',{name:'Daftar pesanan'}):page.getByRole('table',{name:'Daftar pesanan'});await expect(orders).toBeVisible();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await orders.evaluate(e=>e.scrollWidth<=e.clientWidth));if(width===375&&artifacts)await page.screenshot({path:join(artifacts,'pesanan-ringkas-mobile.png'),fullPage:true});
 }
 pass('Dashboard/Pesanan responsif320–1440 tanpa overflow; seluruh kartu mobile membuka detail');
 await page.setViewportSize({width:1440,height:1100});await page.goto(origin+'/history');await expect(page.getByRole('columnheader',{name:'Pesanan / Booking',exact:true})).toBeVisible();await expect(page.getByRole('columnheader',{name:'Check-in',exact:true})).toBeVisible();
 await page.goto(origin+'/invoices');await expect(page.getByRole('heading',{name:'Invoice',exact:true})).toBeVisible();
 assert.equal(errors.length,0);assert.equal(writes.length,0);assert.equal(provider.length,0);pass('Riwayat/Invoice tetap tersedia; nol pageerror, request mutasi API dan request provider');
 console.log(`TOTAL ${total} kelompok UI PASS; backend nyata read-only, tanpa fixture/mock/injeksi data.`);
 await context.close();
}finally{await browser.close();}
