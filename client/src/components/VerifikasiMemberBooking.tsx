import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, pesanError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button, Input, ErrorState, LoadingState } from "./ui";
import ConfirmDialog from "./ConfirmDialog";

type Data = { bebasDp: boolean; diverifikasiPada: string | null; nomorMember: string | null };
type Identitas = { member: { nomorMember: string; nama: string; status: string }; layak: boolean };
export default function VerifikasiMemberBooking({ id, status }: { id: number; status: string }) {
  const klien = useQueryClient(), { user } = useAuth(), berjalan = useRef(false);
  const data = useQuery({ queryKey: ["booking", "member", id], queryFn: async () => (await api.get<Data>(`/management/membership-benefits/booking/${id}`)).data });
  const identitas = useQuery({ queryKey: ["booking", "member", id, "identity"], queryFn: async () => (await api.get<Identitas>(`/management/membership-benefits/booking/${id}/identity`)).data, enabled: data.data?.bebasDp === true });
  const [koreksi, aturKoreksi] = useState(false), [nomor, aturNomor] = useState(""), [nama, aturNama] = useState(""), [hp, aturHp] = useState(""), [cari, aturCari] = useState("");
  const [aksi, aturAksi] = useState<"MEMBER" | "NORMAL" | null>(null), [sibuk, aturSibuk] = useState(false), [gagal, aturGagal] = useState(""), [pesan, aturPesan] = useState("");
  const kandidat = useQuery({ queryKey: ["memberships", "search", cari], queryFn: async () => (await api.get<{ data: { id: number; nomorMember: string; nama: string; nomorTelepon: string }[] }>("/management/memberships", { params: { cari, status: "AKTIF" } })).data, enabled: user?.role === "ADMIN" && koreksi && cari.trim().length >= 3 });
  const segarkan = () => { for (const key of ["booking", "bookings", "booking-payments", "orders", "order", "dashboard"]) void klien.invalidateQueries({ queryKey: [key] }); };
  const verifikasi = async (cocok: boolean) => {
    if (berjalan.current) return; berjalan.current = true; aturSibuk(true); aturGagal(""); aturPesan("");
    try {
      await api.post(`/management/membership-benefits/booking/${id}/identity`, { pemeriksaanFisik: true, cocok });
      aturPesan(cocok ? "Verifikasi identitas berhasil." : "Identitas tidak cocok. Manfaat Membership tidak boleh digunakan dan pelayanan belum dapat dilanjutkan. Minta bantuan Admin; harga dan status Booking tidak diubah.");
    } catch (e) { aturGagal(pesanError(e)); }
    finally { segarkan(); berjalan.current = false; aturSibuk(false); }
  };
  const simpanKoreksi = async () => {
    if (!aksi || berjalan.current) return; berjalan.current = true; aturSibuk(true); aturGagal(""); aturPesan("");
    try {
      await api.put(`/management/membership-benefits/booking/${id}`, { nomorMember: nomor || data.data?.nomorMember || "", nama, nomorTelepon: hp, hargaNormal: aksi === "NORMAL", konfirmasi: true });
      aturKoreksi(false); aturPesan("Koreksi Admin tersimpan. Periksa kembali rincian Booking.");
    } catch (e) { aturGagal(pesanError(e)); }
    finally { aturAksi(null); segarkan(); berjalan.current = false; aturSibuk(false); }
  };
  if (data.isPending) return <LoadingState/>;
  if (data.isError) return <ErrorState onRetry={() => void data.refetch()}/>;
  const dapatDiubah = ["CONFIRMED", "CHECKED_IN"].includes(status);
  if (!data.data.bebasDp && !dapatDiubah) return null;
  return <section className="quick-section space-y-3">
    <h3>Verifikasi Membership</h3>
    {gagal && <p role="alert">{gagal}</p>}{pesan && <p role="status">{pesan}</p>}
    {data.data.bebasDp ? <>
      {identitas.isPending ? <LoadingState/> : identitas.isError ? <ErrorState text="Status Membership belum dapat dipastikan." onRetry={() => void identitas.refetch()}/> : <>
        <p>Status: <strong>{identitas.data.member.status.replaceAll("_", " ")}</strong></p>
        <p>Nomor Member: <strong>{identitas.data.member.nomorMember}</strong></p>
        <p>Nama Member: <strong>{identitas.data.member.nama}</strong></p>
        <div className="space-y-2 text-sm"><h4 className="font-semibold">Pemeriksaan Identitas</h4><p>Cocokkan:</p><ol className="list-decimal space-y-1 pl-5">
          <li>Nomor Member pada kartu dengan nomor di aplikasi.</li><li>Nama pada KTP dengan nama Member di aplikasi.</li><li>Foto pada KTP dengan orang yang hadir.</li>
        </ol></div>
        {data.data.diverifikasiPada && <p className="text-sm">Identitas sudah diverifikasi.</p>}
        {!identitas.data.layak && <p className="text-sm">Membership belum memenuhi syarat. Minta pemeriksaan Admin.</p>}
        {dapatDiubah && <div className="flex flex-wrap gap-2">
          <Button disabled={sibuk || identitas.isFetching || !identitas.data.layak} onClick={() => void verifikasi(true)}>Identitas Cocok — Verifikasi</Button>
          <Button variant="secondary" disabled={sibuk || identitas.isFetching} onClick={() => void verifikasi(false)}>Identitas Tidak Cocok</Button>
        </div>}
      </>}
    </> : <p>Tanpa Membership</p>}
    {dapatDiubah && user?.role === "ADMIN" && <>
      <Button variant="secondary" disabled={sibuk} aria-expanded={koreksi} onClick={() => aturKoreksi(v => !v)}>{koreksi ? "Tutup koreksi Admin" : "Cari / koreksi Member (Admin)"}</Button>
      {koreksi && <div className="space-y-3 border-t pt-3"><h4 className="font-semibold">Koreksi Member — khusus Admin</h4>
        <p className="text-sm">Tindakan terpisah ini dapat mengubah manfaat dan tagihan. Cocokkan identitas pelanggan sebelum menyimpan koreksi.</p>
        <Input aria-label="Cari Member untuk koreksi" value={cari} maxLength={100} onChange={e => aturCari(e.target.value)} placeholder="Cari nama atau nomor HP"/>
        {kandidat.data?.data.map(m => <Button variant="secondary" key={m.id} disabled={sibuk} onClick={() => aturNomor(m.nomorMember)}>{m.nama} · {m.nomorTelepon} · {m.nomorMember}</Button>)}
        <Input aria-label="Nomor Member untuk koreksi" maxLength={60} placeholder={data.data.nomorMember || "Nomor Member"} value={nomor} onChange={e => aturNomor(e.target.value)}/>
        <Input aria-label="Nama pelanggan untuk koreksi" maxLength={100} placeholder="Nama sesuai identitas pelanggan yang hadir" value={nama} onChange={e => aturNama(e.target.value)}/>
        <Input aria-label="Nomor HP pelanggan untuk koreksi" type="tel" maxLength={30} placeholder="Nomor HP pelanggan yang hadir" value={hp} onChange={e => aturHp(e.target.value)}/>
        <div className="flex flex-wrap gap-2"><Button disabled={sibuk || !nama.trim() || !hp.trim() || !nomor && !data.data.nomorMember} onClick={() => aturAksi("MEMBER")}>Simpan koreksi Member</Button>
        {data.data.bebasDp && <Button variant="secondary" disabled={sibuk} onClick={() => aturAksi("NORMAL")}>Gunakan harga normal</Button>}</div>
      </div>}
    </>}
    <ConfirmDialog open={!!aksi} title={aksi === "NORMAL" ? "Ubah ke harga normal?" : "Simpan koreksi Member?"} description={aksi === "NORMAL" ? "Tagihan dihitung ulang tanpa menghapus pembayaran. DP mungkin diperlukan sebelum check-in. Lengkapi identitas pelanggan jika diminta." : "Saya sudah memeriksa Kartu Member, KTP, nama dan nomor HP pelanggan untuk koreksi. Manfaat dan tagihan dapat dihitung ulang; tindakan dicatat dalam audit."} loading={sibuk} onCancel={() => !sibuk && aturAksi(null)} onConfirm={() => void simpanKoreksi()}/>
  </section>;
}
