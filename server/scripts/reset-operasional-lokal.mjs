import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import dotenv from "dotenv";
import { Client } from "pg";

// Destruktif dan khusus development. Tidak dipanggil aplikasi, seed, atau migration.
const server = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = dotenv.parse(fs.readFileSync(path.join(server, ".env")));
if (process.argv.slice(2).sort().join(" ") !== "--admin=1 --konfirmasi=barberbarbar") throw Error("Perlu --konfirmasi=barberbarbar --admin=1. Seluruh data operasional akan dihapus tanpa backup.");
if ([env.NODE_ENV, process.env.NODE_ENV].includes("production")) throw Error("Reset ditolak pada mode production.");
if (process.env.DATABASE_URL && process.env.DATABASE_URL !== env.DATABASE_URL) throw Error("Target environment berbeda dari .env workspace.");
const url = new URL(env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || decodeURIComponent(url.pathname) !== "/barberbarbar") throw Error("Hanya database barberbarbar PostgreSQL lokal yang diizinkan.");
const tabel = ["SesiBookingTamu", "AksesBookingTamu", "InvoiceBooking", "PembayaranOperasional", "PermintaanWalkIn", "PermohonanRefundBooking", "BuktiProviderBooking", "PercobaanSnapBooking", "TransaksiPembayaranBooking", "RiwayatBooking", "UsulanBarberBooking", "ItemBooking", "Booking", "RiwayatStatusPesanan", "ItemPesanan", "Pembayaran", "PenggunaanMembership", "Pesanan", "PenjualanMembership", "AuditPaketMembership", "PermohonanMembership", "PermohonanPengaitanAkun", "PasswordResetToken", "AkunPelanggan", "RiwayatProfilPelanggan", "ProfilPelanggan", "Membership", "Pelanggan", "Layanan", "Barber"];
const kutip = s => '"' + s.replaceAll('"', '""') + '"';
const hash = v => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const db = new Client({ connectionString: env.DATABASE_URL });
let aktif = false;
try {
  await db.connect();
  const target = (await db.query("SELECT current_database() nama,inet_server_addr()::text alamat,inet_server_port() port,current_setting('data_directory') direktori,pg_is_in_recovery() replika")).rows[0];
  if (target.nama !== "barberbarbar" || !["::1/128", "127.0.0.1/32"].includes(target.alamat) || target.port !== 5432 || target.replika || !/^C:[/\\]Program Files[/\\]PostgreSQL[/\\]\d+[/\\]data$/i.test(target.direktori)) throw Error("Identitas server lokal tidak sesuai audit; reset dibatalkan.");
  await db.query("BEGIN"); aktif = true;
  await db.query("SET LOCAL lock_timeout='5s'");
  await db.query("SET LOCAL statement_timeout='30s'");
  const semua = [...tabel, "Pengguna", "PengaturanMembership", "_prisma_migrations"].sort();
  const aktual = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r => r.tablename);
  if (JSON.stringify(aktual) !== JSON.stringify(semua)) throw Error("Inventaris tabel berubah; audit ulang diperlukan.");
  await db.query("LOCK TABLE " + semua.map(t => 'public.' + kutip(t)).join(",") + " IN ACCESS EXCLUSIVE MODE");
  const adminSebelum = (await db.query('SELECT * FROM "Pengguna" WHERE id=1')).rows;
  if (adminSebelum.length !== 1 || adminSebelum[0].role !== "ADMIN" || adminSebelum[0].barberId !== null || adminSebelum[0].name !== "Admin Barber") throw Error("Administrator utama tidak sesuai audit.");
  const sidikAdmin = hash(adminSebelum);
  const migrasi = (await db.query('SELECT * FROM "_prisma_migrations" ORDER BY id')).rows;
  const folder = fs.readdirSync(path.join(server, "prisma/migrations"), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
  if (migrasi.some(m => !m.finished_at || m.rolled_back_at) || JSON.stringify(migrasi.map(m => m.migration_name).sort()) !== JSON.stringify(folder)) throw Error("Status migration tidak sesuai source.");
  const sebelum = [];
  for (const t of tabel) sebelum.push({ tabel: t, jumlah: Number((await db.query("SELECT count(*) n FROM public." + kutip(t))).rows[0].n) });
  // Putuskan hanya mapping konfigurasi yang tidak valid setelah katalog dikosongkan.
  const pengaturan = await db.query('UPDATE "PengaturanMembership" SET harga=550000,"layananGratisId"=NULL,"diubahPada"=CURRENT_TIMESTAMP WHERE id=1');
  if (pengaturan.rowCount !== 1) throw Error("Pengaturan dasar Membership tidak tersedia.");
  for (const t of tabel.filter(t => t !== "Barber")) await db.query("DELETE FROM public." + kutip(t));
  const operator = await db.query('DELETE FROM "Pengguna" WHERE id<>1');
  await db.query('DELETE FROM "Barber"');
  let sequence = 0;
  for (const t of tabel) {
    const nama = (await db.query("SELECT pg_get_serial_sequence($1,'id') nama", ['public.' + kutip(t)])).rows[0].nama;
    if (nama) { await db.query("ALTER SEQUENCE " + nama + " RESTART WITH 1"); sequence++; }
  }
  const sesudah = [];
  for (const t of tabel) sesudah.push({ tabel: t, jumlah: Number((await db.query("SELECT count(*) n FROM public." + kutip(t))).rows[0].n) });
  if (sesudah.some(t => t.jumlah !== 0)) throw Error("Masih ada data operasional; transaksi dibatalkan.");
  if (hash((await db.query('SELECT * FROM "Pengguna" ORDER BY id')).rows) !== sidikAdmin || hash((await db.query('SELECT * FROM "_prisma_migrations" ORDER BY id')).rows) !== hash(migrasi)) throw Error("Administrator atau metadata migration berubah.");
  const paket = (await db.query('SELECT harga,"layananGratisId" FROM "PengaturanMembership" WHERE id=1')).rows[0];
  if (paket.harga !== 550000 || paket.layananGratisId !== null) throw Error("Pengaturan Membership tidak sesuai hasil reset.");
  // Realtime hanya meminta klien membaca ulang; tidak memalsukan pembayaran.
  for (const jenis of ["catalog.changed", "customer.changed", "membership.changed", "order.changed", "payment.changed"]) await db.query("SELECT pg_notify('barberbarbar_realtime',$1)", [JSON.stringify({ jenis, id: 1, aksi: "DEVELOPMENT_DATA_CLEARED", operator: "ALL", versi: Date.now().toString(), waktu: new Date().toISOString(), refetch: true })]);
  await db.query("COMMIT"); aktif = false;
  const verifikasi = [];
  for (const t of tabel) verifikasi.push({ tabel: t, jumlah: Number((await db.query("SELECT count(*) n FROM public." + kutip(t))).rows[0].n) });
  console.log(JSON.stringify({ target: { database: target.nama, alamat: target.alamat, port: target.port }, tabelDibersihkan: tabel.length, recordDihapus: sebelum.reduce((n, t) => n + t.jumlah, 0) + operator.rowCount, operatorDihapus: operator.rowCount, sequenceDireset: sequence, adminUtama: "ID 1 utuh, termasuk hash login", migrationDipertahankan: migrasi.length, membership: paket, verifikasi }, null, 2));
  if (verifikasi.some(t => t.jumlah !== 0)) throw Error("Ada penulisan baru setelah COMMIT; jangan mengulang reset otomatis.");
} catch (e) {
  if (aktif) await db.query("ROLLBACK");
  console.error(e instanceof Error ? e.message : "Reset gagal.");
  process.exitCode = 1;
} finally { await db.end(); }
