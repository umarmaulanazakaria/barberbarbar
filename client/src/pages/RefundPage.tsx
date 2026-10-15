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
  return user?.role === "ADMIN" ? <RefundAdmin /> : <ErrorState text="Pengembalian dana hanya dapat dikelola admin." />;
}
function RefundAdmin() {
  const klien = useQueryClient(), toast = useToast();
  const [catatan, setCatatan] = useState<Record<number, string>>({});
  const [pilihan, setPilihan] = useState<{ id: number; aksi: "approve" | "reject" | "retry" } | null>(null);
  const daftar = useQuery({ queryKey: ["refund-requests"], queryFn: async () => (await api.get<{ data: PermohonanRefund[] }>("/refund-requests")).data.data, refetchInterval: 30000 });
  const keputusan = useMutation({ mutationFn: async () => {
    const item = daftar.data?.find(r => r.id === pilihan?.id);
    if (!pilihan || !item || (pilihan.aksi === "retry" ? !bolehRetryRefund(item.status) : item.status !== "PENDING_APPROVAL")) throw new Error("Pengembalian dana belum dapat diproses pada status ini");
    return api.post(`/refund-requests/${pilihan.id}/${pilihan.aksi}`, pilihan.aksi === "retry" ? {} : { catatan: catatan[pilihan.id]?.trim() });
  }, onSuccess: () => { setPilihan(null); toast.success("Permintaan diproses. Periksa status provider terbaru; belum tentu refund selesai."); }, onError: e => { setPilihan(null); toast.error(pesanError(e)); }, onSettled: async () => {
    await Promise.all(["refund-requests", "booking-payments", "dashboard"].map(k => klien.invalidateQueries({ queryKey: [k] })));
  }});
  return <><PageTitle title="Pengembalian Dana" subtitle="Tinjau pengajuan dan status pengembalian dana" action={<Button variant="secondary" disabled={daftar.isFetching} onClick={() => void daftar.refetch()}>Perbarui status lokal</Button>} />
    <p className="mb-4 text-sm text-slate-500">Pengajuan yang sedang diproses belum berarti dana telah dikembalikan. Periksa status sebelum mencoba kembali.</p>
    {daftar.isPending ? <LoadingState /> : daftar.isError ? <ErrorState text={pesanError(daftar.error)} onRetry={() => void daftar.refetch()} /> : !daftar.data.length ? <Card><Empty text="Belum ada pengajuan pengembalian dana." /></Card> : <div className="space-y-4">{daftar.data.map(r => <Card key={r.id} className="space-y-2 p-4"><div className="flex flex-wrap justify-between gap-2"><Link to={`/bookings/${r.bookingId}`} className="font-bold text-indigo-700">Pengembalian Dana #{r.id} · Booking #{r.bookingId}</Link><StatusBadge value={r.status} /></div><p className="font-bold">{rupiah(r.nominal)}</p><p>{r.alasan}</p><p className="text-xs text-slate-500">Diajukan {waktuBooking(r.dibuatPada)}{r.diputuskanPada && ` · Diputuskan ${waktuBooking(r.diputuskanPada)}`}</p>{r.catatanKeputusan && <p>Catatan keputusan: {r.catatanKeputusan}</p>}
      {r.status === "PROCESSING" && <p className="text-amber-700">Pengembalian dana sedang diproses. Tunggu konfirmasi sebelum mencoba kembali.</p>}{r.status === "UNSUPPORTED" && <p className="text-red-700">Metode pembayaran ini memerlukan penanganan pengelola. Dana belum dikembalikan.</p>}{r.status === "FAILED" && <p className="text-red-700">Pengembalian dana belum berhasil. Status akan diperiksa sebelum percobaan ulang untuk mencegah pengembalian ganda.</p>}
      {r.status === "PENDING_APPROVAL" && <><Textarea aria-label={`Catatan refund ${r.id}`} maxLength={255} placeholder="Catatan keputusan wajib" value={catatan[r.id] ?? ""} disabled={keputusan.isPending} onChange={e => setCatatan({ ...catatan, [r.id]: e.target.value })} /><div className="flex gap-2"><Button disabled={keputusan.isPending || daftar.isFetching || !catatan[r.id]?.trim()} onClick={() => setPilihan({ id: r.id, aksi: "approve" })}>Setujui pengembalian dana</Button><Button variant="danger" disabled={keputusan.isPending || daftar.isFetching || !catatan[r.id]?.trim()} onClick={() => setPilihan({ id: r.id, aksi: "reject" })}>Tolak pengembalian dana</Button></div></>}
      {bolehRetryRefund(r.status) && <Button disabled={keputusan.isPending || daftar.isFetching} onClick={() => setPilihan({ id: r.id, aksi: "retry" })}>Periksa dan coba kembali</Button>}
    </Card>)}</div>}
    <ConfirmDialog open={pilihan !== null} title="Konfirmasi pengembalian dana" description={`Tindakan ${pilihan?.aksi === "approve" ? "setujui" : pilihan?.aksi === "reject" ? "tolak" : "periksa kembali"} untuk pengembalian dana #${pilihan?.id ?? ""}. Status dana akan diperiksa sebelum pengembalian diproses.`} loading={keputusan.isPending} onCancel={() => setPilihan(null)} onConfirm={() => keputusan.mutate()} />
  </>;
}
