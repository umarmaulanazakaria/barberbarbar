import { createHash } from "node:crypto";

const hash = (nilai) => createHash("sha256").update(JSON.stringify(nilai)).digest("hex");
export const statusFinal = ["DISETUJUI", "DITOLAK"];

export const ambilSnapshot = async (db) => {
  const permohonan = await db.permohonanPengaitanAkun.findMany({ orderBy: { id: "asc" } });
  const akun = await db.akunPelanggan.findMany({ orderBy: { id: "asc" } });
  const pelanggan = await db.pelanggan.findMany({ orderBy: { id: "asc" } });
  const operator = await db.pengguna.findMany({ orderBy: { id: "asc" } });
  return {
    terdampak: permohonan.filter(p => statusFinal.includes(p.status) && p.passwordHash !== "").map(p => {
      const terkait = akun.find(a => a.pelangganId === p.pelangganId);
      return {
        id: p.id, status: p.status, pelangganId: p.pelangganId,
        diputuskanOlehId: p.diputuskanOlehId, diputuskanPada: p.diputuskanPada?.toISOString() ?? null,
        akunId: terkait?.id ?? null,
        statusPelanggan: pelanggan.find(a => a.id === p.pelangganId)?.status ?? null,
        hashAkunTersedia: Boolean(terkait?.passwordHash),
        hashPermohonanSamaDenganAkun: terkait ? p.passwordHash === terkait.passwordHash : null,
      };
    }),
    // Sidik saja yang disimpan/ditampilkan; nilai hash password tidak pernah keluar.
    sidik: {
      akun: hash(akun), pelanggan: hash(pelanggan), operator: hash(operator),
      keputusan: hash(permohonan.map(({ passwordHash: _hash, ...p }) => p)),
      hashPermohonan: hash(permohonan.map(p => ({ id: p.id, passwordHash: p.passwordHash }))),
    },
  };
};

export const pastikanAman = (snapshot) => {
  if (snapshot.terdampak.length !== 2) throw new Error("Jumlah target bukan dua; audit ulang sebelum persetujuan");
  for (const target of snapshot.terdampak) {
    if (!statusFinal.includes(target.status) || !target.diputuskanPada || !target.diputuskanOlehId) {
      throw new Error("Keputusan final tidak lengkap; penerapan dibatalkan");
    }
    if (target.status === "DISETUJUI" && (!target.akunId || !target.hashAkunTersedia)) {
      throw new Error("Akun permohonan disetujui tidak tersedia; penerapan dibatalkan");
    }
  }
};
