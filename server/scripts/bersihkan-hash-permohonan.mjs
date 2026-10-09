import "dotenv/config";

// Default read-only. --terapkan hanya dijalankan setelah persetujuan pemilik data.
const { default: basisData } = await import("../dist/lib/prisma.js");
const kondisi = { status: { in: ["DISETUJUI", "DITOLAK"] }, passwordHash: { not: "" } };
try {
  if (process.argv.includes("--terapkan")) {
    const hasil = await basisData.permohonanPengaitanAkun.updateMany({
      where: kondisi, data: { passwordHash: "" },
    });
    console.log(`Hash permohonan diputuskan dibersihkan: ${hasil.count}`);
  } else {
    console.log(`READ-ONLY: ${await basisData.permohonanPengaitanAkun.count({ where: kondisi })} permohonan memerlukan pembersihan hash.`);
  }
} finally { await basisData.$disconnect(); }
