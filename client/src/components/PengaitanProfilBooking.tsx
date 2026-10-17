import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, pesanError } from "../lib/api";
import type { ProfilPelanggan } from "../lib/profil-pelanggan";
import { Button, Input, LoadingState, ErrorState } from "./ui";
import ConfirmDialog from "./ConfirmDialog";

type Konteks = { profil: ProfilPelanggan | null; dapatDiubah: boolean; kandidat: (ProfilPelanggan & { kecocokanHp: boolean; kemiripanNama: boolean })[] };
export default function PengaitanProfilBooking({ id }: { id: number }) {
  const klien = useQueryClient();
  const [cari, aturCari] = useState(""), [kata, aturKata] = useState("");
  const [pilihan, aturPilihan] = useState<{ id: number | null; nama: string } | null>(null), [sibuk, aturSibuk] = useState(false), [gagal, aturGagal] = useState("");
  useEffect(() => { const t = setTimeout(() => aturKata(cari.trim()), 300); return () => clearTimeout(t); }, [cari]);
  const data = useQuery({ queryKey: ["customers", "booking", id, kata], queryFn: async () => (await api.get<Konteks>(`/management/customers/booking/${id}`, { params: { cari: kata } })).data });
  const simpan = async () => {
    if (!pilihan || sibuk) return;
    aturSibuk(true); aturGagal("");
    try { await api.put(`/management/customers/booking/${id}`, { profilId: pilihan.id, konfirmasi: true }); aturPilihan(null); for (const key of ["customers", "booking", "bookings", "orders", "order", "dashboard"]) void klien.invalidateQueries({ queryKey: [key] }); }
    catch (e) { aturGagal(pesanError(e)); } finally { aturSibuk(false); }
  };
  return <section className="quick-section space-y-3"><h3>Profil pelanggan</h3>{gagal && <p role="alert">{gagal}</p>}{data.isPending ? <LoadingState /> : data.isError ? <ErrorState onRetry={() => void data.refetch()} /> : <>
    <p>{data.data.profil ? <><strong>{data.data.profil.nama}</strong> · {data.data.profil.nomorTelepon || "Belum ada nomor HP"}</> : "Booking belum terhubung ke profil pelanggan."}</p>
    {data.data.dapatDiubah ? <><Input aria-label="Cari profil pelanggan untuk Booking" value={cari} onChange={e => aturCari(e.target.value)} placeholder="Cari nama atau nomor HP" disabled={sibuk}/><p className="text-xs text-slate-500">{kata ? "Hasil pencarian profil" : "Rekomendasi dari nomor HP dan kemiripan nama. Pilih dan konfirmasi untuk menghubungkan."}</p>
      {data.data.kandidat.map(p => <div className="flex items-center justify-between gap-3 border-b py-2 text-sm" key={p.id}><span><strong>{p.nama}</strong><small className="block">{p.nomorTelepon} {p.diarsipkanPada ? "· Diarsipkan, minta Admin memulihkan" : p.kecocokanHp ? `· HP cocok${p.kemiripanNama ? ", nama mirip" : ""}` : ""}</small></span><Button variant="secondary" disabled={sibuk || !!p.diarsipkanPada || p.id === data.data.profil?.id} onClick={() => aturPilihan({ id: p.id, nama: p.nama })}>Hubungkan</Button></div>)}
      {!data.data.kandidat.length && <p className="text-sm">Tidak ada profil yang cocok. Booking tetap dapat dilayani tanpa profil.</p>}{data.data.profil && <Button variant="secondary" disabled={sibuk} onClick={() => aturPilihan({ id: null, nama: "tanpa profil" })}>Lepas hubungan</Button>}</> : <p className="text-xs text-slate-500">Hubungan profil sudah dikunci pada status Booking ini.</p>}
  </>}<ConfirmDialog open={!!pilihan} title="Ubah hubungan profil Booking?" description={`Konfirmasi ${pilihan?.nama ?? ""}. Identitas Booking asli, pembayaran, dan invoice tetap dipertahankan. Perubahan dicatat dalam audit.`} confirmLabel="Konfirmasi hubungan" variant="primary" loading={sibuk} onCancel={() => !sibuk && aturPilihan(null)} onConfirm={() => void simpan()} /></section>;
}
