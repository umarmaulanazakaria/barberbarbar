// Audit baca-saja pada aplikasi utama. Login manual wajib; tidak membuat fixture/JWT.
// BB_DASHBOARD_SESSION menunjuk storageState privat di luar repository.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const sesi = process.env.BB_DASHBOARD_SESSION;
if (!sesi) throw new Error("Sediakan BB_DASHBOARD_SESSION dari login manual resmi.");
const keluaran = path.resolve(process.env.BB_DASHBOARD_OUTPUT ?? "../docs/ui/screenshots/dashboard-live");
await fs.mkdir(keluaran, { recursive: true });
const hasil = [];
const lulus = (uji, bukti) => hasil.push({ uji, status: "PASS", bukti });
const tunda = (uji, alasan) => hasil.push({ uji, status: "DEFERRED", alasan });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const konteks = await browser.newContext({ storageState: sesi, viewport: { width: 1440, height: 1000 } });
const halaman = await konteks.newPage();
const galat = [];
halaman.on("pageerror", e => galat.push(e.message));
let terbaru, ringkasan;
halaman.on("response", async r => {
  if (new URL(r.url()).pathname === "/api/management/dashboard" && r.ok()) terbaru = await r.json();
  if (/^\/api\/bookings\/\d+\/payments$/.test(new URL(r.url()).pathname) && r.ok()) ringkasan = (await r.json()).ringkasan;
});
const tunggu = async (syarat, pesan) => {
  for (let i = 0; i < 100; i++) { if (await syarat()) return; await halaman.waitForTimeout(100); }
  throw new Error(pesan);
};
const tab = nama => halaman.getByRole("tab", { name: nama, exact: true });
const input = halaman.getByRole("textbox", { name: "Cari aktivitas" });
const normal = teks => teks.replace(/\s/g, "");
try {
  await halaman.goto("http://localhost:5173/");
  await tab("Booking").waitFor();
  await tunggu(() => !!terbaru, "Tidak menerima respons backend Dashboard asli");
  assert.equal(await tab("Booking").getAttribute("aria-selected"), "true");
  lulus("Login resmi dan Booking default", "Sesi login manual; GET backend asli tanpa mock/intersepsi respons.");
  const awal = terbaru;
  const judul = ["Booking Hari Ini", "Menunggu Check-in", "Sedang Dilayani", "Pembayaran Diterima Hari Ini"];
  assert.deepEqual(await halaman.locator(".stat-top > span:first-child").allTextContents(), judul);
  const nilai = await halaman.locator(".stat-value").allTextContents();
  assert.deepEqual(nilai.slice(0, 3).map(Number), [awal.kpi.bookingHariIni, awal.kpi.menungguCheckIn, awal.kpi.sedangDilayani]);
  assert.equal(normal(nilai[3]), normal(new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(awal.kpi.pembayaranHariIni)));
  assert.equal(await halaman.locator(".df-main-grid > .content-panel").count(), 2);
  assert.equal(await halaman.getByText("Pantau booking, walk-in, dan pekerjaan yang perlu ditangani.", { exact: true }).count(), 1);
  for (const lama of ["Pesanan menunggu", "Selesai, belum lunas", "Aktivitas booking & pesanan", "Pendapatan hari ini", "Ringkasan barbershop"])
    assert.equal(await halaman.getByText(lama, { exact: true }).count(), 0);
  lulus("Empat KPI, dua panel, label dan nominal backend", awal.kpi);
  if (awal.aktivitas.data.length) {
    assert.deepEqual(await halaman.locator(".df-table th").allTextContents(), ["Pelanggan", "Jadwal / Kedatangan", "Status Pelayanan", "Status Pembayaran", "Aksi Detail"]);
    assert.equal(await halaman.locator(".df-table tbody tr").count(), Math.min(awal.aktivitas.total, 10));
    lulus("Lima kolom dan status terpisah", "Jumlah baris sesuai respons backend, maksimal 10.");
  }
  const ukuran = await halaman.evaluate(() => ({ sidebar: document.querySelector(".admin-sidebar").getBoundingClientRect().width, topbar: document.querySelector(".admin-topbar").getBoundingClientRect().height, padding: getComputedStyle(document.querySelector(".admin-content")).padding }));
  assert.equal(ukuran.sidebar, 194); assert.equal(ukuran.topbar, 63);
  lulus("Proporsi desktop", ukuran);
  for (const lebar of [1440, 390]) {
    await halaman.setViewportSize({ width: lebar, height: 1000 });
    if (lebar < 1024) await halaman.waitForFunction(() => document.querySelector(".admin-sidebar").getBoundingClientRect().right <= 0);
    assert.ok(await halaman.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const tinggi = await halaman.locator(".ui-stat").evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
    assert.ok(Math.max(...tinggi) - Math.min(...tinggi) <= 1);
    await halaman.evaluate(() => scrollTo(0, 0));
    await halaman.screenshot({ path: path.join(keluaran, `aktual-${lebar}.png`), fullPage: true, animations: "disabled" });
    lulus(`Visual ${lebar}px`, "Empat kartu seragam; tanpa horizontal overflow; screenshot data backend asli.");
  }
  await halaman.setViewportSize({ width: 1440, height: 1000 });
  if (awal.aktivitas.total > 10) {
    await halaman.getByRole("button", { name: "Lihat semua", exact: true }).click();
    await halaman.getByRole("button", { name: "Berikutnya", exact: true }).click();
    await tunggu(() => terbaru.aktivitas.halaman === 2, "Halaman kedua tidak dimuat");
    assert.equal(new URL(halaman.url()).pathname, "/");
    lulus("Lihat semua dan pagination", "Halaman kedua tetap di Dashboard.");
  } else tunda("Lihat semua dan pagination lintas halaman", `Backend hanya memiliki ${awal.aktivitas.total} booking aktif; tidak menambah data.`);

  await tab("Walk-in").click();
  await tunggu(() => halaman.getByRole("tabpanel").getAttribute("aria-labelledby").then(s => s === "tab-WALK_IN"), "Tab Walk-in tidak aktif");
  await tunggu(() => halaman.getByRole("tabpanel").getAttribute("aria-busy").then(s => s === "false"), "Walk-in masih loading");
  lulus("Tab Walk-in", { halaman: terbaru.aktivitas.halaman, total: terbaru.aktivitas.total });
  await halaman.evaluate(() => scrollTo(0, 0));
  await halaman.screenshot({ path: path.join(keluaran, "aktual-1440-walkin.png"), fullPage: true });
  await tab("Booking").click();
  await tunggu(() => halaman.getByRole("tabpanel").getAttribute("aria-busy").then(s => s === "false"), "Booking masih loading");
  await input.fill("audit-tidak-ditemukan-" + Date.now());
  await halaman.getByText("Tidak ada aktivitas sesuai pencarian.", { exact: true }).waitFor();
  lulus("Pencarian dan kondisi kosong", "Query server nyata tanpa hasil; halaman pertama.");
  await input.fill("");
  await tunggu(() => halaman.getByRole("tabpanel").getAttribute("aria-busy").then(s => s === "false"), "Pencarian belum selesai");
  // React Query dapat memulihkan cache query awal tanpa respons jaringan baru.
  await tunggu(() => halaman.locator(".df-table tbody tr").count().then(n => n === Math.min(awal.aktivitas.total, 10)), "Hasil pencarian belum dipulihkan");

  const kategori = awal.perhatian;
  if (!kategori.length) {
    await halaman.getByText("Tidak ada yang perlu ditangani", { exact: true }).waitFor();
    tunda("Accordion, kategori tunggal dan Lihat lainnya", "Tidak ada masalah aktif dari backend; kategori kosong sengaja tidak ditampilkan.");
  } else {
    for (const k of kategori) {
      const tombol = halaman.getByRole("button", { name: `${k.judul} ${k.total}`, exact: true });
      await tombol.click();
      await halaman.locator(".df-issue-body li").first().waitFor();
      assert.equal(await halaman.locator(".df-issue-body").count(), 1);
      assert.equal(await halaman.locator(".df-issue-body li").count(), Math.min(k.total, 5));
      if (k.total > 5) {
        await halaman.getByRole("button", { name: "Lihat lainnya", exact: true }).click();
        await tunggu(() => halaman.locator(".df-issue-body li").count().then(n => n === Math.min(k.total, 10)), "Lihat lainnya tidak bertambah");
        lulus("Lihat lainnya", "Tambahan maksimal 5 entri backend.");
      }
      lulus(`Accordion ${k.kode}`, "Satu kategori terbuka; maksimal lima entri awal.");
    }
    if (!kategori.some(k => k.total > 5)) tunda("Lihat lainnya", "Tidak ada kategori backend dengan lebih dari lima masalah aktif.");
    await halaman.locator('.df-issue-toggle[aria-expanded="true"]').click();
    assert.equal(await halaman.locator(".df-issue-body").count(), 0);
  }
  const detail = halaman.locator(".df-table tbody a").first();
  if (await detail.count()) {
    await detail.scrollIntoViewIfNeeded();
    const posisi = await halaman.evaluate(() => scrollY);
    await detail.click();
    const drawer = halaman.getByRole("dialog", { name: "Rincian pesanan" });
    await drawer.getByText("Total tagihan", { exact: true }).waitFor();
    assert.equal(await drawer.getByText("Pembayaran diterima", { exact: true }).count(), 1);
    assert.equal(await drawer.getByText("Sisa tagihan", { exact: true }).count(), 1);
    await tunggu(() => !!ringkasan, "Tidak ada ringkasan pembayaran backend");
    const rupiah = n => normal(new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n));
    assert.deepEqual((await drawer.locator(".quick-money dd").allTextContents()).map(normal), [ringkasan.total, ringkasan.jumlahDibayar, ringkasan.balance].map(rupiah));
    await halaman.keyboard.press("Escape");
    await tunggu(() => drawer.count().then(n => n === 0), "Drawer tidak tertutup");
    assert.equal(await halaman.evaluate(() => scrollY), posisi);
    assert.equal(await tab("Booking").getAttribute("aria-selected"), "true");
    assert.equal(await input.inputValue(), "");
    lulus("Drawer dan pemulihan posisi", "Rincian dan tiga nilai finansial backend; Escape mempertahankan tab, pencarian, dan scroll.");
  } else tunda("Drawer", "Tidak ada booking aktif untuk dibuka.");
  // Gagalkan transport GET saja; jangan memalsukan payload/backend. setOffline
  // tidak dipakai karena React Query akan menjeda query saat navigator offline.
  await halaman.route("**/api/management/dashboard?*", r => r.abort("failed"));
  await halaman.getByRole("button", { name: "Perbarui dashboard" }).click();
  await halaman.getByRole("alert").filter({ hasText: "Data belum dapat dipastikan" }).waitFor();
  assert.equal(await halaman.locator(".stat-value").count(), 0);
  await halaman.unroute("**/api/management/dashboard?*");
  await halaman.getByRole("button", { name: /Coba lagi/i }).click();
  await halaman.locator(".stat-value").first().waitFor();
  lulus("Error jaringan dan pemulihan", "Transport GET sengaja digagalkan; tidak memalsukan payload; tidak mengarang nol; pulih dari backend asli.");
  await halaman.route("**/api/management/dashboard?*", async r => {
    await new Promise(selesai => setTimeout(selesai, 750));
    await r.continue();
  });
  await halaman.reload();
  await halaman.getByText("Memuat dashboard…", { exact: true }).waitFor();
  await halaman.locator(".stat-value").first().waitFor();
  await halaman.unroute("**/api/management/dashboard?*");
  lulus("Loading", "GET asli ditunda 750ms tanpa mengubah respons; skeleton tampil lalu data backend.");
  await halaman.getByRole("button", { name: "Perbarui dashboard" }).click();
  await tunggu(() => halaman.getByRole("button", { name: "Perbarui dashboard" }).isEnabled(), "Refetch tidak selesai");
  assert.deepEqual(galat, []);
  lulus("Refresh dan runtime", "Refetch backend berhasil; tidak ada pageerror. Tidak memutasi status/data.");
} catch (galat) {
  hasil.push({ uji: "Eksekusi audit", status: "FAIL", alasan: galat.message });
  throw galat;
} finally {
  await fs.writeFile(path.join(keluaran, "hasil.json"), JSON.stringify({ waktu: new Date().toISOString(), sumber: "http://localhost:5173 → proxy /api → backend utama 3000", hasil }, null, 2));
  await browser.close();
}
console.log(JSON.stringify(hasil, null, 2));
