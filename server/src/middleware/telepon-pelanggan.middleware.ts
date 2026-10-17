import type { Request, Response, NextFunction } from "express";

// DTO operator lama menjanjikan string. NULL tetap disimpan di DB, bukan HP palsu.
export function dtoTeleponPelanggan(nilai: unknown, konteks = ""): unknown {
  if (Array.isArray(nilai)) return nilai.map(v => dtoTeleponPelanggan(v, konteks));
  if (nilai===null && konteks==="pelanggan") return {id:null,nama:"Pelanggan Anonim",nomorTelepon:""};
  if (!nilai || typeof nilai !== "object" || nilai instanceof Date) return nilai;
  const data = nilai as Record<string, unknown>;
  const pelanggan = konteks === "pelanggan" || (typeof data.nama === "string" && (data.status === "AKTIF" || data.status === "DIBLOKIR")) ||
    (typeof data.pelanggan === "string" && (data.jenis === "WALK_IN" || data.jenis === "BOOKING"));
  const profil = data.profilPelanggan;
  if (profil && typeof profil === "object" && data.nomorPesanan && !data.booking) { const f=profil as Record<string,unknown>; const c=data.pelanggan; if(c && typeof c==="object") data.pelanggan={...c,nama:f.nama,nomorTelepon:f.nomorTelepon??""}; }
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, k === "nomorTelepon" && v === null && pelanggan ? "" : dtoTeleponPelanggan(v, k)]));
}
export const kompatibilitasTeleponPelanggan = (_req: Request, res: Response, next: NextFunction) => {
  const kirim = res.json.bind(res);
  res.json = isi => kirim(dtoTeleponPelanggan(isi));
  next();
};
