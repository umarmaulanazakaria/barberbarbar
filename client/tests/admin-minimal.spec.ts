import { test,expect } from "@playwright/test";
import { siapkanAdmin, pelanggan, barber, layanan } from "./fixtures/admin";
const env=(globalThis as typeof globalThis & {process?:{env:Record<string,string|undefined>}}).process?.env??{};
const halaman=[['dashboard','/'],['pesanan','/orders'],['pelanggan','/customers'],['membership','/membership'],['barber','/barbers'],['layanan','/services'],['riwayat','/history'],['invoice','/invoices'],['laporan','/reports'],['pengaturan','/settings'],['detail-booking','/orders/booking/1']] as const;
test("Screenshot seluruh modul Admin",async({page})=>{
  await siapkanAdmin(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [1440,1024,390,320]){await page.setViewportSize({width,height:960});for(const [nama,jalur]of halaman){await page.goto(jalur);await expect(page.locator('main h1')).toBeVisible();await expect(page.getByText('Memuat data...', {exact:true})).toHaveCount(0);await page.waitForTimeout(120);if(env.BB_ADMIN_SCREENSHOTS)await page.screenshot({animations:"disabled",path:env.BB_ADMIN_SCREENSHOTS+`/${env.BB_ADMIN_PHASE??'after'}-${width}-${nama}.png`,fullPage:true});}}
  expect(errors).toEqual([]);
});

for(const width of [320,375,390,768,1024,1280,1440,1920])test(`Seluruh modul responsif ${width}px`,async({page})=>{
 await siapkanAdmin(page);await page.setViewportSize({width,height:900});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [,jalur] of halaman){await page.goto(jalur);await expect(page.locator('main h1')).toBeVisible();await page.waitForLoadState('networkidle');await expect(page.locator('.ui-loading')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),jalur).toBe(true);}
 expect(errors).toEqual([]);
});
test("Navigasi drawer, keyboard, pemulihan fokus dan logout",async({page})=>{
 await siapkanAdmin(page);await page.setViewportSize({width:390,height:844});await page.goto('/');const buka=page.getByRole('button',{name:'Buka menu',exact:true});await buka.click();
 const drawer=page.getByRole('dialog',{name:'Navigasi manajemen'});await expect(drawer).toBeVisible();await expect(page.getByRole('button',{name:'Tutup menu',exact:true})).toBeFocused();
 await page.keyboard.press('Shift+Tab');await expect(page.getByRole('button',{name:'Keluar dari akun'})).toBeFocused();await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Tutup menu',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');await expect(buka).toBeFocused();await expect(drawer).toHaveCount(0);await buka.click();await page.getByRole('link',{name:'Layanan',exact:true}).click();await expect(page).toHaveURL(/services$/);await expect(buka).toHaveAttribute('aria-expanded','false');
 await buka.click();await page.getByRole('button',{name:'Keluar dari akun'}).click();await expect(page).toHaveURL(/login$/);
});
test("Refund tidak ada di menu, URL lama tidak membuka workflow",async({page})=>{
 await siapkanAdmin(page);let calls=0;page.on('request',r=>{if(r.url().includes('refund-requests'))calls++;});await page.goto('/refunds');await expect(page).toHaveURL(/\/$/);await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:/Pengembalian Dana|Refund/i})).toHaveCount(0);expect(calls).toBe(0);
});
test("STAFF tetap membaca modul dan tidak memperoleh aksi ADMIN",async({page})=>{
 await siapkanAdmin(page,'STAFF');await page.goto('/services');await expect(page.getByRole('button',{name:/Tambah Layanan/})).toHaveCount(0);await expect(page.getByRole('link',{name:'Pengaturan',exact:true})).toHaveCount(0);await page.getByRole('cell',{name:'Haircut & Styling',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog.getByLabel('Nama Layanan',{exact:true})).toBeDisabled();await expect(dialog.getByRole('button',{name:'Simpan Layanan'})).toHaveCount(0);
});
test("Layanan: pencarian, validasi, modal keyboard dan simpan MOCK",async({page})=>{
 const s=await siapkanAdmin(page);await page.setViewportSize({width:320,height:700});await page.goto('/services');const cari=page.getByRole('textbox',{name:/Cari nama, durasi/});await cari.fill('tidakada');await expect(page.getByText(/Tidak ada layanan yang sesuai/)).toBeVisible();await cari.fill('');await page.getByRole('button',{name:/Tambah Layanan/}).click();
 const dialog=page.getByRole('dialog',{name:'Tambah Layanan'});await expect(dialog.getByLabel('Nama Layanan',{exact:true})).toBeFocused();await expect(dialog.getByRole('button',{name:'Simpan Layanan'})).toBeDisabled();
 await dialog.getByLabel('Nama Layanan',{exact:true}).fill('Layanan baru uji');await dialog.getByLabel('Durasi (menit)',{exact:true}).fill('45');await dialog.getByLabel('Harga',{exact:true}).fill('75000');
 const ukuran=await dialog.boundingBox();expect(ukuran!.x).toBeGreaterThanOrEqual(0);expect(ukuran!.x+ukuran!.width).toBeLessThanOrEqual(320);await page.keyboard.press('Shift+Tab');expect(await dialog.evaluate(e=>e.contains(document.activeElement))).toBe(true);
 await dialog.getByRole('button',{name:'Simpan Layanan'}).click();await expect(dialog).toHaveCount(0);expect(s.mutasi).toContainEqual({path:'/layanan',body:{nama:'Layanan baru uji',durasiMenit:45,harga:75000,aktif:true}});
});
test("Barber dan pelanggan: modal form, filter, fokus kembali",async({page})=>{
 await siapkanAdmin(page);await page.goto('/barbers');await page.getByRole('button',{name:/Tambah Barber/}).click();let dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Nama',{exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:/Tambah Barber/})).toBeFocused();
 await page.goto('/customers');await page.getByRole('button',{name:/Tambah Pelanggan/}).click();dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Nama',{exact:true})).toBeVisible();await expect(dialog.getByLabel('Telepon',{exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
});
test("Pesanan: filter REST, detail booking dan pemisahan status pembayaran",async({page})=>{
 await siapkanAdmin(page);const urls:string[]=[];page.on('request',r=>{if(r.url().includes('/management/orders'))urls.push(r.url());});await page.goto('/orders');await page.getByLabel('Cari pesanan',{exact:true}).fill('Ardi');await page.getByLabel('Jenis pesanan',{exact:true}).selectOption('BOOKING');await page.getByLabel('Tanggal pesanan',{exact:true}).selectOption('SEMUA');
 await expect.poll(()=>urls.some(u=>u.includes('jenis=BOOKING')&&u.includes('Ardi'))).toBe(true);await page.getByRole('link',{name:'Rincian Ardi Pratama',exact:true}).first().click();const drawer=page.getByRole('dialog',{name:'Rincian pesanan'});await expect(drawer).toBeVisible();await expect(drawer).toContainText('Uang Muka Terverifikasi');await expect(drawer).toContainText('50.000');await expect(page).toHaveURL(/cari=Ardi/);await drawer.getByRole('link',{name:'Kelola booking'}).click();await expect(page).toHaveURL(/orders\/booking\/1$/);await expect(page.getByRole('heading',{name:'Detail Booking',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Tolak booking'})).toHaveCount(0);
});
test("Invoice: detail dan cetak tetap memakai invoice yang lunas",async({page})=>{
 await siapkanAdmin(page);await page.addInitScript(()=>{window.print=()=>{};});await page.goto('/invoices');await page.getByRole('cell',{name:'INV-UI-001',exact:true}).click();await expect(page.getByRole('dialog',{name:'Detail Pesanan'})).toBeVisible();await page.getByRole('button',{name:'Cetak Invoice',exact:true}).click();await page.emulateMedia({media:'print'});await expect(page.locator('.invoice-print')).toBeVisible();await expect(page.locator('.invoice-print')).toContainText('INV-UI-001');await expect(page.locator('.invoice-print')).toContainText('100.000');
});
test("Empty dan error state Dashboard/Laporan tidak membuat metrik palsu",async({page})=>{
 const s=await siapkanAdmin(page);s.kosong=true;await page.goto('/');await expect(page.getByText('Tidak ada aktivitas sesuai pencarian.').first()).toBeVisible();await expect(page.locator('.stat-value')).toHaveText(['0','0','0','Rp 0']);s.error=true;await page.goto('/reports');await expect(page.getByRole('alert')).toContainText('Laporan belum dapat dimuat');await expect(page.locator('svg[aria-label="Grafik pendapatan harian"]')).toHaveCount(0);
});
test("Nama panjang dan nominal Rupiah besar tetap dapat dibaca",async({page})=>{
 const lama=[pelanggan.nama,barber.nama,layanan.nama],hargaLama=layanan.harga;
 try{pelanggan.nama='NamaPelangganSangatPanjangTanpaSpasi'.repeat(8);barber.nama='NamaBarberPanjang'.repeat(8);layanan.nama='PerawatanRambutSangatPanjang'.repeat(8);layanan.harga=2147000000;await siapkanAdmin(page);
 for(const width of [320,390,1024,1440])for(const route of ['/customers','/barbers','/services','/membership','/orders/booking/1']){await page.setViewportSize({width,height:900});await page.goto(route);await page.waitForLoadState('networkidle');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route).toBe(true);}
 }finally{[pelanggan.nama,barber.nama,layanan.nama]=lama;layanan.harga=hargaLama;}
});
test("Kontras token teks utama, tombol dan badge memenuhi AA normal",async({page})=>{
 await siapkanAdmin(page);await page.goto('/');await expect(page.locator('.ui-status').first()).toBeVisible();
 const warna=await page.evaluate(()=>{const style=(s:string)=>getComputedStyle(document.querySelector(s)!);const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d")!;const rgb=(value:string)=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return `rgb(${Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3).join(",")})`;};return [[style('.df-activity-toolbar [aria-selected=true]').color,style('.df-activity-toolbar [aria-selected=true]').backgroundColor],[style('.ui-status').color,style('.ui-status').backgroundColor],[style('.df-header p').color,style('.admin-shell').backgroundColor],[style('.ui-stat').color,style('.ui-stat').backgroundColor]].map(pair=>pair.map(rgb));});
 const luminan=(s:string)=>{const rgb=s.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
 for(const[a,b]of warna){const x=luminan(a),y=luminan(b);expect((Math.max(x,y)+.05)/(Math.min(x,y)+.05),JSON.stringify({warna,a,b})).toBeGreaterThanOrEqual(4.5);}
});
test("Membership dan pengaturan: dropdown keyboard serta validasi konfirmasi akun",async({page})=>{
 const s=await siapkanAdmin(page);await page.goto('/membership');await page.getByRole('button',{name:/Tambah Membership/}).click();let dialog=page.getByRole('dialog');const pilih=dialog.getByRole('combobox',{name:'Pilih pelanggan membership'});await expect(pilih).toBeFocused();await page.keyboard.press('Enter');await page.getByRole('textbox',{name:'Cari nama atau nomor telepon pelanggan...'}).fill('Ardi');await page.keyboard.press('Enter');await expect(pilih).toContainText('Ardi Pratama');await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 await page.goto('/settings');await page.getByRole('button',{name:'Buat Akun',exact:true}).click();dialog=page.getByRole('dialog',{name:'Buat Akun Staf'});await dialog.getByLabel('Email',{exact:true}).fill('staff-fixture@example.invalid');await dialog.getByLabel('Kata Sandi',{exact:true}).fill('fixture-password-only');await dialog.getByLabel('Konfirmasi Kata Sandi',{exact:true}).fill('fixture-password-beda');await expect(dialog.getByRole('alert')).toContainText('belum sesuai');await expect(dialog.getByRole('button',{name:'Buat Akun Staf',exact:true})).toBeDisabled();await dialog.getByLabel('Konfirmasi Kata Sandi',{exact:true}).fill('fixture-password-only');await expect(dialog.getByRole('button',{name:'Buat Akun Staf',exact:true})).toBeEnabled();await page.keyboard.press('Escape');expect(s.mutasi).toHaveLength(0);
});
test("Kasir: konfirmasi bertingkat dan payload pembayaran legacy MOCK",async({page})=>{
 const s=await siapkanAdmin(page);Object.assign(s.pesanan,{statusPembayaran:'UNPAID',pembayaran:null});await page.goto('/orders?pesananId=1');const detail=page.getByRole('dialog',{name:'Detail Pesanan'});await expect(detail).toBeVisible();await detail.getByRole('button',{name:'Buka Pembayaran',exact:true}).click();const bayar=page.getByRole('dialog',{name:'Pembayaran pesanan'});await expect(bayar).toBeVisible();await bayar.getByLabel('Jumlah Diterima',{exact:true}).fill('100000');await bayar.getByRole('button',{name:'Simpan Pembayaran',exact:true}).click();let konfirmasi=page.getByRole('dialog',{name:'Konfirmasi Pembayaran?'});await expect(konfirmasi).toBeVisible();await page.keyboard.press('Escape');await expect(konfirmasi).toHaveCount(0);await expect(bayar).toBeVisible();expect(s.mutasi).toHaveLength(0);await bayar.getByRole('button',{name:'Simpan Pembayaran',exact:true}).click();konfirmasi=page.getByRole('dialog',{name:'Konfirmasi Pembayaran?'});await konfirmasi.getByRole('button',{name:'Simpan Pembayaran',exact:true}).click();await expect.poll(()=>s.mutasi.length).toBe(1);expect(s.mutasi[0]).toEqual({path:'/orders/1/payment',body:{metode:'CASH',jumlahDiterima:100000}});
});
test("Screenshot dialog utama",async({page})=>{
 await siapkanAdmin(page);for(const width of [1440,1024,390,320]){await page.setViewportSize({width,height:960});for(const [jalur,tombol,nama]of [['/services','Tambah Layanan','layanan'],['/membership','Tambah Membership','membership'],['/settings','Buat Akun','akun-staf']]){await page.goto(jalur);await page.getByRole('button',{name:new RegExp(tombol)}).first().click();await expect(page.getByRole('dialog')).toBeVisible();await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(env.BB_ADMIN_SCREENSHOTS)await page.screenshot({animations:"disabled",path:env.BB_ADMIN_SCREENSHOTS+`/after-${width}-dialog-${nama}.png`,fullPage:true});}}
});

test("Drawer rincian: delapan lebar, fokus, Escape, konteks filter dan data resmi",async({page})=>{
 await siapkanAdmin(page);
 for(const width of [320,375,390,768,1024,1280,1440,1920]){
  await page.setViewportSize({width,height:900});await page.goto('/orders?jenis=BOOKING&cari=Ardi');
  const trigger=width<768?page.locator('.order-mobile-item').first():page.locator('.order-primary').first();await trigger.click();
  const drawer=page.getByRole('dialog',{name:'Rincian pesanan'});await expect(drawer).toBeVisible();await expect(drawer.getByRole('heading',{name:'BKG-UI-001'})).toBeVisible();await expect(drawer).toContainText('081234567890');await expect(drawer).toContainText('Haircut & Styling');await expect(drawer).toContainText('50.000');
  await expect(page.locator('.admin-shell')).toHaveAttribute('inert','');await expect(drawer.getByRole('button',{name:'Tutup rincian pesanan'})).toBeFocused();
  await page.keyboard.press('Shift+Tab');await expect(drawer.getByRole('link',{name:'Kelola booking'})).toBeFocused();await page.keyboard.press('Tab');await expect(drawer.getByRole('button',{name:'Tutup rincian pesanan'})).toBeFocused();
  const box=await drawer.boundingBox();expect(box!.width).toBeLessThanOrEqual(width);if(width>=768)expect(box!.width).toBe(450);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(env.BB_ADMIN_SCREENSHOTS&&[1440,390].includes(width))await page.screenshot({animations:"disabled",path:env.BB_ADMIN_SCREENSHOTS+`/after-${width}-drawer-booking.png`});
  await page.keyboard.press('Escape');await expect(drawer).toHaveCount(0);await expect(trigger).toBeFocused();await expect(page).toHaveURL('/orders?jenis=BOOKING&cari=Ardi');await expect(page.locator('.admin-shell')).not.toHaveAttribute('inert');
 }
});

test("Drawer: gangguan pembayaran tidak menampilkan kredit palsu",async({page})=>{
 await siapkanAdmin(page);await page.route('**/api/bookings/1/payments',r=>r.fulfill({status:503,json:{pesan:'Indisponible fixture'}}));await page.goto('/orders?rincianBooking=1');const drawer=page.getByRole('dialog',{name:'Rincian pesanan'});await expect(drawer.getByRole('alert')).toContainText('Status pembayaran belum dapat dipastikan');await expect(drawer.getByText('Pembayaran diterima',{exact:true})).toHaveCount(0);await expect(drawer).toContainText('Haircut & Styling');
});

test("Walk-in: drawer ringkas menuju kasir dan invoice cetak",async({page})=>{
 await siapkanAdmin(page);await page.addInitScript(()=>{window.print=()=>{};});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:960});await page.goto('/orders?rincianPesanan=1');let drawer=page.getByRole('dialog',{name:'Rincian pesanan'});await expect(drawer).toContainText('ORD-UI-001');await expect(drawer).toContainText('Pembayaran Berhasil');
  if(env.BB_ADMIN_SCREENSHOTS)await page.screenshot({animations:"disabled",path:env.BB_ADMIN_SCREENSHOTS+`/after-${width}-drawer-walk-in.png`});
  await drawer.getByRole('link',{name:'Detail & tindakan'}).click();await expect(drawer).toHaveCount(0);const detail=page.getByRole('dialog',{name:'Detail Pesanan'});await expect(detail).toBeVisible();
  if(env.BB_ADMIN_SCREENSHOTS)await page.screenshot({animations:"disabled",path:env.BB_ADMIN_SCREENSHOTS+`/after-${width}-detail-invoice.png`,fullPage:true});
  await detail.getByRole('button',{name:'Cetak Invoice',exact:true}).click();await page.emulateMedia({media:'print'});await expect(page.locator('.invoice-print')).toContainText('INV-UI-001');if(env.BB_ADMIN_SCREENSHOTS)await page.screenshot({animations:"disabled",path:env.BB_ADMIN_SCREENSHOTS+`/after-${width}-invoice-cetak.png`,fullPage:true});await page.emulateMedia({media:'screen'});
 }
});

test("Screenshot pembayaran kasir desktop dan mobile",async({page})=>{
 const s=await siapkanAdmin(page);Object.assign(s.pesanan,{statusPembayaran:'UNPAID',pembayaran:null});
 for(const width of [1440,390]){await page.setViewportSize({width,height:960});await page.goto('/orders?pesananId=1');await page.getByRole('button',{name:'Buka Pembayaran',exact:true}).click();const panel=page.getByRole('dialog',{name:'Pembayaran pesanan'});await expect(panel).toBeVisible();const simpan=panel.getByRole('button',{name:'Simpan Pembayaran',exact:true});await simpan.scrollIntoViewIfNeeded();const rect=await simpan.boundingBox(),batas=await panel.boundingBox();expect(rect!.y+rect!.height).toBeLessThanOrEqual(batas!.y+batas!.height);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(env.BB_ADMIN_SCREENSHOTS)await page.screenshot({animations:"disabled",path:env.BB_ADMIN_SCREENSHOTS+`/after-${width}-pembayaran.png`,fullPage:true});}
});

test("Drawer booking memakai layanan aktual setelah pelayanan berubah",async({page})=>{const s=await siapkanAdmin(page);s.booking.pesananId=1;s.booking.status="COMPLETED";s.pesanan.items[0].namaLayanan="Layanan aktual tersimpan";s.pesanan.items[0].qty=1;s.pesanan.items[0].subtotal=50000;await page.goto("/orders?rincianBooking=1");const drawer=page.getByRole("dialog",{name:"Rincian pesanan"});await expect(drawer).toContainText("Layanan aktual tersimpan");await expect(drawer.getByRole("heading",{name:"Layanan aktual",exact:true})).toBeVisible();await expect(drawer).not.toContainText("Haircut & Styling");});
