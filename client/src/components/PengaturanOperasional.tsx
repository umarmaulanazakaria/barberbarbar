import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, pesanError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button, Card, ErrorState, Input, LoadingState, Select } from "./ui";
import type { Layanan } from "../types";
import "./Keuangan.css";
type Pengaturan = { profil: { nama: string; slogan: string }; jam: { bukaMenit: number; tutupMenit: number; maksimumHari: number; jedaHariIniMenit: number; zonaWaktu: string };
  bookingTamu: { dpPersen: number; deadlineDpMenit: number; slotMenit: number }; pembayaran: { mode: string; verifikasi: string; metode: string[] };
  membership: { harga: number; bulan: number; layananGratisId: number | null; layananGratis: { id: number; nama: string; aktif: boolean } | null } };
const jam = (v: number) => `${String(Math.floor(v / 60)).padStart(2, "0")}.${String(v % 60).padStart(2, "0")}`;
export default function PengaturanOperasional() {
  const { user } = useAuth(), klien = useQueryClient(), admin = user?.role === "ADMIN";
  const data = useQuery({ queryKey: ["pengaturan-operasional"], queryFn: async () => (await api.get<Pengaturan>("/management/finance/settings")).data });
  const layanan = useQuery({ queryKey: ["services"], queryFn: async () => (await api.get<Layanan[]>("/services")).data, enabled: admin });
  const [harga, aturHarga] = useState(0), [layananId, aturLayanan] = useState(0), [sibuk, aturSibuk] = useState(false), [pesan, aturPesan] = useState("");
  useEffect(() => { if (data.data) { aturHarga(data.data.membership.harga); aturLayanan(data.data.membership.layananGratisId ?? 0); } }, [data.data]);
  const d = data.data;
  return <div className="keuangan-pengaturan mb-5"><nav aria-label="Kategori pengaturan">{[["profil", "Profil Barbershop"], ["jam", "Jam Operasional"], ["booking", "Booking"], ["pembayaran", "Pembayaran"], ["membership", "Membership"], ["akses", "Akun & Akses"]].map(([id, nama]) => <a href={`#pengaturan-${id}`} key={id}>{nama}</a>)}</nav>
    {data.isPending ? <LoadingState text="Memuat pengaturan..."/> : data.isError ? <ErrorState text="Pengaturan belum dapat dimuat." onRetry={() => void data.refetch()}/> : d && <>
      <div className="keuangan-grid"><Card className="keuangan-panel"><section id="pengaturan-profil"><h2>Profil Barbershop</h2><strong>{d.profil.nama}</strong><p>{d.profil.slogan}</p><p className="keuangan-keterangan">Identitas aplikasi. Penyuntingan profil belum didukung backend.</p></section></Card>
      <Card className="keuangan-panel"><section id="pengaturan-jam"><h2>Jam Operasional</h2><dl><dt>Jam booking</dt><dd>{jam(d.jam.bukaMenit)}–{jam(d.jam.tutupMenit)} WIB</dd><dt>Zona waktu</dt><dd>{d.jam.zonaWaktu}</dd></dl><p className="keuangan-keterangan">Aturan aktif dari validator jadwal; baca saja.</p></section></Card></div>
      <div className="keuangan-grid"><Card className="keuangan-panel"><section id="pengaturan-booking"><h2>Booking</h2><dl><dt>Slot per Booking</dt><dd>{d.bookingTamu.slotMenit} menit</dd><dt>DP Reguler (Web)</dt><dd>{d.bookingTamu.dpPersen}%</dd><dt>Deadline DP</dt><dd>{d.bookingTamu.deadlineDpMenit} menit</dd><dt>Jangkauan jadwal</dt><dd>{d.jam.maksimumHari} hari</dd><dt>Jeda booking hari ini</dt><dd>{d.jam.jedaHariIniMenit} menit</dd></dl><p className="keuangan-keterangan">Baca saja. Member yang memenuhi syarat tetap bebas DP. Verifikasi identitas Member dilakukan saat kedatangan.</p></section></Card>
      <Card className="keuangan-panel"><section id="pengaturan-pembayaran"><h2>Pembayaran</h2><dl><dt>Midtrans</dt><dd>{d.pembayaran.mode}</dd><dt>Metode</dt><dd>Tunai, Transfer Manual, QRIS Midtrans</dd><dt>Verifikasi</dt><dd>{d.pembayaran.verifikasi}</dd></dl><p className="keuangan-keterangan">Konfigurasi provider dikelola privat di server. Tidak tersedia penyuntingan credential di halaman ini.</p></section></Card></div>
      <Card className="keuangan-panel"><section id="pengaturan-membership"><h2>Membership</h2><p className="keuangan-keterangan">Satu paket global {d.membership.bulan} bulan. Perubahan harga berlaku untuk transaksi baru; histori dan pembayaran pending tetap memakai nominal semula.</p>
        {d.membership.layananGratis && <p>Manfaat tersimpan: #{d.membership.layananGratis.id} — {d.membership.layananGratis.nama}{!d.membership.layananGratis.aktif && " (tidak aktif)"}.</p>}
        <form className="cp-form" onSubmit={async e => { e.preventDefault(); if (sibuk || !admin) return; aturSibuk(true); aturPesan(""); try { await api.put("/management/memberships/package", { harga, layananGratisId: layananId }); await Promise.all([klien.invalidateQueries({ queryKey: ["pengaturan-operasional"] }), klien.invalidateQueries({ queryKey: ["memberships"] })]); aturPesan("Pengaturan paket tersimpan."); } catch (e) { aturPesan(pesanError(e)); } finally { aturSibuk(false); } }}>
          <label>Harga paket (Rp)<Input type="number" min={1} max={2147483647} required disabled={!admin || sibuk} value={harga} onChange={e => aturHarga(Number(e.target.value))}/></label>
          <label>Layanan gratis dalam paket<Select required disabled={!admin || sibuk || !layanan.isSuccess} value={layananId} onChange={e => aturLayanan(Number(e.target.value))}><option value={0}>Pilih layanan</option>{layanan.data?.map(l => <option key={l.id} value={l.id} disabled={!l.aktif}>#{l.id} — {l.nama}{!l.aktif ? " (tidak aktif)" : ""}</option>)}</Select></label>
          <p className="keuangan-keterangan">Mapping mengikuti ID katalog sebenarnya; setelah ada penjualan, identitas layanan paket dikunci oleh backend.</p>{admin && <Button type="submit" disabled={sibuk || !layananId || !Number.isSafeInteger(harga) || harga <= 0 || !layanan.isSuccess}>Simpan Paket Membership</Button>}{pesan && <p role="status">{pesan}</p>}
        </form></section></Card>
    </>}
  </div>;
}
