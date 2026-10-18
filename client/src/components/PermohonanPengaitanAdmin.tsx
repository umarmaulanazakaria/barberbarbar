import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, pesanError } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { Button, ContentPanel, Empty, ErrorState, LoadingState, StatusBadge, Textarea } from "./ui";
import { waktuBooking } from "../lib/tampilan-booking";
import ConfirmDialog from "./ConfirmDialog";
type Permohonan = { id: number; namaPendaftar: string; email: string; status: string; dibuatPada: string; catatanKeputusan: string | null; pelanggan: { id: number; nama: string; status: string } };
export default function PermohonanPengaitanAdmin() {
  const klien = useQueryClient(), toast = useToast();
  const [catatan, setCatatan] = useState<Record<number, string>>({});
  const [pilihan, setPilihan] = useState<{ id: number; aksi: "approve" | "reject" } | null>(null);
  const daftar = useQuery({ queryKey: ["account-link-requests"], queryFn: async () => (await api.get<{ data: Permohonan[] }>("/auth/customer/requests")).data.data });
  const keputusan = useMutation({ mutationFn: () => {
    if (!pilihan) throw new Error("Pilih permohonan");
    return api.post(`/auth/customer/requests/${pilihan.id}/${pilihan.aksi}`, pilihan.aksi === "reject" ? { catatanKeputusan: catatan[pilihan.id]?.trim() } : {});
  }, onSuccess: () => { setPilihan(null); toast.success("Keputusan pengaitan tersimpan."); }, onError: e => { setPilihan(null); toast.error(pesanError(e)); }, onSettled: async () => { await Promise.all(["account-link-requests", "customers", "dashboard"].map(k => klien.invalidateQueries({ queryKey: [k] }))); } });
  return <ContentPanel className="mb-4 request-panel" title="Permohonan pengaitan akun"><div className="space-y-3 p-4">{daftar.isPending ? <LoadingState /> : daftar.isError ? <ErrorState text={pesanError(daftar.error)} onRetry={() => void daftar.refetch()} /> : !daftar.data.length ? <Empty text="Belum ada permohonan pengaitan." /> : daftar.data.map(p => <div key={p.id} className="space-y-2 rounded border p-3"><b>{p.namaPendaftar} → {p.pelanggan.nama}</b><p>{p.email} · {waktuBooking(p.dibuatPada)}</p><StatusBadge value={p.status} /><p>{p.catatanKeputusan}</p>{p.status === "MENUNGGU" && <><Textarea aria-label={`Catatan pengaitan ${p.id}`} maxLength={500} placeholder="Catatan penolakan (opsional)" value={catatan[p.id] ?? ""} onChange={e => setCatatan({ ...catatan, [p.id]: e.target.value })} /><Button disabled={keputusan.isPending || p.pelanggan.status !== "AKTIF"} onClick={() => setPilihan({ id: p.id, aksi: "approve" })}>Setujui pengaitan</Button> <Button variant="danger" disabled={keputusan.isPending} onClick={() => setPilihan({ id: p.id, aksi: "reject" })}>Tolak pengaitan</Button></>}</div>)}<ConfirmDialog open={pilihan !== null} title="Konfirmasi pengaitan akun" description="Simpan keputusan ADMIN untuk permohonan ini?" loading={keputusan.isPending} onCancel={() => setPilihan(null)} onConfirm={() => keputusan.mutate()} /></div></ContentPanel>;
}
