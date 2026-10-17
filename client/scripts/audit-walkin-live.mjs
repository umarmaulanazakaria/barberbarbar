// Aplikasi utama, sesi login manual, GET saja. Tidak mengirim form/customer dummy.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
if(!process.env.BB_WALKIN_SESSION)throw Error('Sesi login manual wajib');
const out=path.resolve(process.env.BB_WALKIN_OUTPUT??'../docs/ui/screenshots/tambah-walkin');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({storageState:process.env.BB_WALKIN_SESSION}),page=await context.newPage(),hasil=[],galat=[];
page.on('pageerror',e=>galat.push(e.message));
await page.route('**/api/**',route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))return route.abort('blockedbyclient');return route.continue();});
const shot=async name=>page.screenshot({path:path.join(out,name+'.png'),fullPage:!await page.locator(".wi-drawer").count(),style:".wi-phone{color:transparent!important;text-shadow:none!important}"});
const close=async()=>{await page.getByRole('button',{name:'Tutup Tambah Walk-in',exact:true}).click();const buang=page.getByRole('button',{name:'Buang perubahan',exact:true});if(await buang.isVisible())await buang.click();await page.locator('.wi-drawer').waitFor({state:'detached'});};
try{
for(const width of [320,375,390,768,1024,1280,1440,1920]){
 await page.setViewportSize({width,height:width<768?844:1000});await page.goto('http://localhost:5173/');await page.locator('.stat-grid').waitFor();
 assert.equal(await page.locator('.stat-grid .ui-stat').count(),4);await page.getByRole('button',{name:'+ Tambah Walk-in',exact:true}).waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Dashboard overflow '+width);await shot(`${width}-dashboard`);
 await page.getByRole('button',{name:'+ Tambah Walk-in',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Tambah Walk-in',exact:true});await dialog.waitFor();await dialog.getByRole('checkbox').first().waitFor();
 assert.equal(new URL(page.url()).pathname,'/');assert.equal(await dialog.getByRole('tab',{name:'Pelanggan Lama'}).getAttribute('aria-selected'),'true');
 const box=await dialog.boundingBox();assert.equal(Math.round(box.width),Math.min(465,width));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await shot(`${width}-drawer-lama`);
 if(width===1440){const nama=await dialog.locator('.wi-customer-list strong').first().textContent();await page.locator('#wi-cari').fill(nama);await dialog.getByRole('radio').first().check();await shot('1440-pencarian-pelanggan');await page.locator('#wi-cari').fill('');}
 await dialog.getByRole('tab',{name:'Pelanggan Baru'}).click();await shot(`${width}-drawer-baru`);
 await dialog.getByRole('checkbox').first().check();if(await dialog.getByRole('checkbox').count()>1)await dialog.getByRole('checkbox').nth(1).check();
 await page.locator('.wi-body').evaluate(el=>{el.scrollTop=el.scrollHeight;});const footer=await page.locator('.wi-footer').boundingBox();assert.ok(footer&&footer.y+footer.height<=(width<768?844:1000)+1);assert.ok(footer.y>=0);await shot(`${width}-ringkasan-footer`);
 assert.equal(await dialog.getByRole('button',{name:'Buat Pesanan',exact:true}).isDisabled(),true);await close();
 hasil.push({width,status:'PASS',bukti:'Dashboard 4 KPI, drawer kanan tanpa route, pelanggan lama/baru, multi-layanan, footer tetap, tanpa overflow atau POST.'});
}
const statut=await page.evaluate(async()=>{const r=await fetch('/api/orders/walk-in/requests/'+crypto.randomUUID(),{headers:{Authorization:'Bearer '+localStorage.getItem('barber_token')}});return {status:r.status,cache:r.headers.get('cache-control'),data:await r.json()};});
assert.equal(statut.status,404);assert.equal(statut.cache,'no-store');assert.match(statut.data.pesan,/Belum ada konfirmasi/);
assert.deepEqual(galat,[]);console.log(JSON.stringify({status:'PASS',viewports:hasil.length,screenshots:33,readOnly:true}));
await fs.writeFile(path.join(out,'hasil.json'),JSON.stringify({hasil,galat,catatan:'Backend utama asli, login manual, tidak submit. Nomor HP dimask. Tanpa gambar referensi sehingga bukan pixel-perfect.'},null,2));
}finally{await context.close();await browser.close();}
