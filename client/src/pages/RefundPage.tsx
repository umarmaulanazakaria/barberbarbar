import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api, pesanError } from "../lib/api";
import { bolehRetryRefund } from "../lib/booking";
import { rupiah } from "../lib/format";
import { waktuBooking } from "../lib/tampilan-booking";
import type { PermohonanRefund } from "../types-booking";
import { Button, Card, Empty, ErrorState, LoadingState, PageTitle, StatusBadge, Textarea } from "../components/ui";
import ConfirmDialog from "../components/ConfirmDialog";

export default function RefundPage() {
  const { user } = useAuth();
  return user?.role === "ADMIN" ? <RefundAdmin /> : <ErrorState text="Refund hanya dapat diakses ADMIN." />;
}
function RefundAdmin() {
  const klien = useQueryClient(), toast = useToast();
  const [catatan, setCatatan] = useState<Record<number, string>>({});
  const [pilihan, setPilihan] = useState<{ id: number; aksi: "approve" | "reject" | "retry" } | null>(null);
  const daftar = useQuery({ queryKey: ["refund-requests"], queryFn: async () => (await api.get<{ data: PermohonanRefund[] }>("/refund-requests")).data.data, refetchInterval: 30000 });
  const keputusan = useMutation({ mutationFn: async () => {
    const item = daftar.data?.find(r => r.id === pilihan?.id);
    if (!pilihan || !item || (pilihan.aksi === "retry" ? !bolehRetryRefund(item.status) : item.status !== "PENDING_APPROVAL")) throw new Error("Status refund tidak mengizinkan tindakan ini");
    return api.post(`/refund-requests/${pilihan.id}/${pilihan.aksi}`, pilihan.aksi === "retry" ? {} : { catatan: catatan[pilihan.id]?.trim() });
  }, onSuccess: () => { setPilihan(null); toast.success("Permintaan diproses. Periksa status provider terbaru; belum tentu refund selesai."); }, onError: e => { setPilihan(null); toast.error(pesanError(e)); }, onSettled: async () => {
    await Promise.all(["refund-requests", "booking-payments", "dashboard"].map(k => klien.invalidateQueries({ queryKey: [k] })));
  }});
  return <><PageTitle title="Permohonan Refund" subtitle="Keputusan ADMIN dan status aktual provider" action={<Button variant="secondary" disabled={daftar.isFetching} onClick={() => void daftar.refetch()}>Perbarui status lokal</Button>} />
    <p className="mb-4 text-sm text-slate-500">PROCESSING dan respons provider 202 belum berarti berhasil. Tidak ada retry otomatis atau pencatatan refund dari frontend.</p>
    {daftar.isPending ? <LoadingState /> : daftar.isError ? <ErrorState text={pesanError(daftar.error)} onRetry={() => void daftar.refetch()} /> : !daftar.data.length ? <Card><Empty text="Belum ada permohonan refund lokal." /></Card> : <div className="space-y-4">{daftar.data.map(r => <Card key={r.id} className="space-y-2 p-4"><div className="flex flex-wrap justify-between gap-2"><Link to={`/bookings/${r.bookingId}`} className="font-bold text-indigo-700">Refund #{r.id} · Booking #{r.bookingId}</Link><StatusBadge value={r.status} /></div><p className="font-bold">{rupiah(r.nominal)}</p><p>{r.alasan}</p><p className="text-xs text-slate-500">Diajukan {waktuBooking(r.dibuatPada)}{r.diputuskanPada && ` · Diputuskan ${waktuBooking(r.diputuskanPada)}`}</p>{r.catatanKeputusan && <p>Catatan keputusan: {r.catatanKeputusan}</p>}{r.kodeProvider && <p className="text-xs">Kode hasil provider: {r.kodeProvider}</p>}
      {r.status === "PROCESSING" && <p className="text-amber-700">Menunggu konfirmasi final provider. Retry dinonaktifkan.</p>}{r.status === "UNSUPPORTED" && <p className="text-red-700">Metode tidak mendukung refund otomatis. Memerlukan kebijakan manual; dana belum dianggap dikembalikan.</p>}{r.status === "FAILED" && <p className="text-red-700">Belum berhasil. Backend wajib merekonsiliasi provider sebelum mengirim ulang dengan identitas refund yang sama.</p>}
      {r.status === "PENDING_APPROVAL" && <><Textarea aria-label={`Catatan refund ${r.id}`} maxLength={255} placeholder="Catatan keputusan wajib" value={catatan[r.id] ?? ""} disabled={keputusan.isPending} onChange={e => setCatatan({ ...catatan, [r.id]: e.target.value })} /><div className="flex gap-2"><Button disabled={keputusan.isPending || daftar.isFetching || !catatan[r.id]?.trim()} onClick={() => setPilihan({ id: r.id, aksi: "approve" })}>Setujui refund</Button><Button variant="danger" disabled={keputusan.isPending || daftar.isFetching || !catatan[r.id]?.trim()} onClick={() => setPilihan({ id: r.id, aksi: "reject" })}>Tolak refund</Button></div></>}
      {bolehRetryRefund(r.status) && <Button disabled={keputusan.isPending || daftar.isFetching} onClick={() => setPilihan({ id: r.id, aksi: "retry" })}>Retry refund dengan rekonsiliasi</Button>}
    </Card>)}</div>}
    <ConfirmDialog open={pilihan !== null} title="Konfirmasi keputusan refund" description={`Tindakan ${pilihan?.aksi ?? ""} untuk refund #${pilihan?.id ?? ""}. Persetujuan/retry dapat menghubungi provider. Status akhir tetap mengikuti backend.`} loading={keputusan.isPending} onCancel={() => setPilihan(null)} onConfirm={() => keputusan.mutate()} />
  </>;
}
