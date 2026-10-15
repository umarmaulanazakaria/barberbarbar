import "dotenv/config";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { ambilSnapshot, pastikanAman, statusFinal } from "./util-audit-hash-permohonan.mjs";

// Default read-only. --terapkan hanya dijalankan setelah persetujuan pemilik data.
const { default: basisData } = await import("../dist/lib/prisma.js");
const kondisi = { status: { in: ["DISETUJUI", "DITOLAK"] }, passwordHash: { not: "" } };
try {
  if (process.argv.includes("--terapkan")) {
    const posisi = process.argv.indexOf("--rencana");
    if (posisi === -1 || !process.argv[posisi + 1]) throw new Error("Penerapan wajib memakai file rencana yang telah disetujui");
    const rencana = JSON.parse(await readFile(process.argv[posisi + 1], "utf8"));
    assert.equal(rencana.versi, 1);
    assert.ok(rencana.backup.terverifikasi);
    const arsip = await readFile(rencana.backup.lokasi);
    assert.equal(createHash("sha256").update(arsip).digest("hex"), rencana.backup.sha256);
    const jumlah = await basisData.$transaction(async transaksi => {
      const sebelum = await ambilSnapshot(transaksi);
      pastikanAman(sebelum);
      assert.deepEqual(sebelum, rencana.snapshot, "Data berubah sejak audit; wajib audit/backup dan persetujuan ulang");
      const target = sebelum.terdampak.map(p => ({ id: p.id, status: p.status }));
      const hasil = await transaksi.permohonanPengaitanAkun.updateMany({
        where: { OR: target, status: { in: statusFinal }, passwordHash: { not: "" } },
        data: { passwordHash: "" },
      });
      assert.equal(hasil.count, 2);
      const sesudah = await ambilSnapshot(transaksi);
      assert.equal(sesudah.terdampak.length, 0);
      for (const nama of ["akun", "pelanggan", "operator", "keputusan"]) {
        assert.equal(sesudah.sidik[nama], sebelum.sidik[nama], `${nama} harus tetap utuh`);
      }
      return hasil.count;
    }, { isolationLevel: "Serializable" });
    console.log(`PASS: ${jumlah} hash target dikosongkan; akun, pelanggan, operator dan keputusan tetap utuh.`);
  } else {
    console.log(`READ-ONLY: ${await basisData.permohonanPengaitanAkun.count({ where: kondisi })} permohonan memerlukan pembersihan hash.`);
    console.log(JSON.stringify((await ambilSnapshot(basisData)).terdampak, null, 2));
  }
} catch (kesalahan) {
  console.error(`GAGAL (${kesalahan.name}): operasi dibatalkan; audit ulang tanpa menampilkan credential.`);
  process.exitCode = 1;
} finally { await basisData.$disconnect(); }
