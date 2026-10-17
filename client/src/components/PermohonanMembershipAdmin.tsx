import { statusRamah } from '../lib/teks';
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, pesanError } from "../lib/api";
import { Button, ContentPanel } from "./ui";

type Permohonan = { id: number; status: string; dibuatPada: string;
  pelanggan: { id: number; nama: string; status: string }; catatanKeputusan: string | null };
export default function PermohonanMembershipAdmin() {
  const klien = useQueryClient();
  const [pesan, setPesan] = useState("");
  const daftar = useQuery({ queryKey: ["membership-requests"], queryFn: async () =>
    (await api.get<{ data: Permohonan[] }>("/membership-requests")).data.data });
  const keputusan = useMutation({
    mutationFn: async ({ id, aksi }: { id: number; aksi: "approve" | "reject" }) =>
      api.post(`/membership-requests/${id}/${aksi}`, {}),
    onSuccess: () => setPesan("Keputusan membership tersimpan."),
    onError: error => setPesan(pesanError(error)),
    onSettled: async () => { await Promise.all([
      klien.invalidateQueries({ queryKey: ["membership-requests"] }),
      klien.invalidateQueries({ queryKey: ["memberships"] }),
      klien.invalidateQueries({ queryKey: ["customers"] }),
    ]); },
  });
  return <ContentPanel className="mb-4 request-panel" title="Permohonan membership"><div className="space-y-3 p-4">
    {daftar.isPending ? <p>Memuat permohonan…</p> : daftar.isError ?
      <p>Permohonan belum dapat dimuat. <button type="button" onClick={() => void daftar.refetch()}>Coba lagi</button></p> :
      daftar.data.length === 0 ? <p>Belum ada permohonan.</p> :
        <ul className="space-y-3">{daftar.data.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
          <div><strong>{item.pelanggan.nama}</strong><p>{statusRamah(item.status)} · Pelanggan {statusRamah(item.pelanggan.status)}</p></div>
          {item.status === "PENDING_APPROVAL" && <div className="flex gap-2">
            <Button disabled={keputusan.isPending || item.pelanggan.status !== "AKTIF"}
              onClick={() => keputusan.mutate({ id: item.id, aksi: "approve" })}>Setujui</Button>
            <Button disabled={keputusan.isPending} onClick={() => keputusan.mutate({ id: item.id, aksi: "reject" })}>Tolak</Button>
          </div>}
        </li>)}</ul>}
    <p role="status" aria-live="polite">{pesan}</p>
  </div></ContentPanel>;
}
