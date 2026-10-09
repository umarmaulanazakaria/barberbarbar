import "dotenv/config";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { ambilSnapshot, pastikanAman } from "./util-audit-hash-permohonan.mjs";

const { default: db } = await import("../dist/lib/prisma.js");
const jalankan = (program, argumen, lingkungan = process.env, buangOutput = false) => {
  const hasil = spawnSync(program, argumen, {
    env: lingkungan, windowsHide: true, encoding: "utf8",
    stdio: ["ignore", buangOutput ? "ignore" : "pipe", "pipe"], maxBuffer: 4 * 1024 * 1024,
  });
  if (hasil.error || hasil.status !== 0) throw new Error(`${program} gagal; credential tidak dicetak`);
  return hasil.stdout ?? "";
};
try {
  const koneksi = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(koneksi.hostname)) {
    throw new Error("Backup F2 ini dibatasi pada database lokal");
  }
  const sebelum = await db.$transaction(ambilSnapshot, { isolationLevel: "RepeatableRead" });
  pastikanAman(sebelum);
  const waktu = new Date().toISOString().replace(/[:.]/g, "-");
  // Di luar repository agar arsip berisi data sensitif tidak masuk Git.
  const induk = resolve(fileURLToPath(new URL("../../../", import.meta.url)), "backup-database");
  const direktori = join(induk, `f2-hash-${waktu}`);
  await mkdir(direktori, { recursive: false });
  const lokasi = join(direktori, "database.dump");
  const namaDatabase = decodeURIComponent(koneksi.pathname.slice(1));
  const lingkungan = {
    ...process.env, PGHOST: koneksi.hostname, PGPORT: koneksi.port || "5432",
    PGDATABASE: namaDatabase, PGUSER: decodeURIComponent(koneksi.username),
    PGPASSWORD: decodeURIComponent(koneksi.password),
  };
  // Password hanya lewat environment child process, bukan argumen/log.
  jalankan("pg_dump", ["--format=custom", "--no-password", "--file", lokasi], lingkungan);
  const ukuran = (await stat(lokasi)).size;
  assert.ok(ukuran > 0);
  const daftar = jalankan("pg_restore", ["--list", lokasi]);
  for (const tabel of ["PermohonanPengaitanAkun", "AkunPelanggan", "Pelanggan", "Pengguna"]) {
    assert.ok(daftar.split(/\r?\n/).some(baris => baris.includes(`TABLE DATA public ${tabel} `)));
  }
  // Baca/dekompresi seluruh arsip menjadi SQL ke stdout yang dibuang.
  // Tidak ada koneksi restore dan tidak ada SQL yang dieksekusi.
  jalankan("pg_restore", ["--file=-", lokasi], process.env, true);
  const sha256 = createHash("sha256").update(await readFile(lokasi)).digest("hex");
  const sesudah = await db.$transaction(ambilSnapshot, { isolationLevel: "RepeatableRead" });
  assert.deepEqual(sesudah, sebelum, "Data terkait berubah saat backup; lakukan persiapan ulang");
  const rencana = {
    versi: 1, dibuatPada: new Date().toISOString(),
    backup: { lokasi, ukuran, sha256, terverifikasi: true,
      metode: "pg_dump custom; pg_restore --list; pembacaan seluruh arsip tanpa restore" },
    snapshot: sebelum,
  };
  const fileRencana = join(direktori, "rencana-pembersihan.json");
  await writeFile(fileRencana, JSON.stringify(rencana, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ backup: rencana.backup, rencana: fileRencana, target: sebelum.terdampak }, null, 2));
} catch (kesalahan) {
  console.error(`GAGAL (${kesalahan.name}): backup/verifikasi belum selesai; database tidak diubah.`);
  process.exitCode = 1;
} finally { await db.$disconnect(); }
