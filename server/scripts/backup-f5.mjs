import "dotenv/config";
import { akarCadangan } from "./lokasi-cadangan.mjs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const { default: db } = await import("../dist/lib/prisma.js");
const model = ["pelanggan", "akunPelanggan", "pengguna", "barber", "layanan", "membership",
  "pesanan", "itemPesanan", "pembayaran", "riwayatStatusPesanan", "passwordResetToken", "permohonanPengaitanAkun", "permohonanMembership", "booking", "itemBooking"];
const sidik = async transaksi => {
  const hasil = {};
  for (const nama of model) hasil[nama] = createHash("sha256").update(JSON.stringify(await transaksi[nama].findMany({ orderBy: { id: "asc" } }))).digest("hex");
  return hasil;
};
const jalankan = (program, args, env = process.env, buang = false) => {
  const hasil = spawnSync(program, args, { env, windowsHide: true, encoding: "utf8",
    stdio: ["ignore", buang ? "ignore" : "pipe", "pipe"], maxBuffer: 4 * 1024 * 1024 });
  if (hasil.error || hasil.status !== 0) throw new Error("Tool backup/verifikasi gagal");
  return hasil.stdout ?? "";
};
try {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Backup otomatis hanya database lokal");
  const sebelum = await db.$transaction(sidik, { isolationLevel: "RepeatableRead" });
  const folder = resolve(akarCadangan, `f5-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  await mkdir(akarCadangan, { recursive: true });
  await mkdir(folder, { recursive: false });
  const arsip = resolve(folder, "database.dump");
  jalankan("pg_dump", ["--format=custom", "--no-password", "--file", arsip], {
    ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
  });
  const daftar = jalankan("pg_restore", ["--list", arsip]);
  assert.ok(daftar.includes("TABLE DATA public Membership "));
  jalankan("pg_restore", ["--file=-", arsip], process.env, true);
  const berkas = await readFile(arsip);
  assert.ok(berkas.length > 0);
  assert.deepEqual(await db.$transaction(sidik, { isolationLevel: "RepeatableRead" }), sebelum);
  const manifest = { dibuatPada: new Date().toISOString(), arsip, ukuran: berkas.length,
    sha256: createHash("sha256").update(berkas).digest("hex"), terverifikasi: true, sidikExisting: sebelum };
  await writeFile(resolve(folder, "manifest.json"), JSON.stringify(manifest, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ folder, ukuran: manifest.ukuran, sha256: manifest.sha256, terverifikasi: true }));
} catch (error) { console.error(`FAIL backup F5 (${error.name}); credential tidak dicetak.`); process.exitCode = 1; }
finally { await db.$disconnect(); }
