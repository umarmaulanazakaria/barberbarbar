import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import type { Struk } from "../lib/dokumen-keuangan";
import DetailDokumenKeuangan from "./DetailDokumenKeuangan";
import { useToast } from "../context/ToastContext";

type Antrian = { id: string; dokumenId: string };
type Catatan = { dikenal: string[]; antrian: Antrian[] };
// Deduplikasi per akun dan ID ledger; bukan event Socket atau jumlah render.
export default function StrukOtomatis() {
  const { user } = useAuth();
  return user ? <Pemantau key={user.id} penggunaId={user.id}/> : null;
}
function Pemantau({ penggunaId }: { penggunaId: number }) {
  const kunci = `barber:struk:v1:${penggunaId}`, cetakKey = `barber:cetak:v1:${penggunaId}`;
  const catatan = useRef<Catatan | null>(null), [aktif, aturAktif] = useState<Antrian | null>(null), [tersimpan, aturTersimpan] = useState(true), toast = useToast();
  const data = useQuery({ queryKey: ["struk-resmi", penggunaId], queryFn: async () => (await api.get<Struk[]>("/management/finance/receipts")).data,
    refetchInterval: 5000, refetchOnWindowFocus: "always", refetchOnMount: "always" });
  useEffect(() => {
    const refresh = () => { void data.refetch(); }; window.addEventListener("pembayaran:berubah", refresh);
    return () => window.removeEventListener("pembayaran:berubah", refresh);
  }, [data.refetch]);
  useEffect(() => {
    const kembali = () => { if (document.visibilityState === "visible") { aturAktif(a => a ?? catatan.current?.antrian[0] ?? null); void data.refetch(); } };
    document.addEventListener("visibilitychange", kembali);
    return () => document.removeEventListener("visibilitychange", kembali);
  }, [data.refetch]);
  const simpan = (v: Catatan) => { catatan.current = v; try { localStorage.setItem(kunci, JSON.stringify(v)); } catch { aturTersimpan(false); } };
  useEffect(() => {
    if (!data.data) return;
    let c = catatan.current;
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(kunci) ?? "null");
      if (raw && typeof raw === "object" && "dikenal" in raw && "antrian" in raw && Array.isArray(raw.dikenal) && raw.dikenal.every(v => typeof v === "string") && Array.isArray(raw.antrian) && raw.antrian.every(v => v && typeof v.id === "string" && typeof v.dokumenId === "string")) c = raw as Catatan;
    } catch { aturTersimpan(false); }
    if (!c) { simpan({ dikenal: data.data.map(s => s.id), antrian: [] }); return; }
    const baru = data.data.filter(s => !c!.dikenal.includes(s.id)).map(s => ({ id: s.id, dokumenId: s.dokumenId }));
    const next = { dikenal: [...new Set([...c.dikenal, ...data.data.map(s => s.id)])], antrian: [...c.antrian, ...baru] };
    simpan(next);
    if (baru.length) toast.info("Pembayaran terverifikasi. Struk resmi tersedia untuk dicetak.");
    if (document.visibilityState === "visible") aturAktif(a => a ?? next.antrian[0] ?? null);
  }, [data.data, kunci]);
  const tutup = () => {
    const c = catatan.current; if (!c || !aktif) return;
    const next = { ...c, antrian: c.antrian.filter(s => s.id !== aktif.id) }; simpan(next); aturAktif(next.antrian[0] ?? null);
  };
  return <>{!tersimpan && <p className="keuangan-peringatan" role="status">Penyimpanan struk otomatis dibatasi browser. Cetak manual melalui Invoice.</p>}{aktif && <div className="struk-otomatis"><DetailDokumenKeuangan key={aktif.id} id={aktif.dokumenId} strukId={aktif.id} otomatis={tersimpan} kunciCetak={cetakKey} onClose={tutup}/></div>}</>;
}
