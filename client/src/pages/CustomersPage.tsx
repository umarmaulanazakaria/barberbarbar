import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Plus, X } from "lucide-react";
import { api, pesanError } from "../lib/api";
import { rupiah } from "../lib/format";
import { waktuWib } from "../lib/pesanan-terpadu";
import { statusRamah } from "../lib/teks";
import { hpWalkInValid, normalisasiHpWalkIn } from "../lib/walkin-dashboard";
import type { ProfilPelanggan, StatistikProfil, KandidatProfil, DetailProfil } from "../lib/profil-pelanggan";
import { useAuth } from "../context/AuthContext";
import { useFokusDialog } from "../lib/fokus-dialog";
import { Button, ErrorState, Input, LoadingState, PageTitle, Select, Textarea } from "../components/ui";
import ConfirmDialog from "../components/ConfirmDialog";
import "./CustomersPage.css";

type Daftar = { data: (ProfilPelanggan & StatistikProfil)[]; total: number; halaman: number; batas: number };
const tanggal = (v: string | null) => v ? waktuWib(v) : "Belum ada";
export default function CustomersPage() {
  const { user } = useAuth(), admin = user?.role === "ADMIN";
  const [cari, aturCari] = useState(""), [kata, aturKata] = useState(""), [arsip, aturArsip] = useState("AKTIF"), [halaman, aturHalaman] = useState(1);
  const [terpilih, aturTerpilih] = useState<number | "BARU" | null>(null);
  useEffect(() => { const t = setTimeout(() => { aturKata(cari.trim()); aturHalaman(1); }, 300); return () => clearTimeout(t); }, [cari]);
  const daftar = useQuery({ queryKey: ["customers", "profiles", kata, arsip, halaman], queryFn: async () => (await api.get<Daftar>("/management/customers", { params: { cari: kata, arsip, halaman } })).data });
  return <div className="cp-page"><PageTitle title="Pelanggan" subtitle="Kelola profil dan riwayat kunjungan pelanggan." action={admin ? <Button onClick={() => aturTerpilih("BARU")}><Plus size={16}/>Tambah Pelanggan</Button> : undefined}/>
    <div className="cp-tools"><Input aria-label="Cari nama atau nomor HP pelanggan" placeholder="Cari nama atau nomor HP..." maxLength={100} value={cari} onChange={e => aturCari(e.target.value)}/><Select aria-label="Filter arsip pelanggan" value={arsip} onChange={e => { aturArsip(e.target.value); aturHalaman(1); }}><option value="AKTIF">Aktif</option><option value="ARSIP">Diarsipkan</option></Select></div>
    {daftar.isPending ? <LoadingState/> : daftar.isError ? <ErrorState text={pesanError(daftar.error)} onRetry={() => void daftar.refetch()}/> : <><div className="cp-scroll"><table className="cp-table"><thead><tr>{["Nama", "Nomor HP", "Jumlah Kunjungan", "Kunjungan Terakhir", "Total Belanja", "Detail"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{daftar.data.data.map(p => <tr key={p.id}><td>{p.nama}</td><td>{p.nomorTelepon || "Belum dilengkapi"}</td><td>{p.jumlahKunjungan}</td><td>{tanggal(p.kunjunganTerakhir)}</td><td>{rupiah(p.totalBelanja)}</td><td><Button variant="secondary" onClick={() => aturTerpilih(p.id)}>Detail</Button></td></tr>)}{!daftar.data.data.length && <tr><td colSpan={6}>Tidak ada profil pelanggan yang sesuai.</td></tr>}</tbody></table></div><div className="cp-pagination"><span>{daftar.data.total} profil · Halaman {daftar.data.halaman}</span><Button variant="secondary" disabled={daftar.data.halaman <= 1 || daftar.isFetching} onClick={() => aturHalaman(daftar.data.halaman - 1)}>Sebelumnya</Button><Button variant="secondary" disabled={daftar.data.halaman * daftar.data.batas >= daftar.data.total || daftar.isFetching} onClick={() => aturHalaman(daftar.data.halaman + 1)}>Berikutnya</Button></div></>}
    {terpilih !== null && <DrawerProfil key={terpilih} id={terpilih} admin={admin} onClose={() => aturTerpilih(null)} onPilih={aturTerpilih}/>}
  </div>;
}
function DrawerProfil({ id, admin, onClose, onPilih }: { id: number | "BARU"; admin: boolean; onClose: () => void; onPilih: (id: number) => void }) {
  const klien = useQueryClient(), panel = useFokusDialog(true);
  const data = useQuery({ queryKey: ["customers", "profile", id], queryFn: async () => (await api.get<DetailProfil>(`/management/customers/${id}`)).data, enabled: id !== "BARU" });
  const [edit, aturEdit] = useState(id === "BARU"), [nama, aturNama] = useState(""), [hp, aturHp] = useState(""), [email, aturEmail] = useState(""), [catatan, aturCatatan] = useState("");
  const [duplikat, aturDuplikat] = useState<KandidatProfil[]>([]), [terpisah, aturTerpisah] = useState(false), [sibuk, aturSibuk] = useState(false), [gagal, aturGagal] = useState("");
  const [konfirmasi, aturKonfirmasi] = useState<{ aksi: "archive" | "restore" | "close"; id: number; nama: string } | null>(null);
  const profil = data.data?.profil;
  const isiEdit = () => { if (!profil) return; aturNama(profil.nama); aturHp(profil.nomorTelepon ?? ""); aturEmail(profil.email ?? ""); aturCatatan(profil.catatan ?? ""); aturTerpisah(false); aturDuplikat([]); aturEdit(true); aturGagal(""); };
  const tutup = useCallback(() => { if (sibuk) return; if (edit) aturKonfirmasi({ aksi: "close", id: 0, nama: "" }); else onClose(); }, [sibuk, edit, onClose]);
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".admin-shell"), inert = shell?.inert, overflow = document.body.style.overflow;
    if (shell) shell.inert = true; document.body.style.overflow = "hidden";
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented && !konfirmasi) { e.preventDefault(); tutup(); } };
    window.addEventListener("keydown", escape); return () => { if (shell) shell.inert = inert ?? false; document.body.style.overflow = overflow; window.removeEventListener("keydown", escape); };
  }, [tutup, konfirmasi]);
  const invalidasi = () => { for (const key of ["customers", "orders", "order", "dashboard"]) void klien.invalidateQueries({ queryKey: [key] }); };
  const simpan = async () => {
    if (!admin || sibuk || !nama.trim() || !hp.trim() || !hpWalkInValid(hp)) return;
    aturSibuk(true); aturGagal("");
    try { const body = { nama: nama.trim(), nomorTelepon: normalisasiHpWalkIn(hp), email: email.trim(), catatan: catatan.trim(), konfirmasiDuplikat: terpisah };
      const hasil = id === "BARU" ? await api.post<ProfilPelanggan>("/management/customers", body) : await api.patch<ProfilPelanggan>(`/management/customers/${id}`, body);
      aturEdit(false); invalidasi(); if (id === "BARU") onPilih(hasil.data.id);
    } catch (e) { aturGagal(pesanError(e)); if (axios.isAxiosError(e) && Array.isArray(e.response?.data?.kandidat)) aturDuplikat(e.response.data.kandidat); } finally { aturSibuk(false); }
  };
  const arsipkan = async () => {
    if (!konfirmasi || sibuk) return;
    if (konfirmasi.aksi === "close") { onClose(); return; }
    aturSibuk(true); aturGagal("");
    try { await api.post(`/management/customers/${konfirmasi.id}/${konfirmasi.aksi}`, { konfirmasi: true }); invalidasi(); if (konfirmasi.aksi === "restore") aturDuplikat(ds => ds.map(p => p.id === konfirmasi.id ? { ...p, diarsipkanPada: null } : p)); aturKonfirmasi(null); }
    catch (e) { aturGagal(pesanError(e)); aturKonfirmasi(null); } finally { aturSibuk(false); }
  };
  return createPortal(<><div className="cp-backdrop" onClick={tutup}/><aside className="cp-drawer" role="dialog" aria-modal="true" aria-labelledby="cp-title" ref={panel} tabIndex={-1} inert={konfirmasi ? true : undefined}><header><h2 id="cp-title">{id === "BARU" ? "Tambah Pelanggan" : edit ? "Edit Profil" : "Detail Pelanggan"}</h2><button aria-label="Tutup detail pelanggan" disabled={sibuk} onClick={tutup}><X size={20}/></button></header><div className="cp-body">
    {gagal && <p className="cp-warning" role="alert">{gagal}</p>}{id !== "BARU" && data.isPending ? <LoadingState/> : id !== "BARU" && data.isError ? <ErrorState onRetry={() => void data.refetch()}/> : edit ? <form className="cp-form" onSubmit={e => { e.preventDefault(); void simpan(); }}>
      <label>Nama *<Input required maxLength={100} value={nama} disabled={sibuk} onChange={e => { aturNama(e.target.value); aturTerpisah(false); }}/></label><label>Nomor HP *<Input required type="tel" maxLength={30} value={hp} disabled={sibuk} aria-invalid={!!hp && !hpWalkInValid(hp)} onChange={e => { aturHp(e.target.value); aturTerpisah(false); aturDuplikat([]); }}/></label>{hp && !hpWalkInValid(hp) && <p>Masukkan nomor HP Indonesia yang valid.</p>}<label>Email (opsional)<Input type="email" maxLength={254} value={email} disabled={sibuk} onChange={e => { aturEmail(e.target.value); aturTerpisah(false); aturDuplikat([]); }}/></label><label>Catatan (opsional)<Textarea maxLength={2000} value={catatan} disabled={sibuk} onChange={e => aturCatatan(e.target.value)}/></label>
      {!!duplikat.length && <div className="cp-warning"><strong>Profil dengan kontak serupa sudah ada</strong>{duplikat.map(p => <div key={p.id} className="cp-candidate"><span>{p.nama}<small className="block">{p.nomorTelepon} · {p.email}{p.diarsipkanPada && " · Diarsipkan"}</small></span>{p.diarsipkanPada ? <Button type="button" variant="secondary" disabled={sibuk} onClick={() => aturKonfirmasi({ aksi: "restore", id: p.id, nama: p.nama })}>Pulihkan</Button> : <Button type="button" variant="secondary" disabled={sibuk} onClick={() => onPilih(p.id)}>Gunakan profil ini</Button>}</div>)}<label><span><input type="checkbox" checked={terpisah} onChange={e => aturTerpisah(e.target.checked)}/> Saya mengonfirmasi penyimpanan profil terpisah dengan kontak yang sama.</span></label></div>}
      <div className="cp-actions"><Button type="submit" disabled={sibuk || !nama.trim() || !hp.trim() || !hpWalkInValid(hp) || !!duplikat.length && !terpisah}>{sibuk ? "Menyimpan..." : "Simpan Profil"}</Button><Button type="button" variant="secondary" disabled={sibuk} onClick={() => id === "BARU" ? tutup() : aturEdit(false)}>Batal</Button></div>
    </form> : profil && data.data ? <><section><h3>{profil.nama} {profil.diarsipkanPada && "· Diarsipkan"}</h3><dl><div><dt>Nomor HP</dt><dd>{profil.nomorTelepon || "Belum dilengkapi"}</dd></div><div><dt>Email</dt><dd>{profil.email || "—"}</dd></div><div><dt>Tanggal pendaftaran</dt><dd>{tanggal(profil.dibuatPada)}</dd></div><div><dt>Catatan</dt><dd>{profil.catatan || "—"}</dd></div></dl>{admin && <div className="cp-actions"><Button variant="secondary" onClick={isiEdit}>Edit Profil</Button><Button variant="secondary" onClick={() => aturKonfirmasi({ aksi: profil.diarsipkanPada ? "restore" : "archive", id: profil.id, nama: profil.nama })}>{profil.diarsipkanPada ? "Pulihkan" : "Arsipkan"}</Button></div>}</section>
      <section><h3>Ringkasan kunjungan</h3><dl><div><dt>Jumlah Kunjungan</dt><dd>{data.data.jumlahKunjungan}</dd></div><div><dt>Kunjungan Terakhir</dt><dd>{tanggal(data.data.kunjunganTerakhir)}</dd></div><div><dt>Total Belanja Terverifikasi</dt><dd>{rupiah(data.data.totalBelanja)}</dd></div></dl></section><section><h3>Riwayat Booking & Walk-in</h3>{data.data.riwayatPesanan.map(r => <div className="cp-history" key={`${r.jenis}:${r.id}`}><strong>{r.nomor}</strong> · {r.alasan?.includes("TIMEOUT") ? "Kedaluwarsa" : statusRamah(r.status)}<small>{r.jenis === "BOOKING" ? "Booking" : "Walk-in"} · {tanggal(r.waktu)} · {rupiah(r.total)}</small></div>)}{!data.data.riwayatPesanan.length && <p>Belum ada pesanan yang terhubung.</p>}</section><section><h3>Riwayat perubahan</h3>{profil.riwayat.map(r => <div className="cp-history" key={r.id}>{r.aksi.replaceAll("_", " ")}<small>{tanggal(r.dibuatPada)} · {r.penggunaId ? `Operator #${r.penggunaId}` : "Sistem"}</small>{r.rincian !== null && <details><summary>Rincian perubahan</summary><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(r.rincian, null, 2)}</pre></details>}</div>)}</section></> : null}
    </div></aside><ConfirmDialog open={!!konfirmasi} title={konfirmasi?.aksi === "close" ? "Buang perubahan profil?" : konfirmasi?.aksi === "archive" ? "Arsipkan profil?" : "Pulihkan profil?"} description={konfirmasi?.aksi === "close" ? "Perubahan yang belum disimpan akan dibuang." : `${konfirmasi?.nama ?? ""}. Riwayat transaksi tetap dipertahankan. Backend akan memeriksa status pesanan dan mencatat tindakan ini.`} loading={sibuk} onCancel={() => !sibuk && aturKonfirmasi(null)} onConfirm={() => void arsipkan()}/></>, document.body);
}
