import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { rupiah } from "../lib/format";
import { metodeDokumen } from "../lib/dokumen-keuangan";
import { Button, Card, ErrorState, Input, LoadingState, PageTitle } from "../components/ui";
import "../components/Keuangan.css";
type Laporan = { perluPemeriksaan: number; pendapatan: number; booking: number; walkIn: number; membership: number; penerimaanBruto: number; koreksiRefund: number;
  metode: { nama: string; nominal: number }[]; tren: { tanggal: string; nominal: number }[];
  layanan: { id: number; nama: string; jumlah: number }[]; barber: { id: number | null; nama: string; kunjungan: number; nilai: number }[] };
const hariWib = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
export default function ReportsPage() {
  const [mulai, aturMulai] = useState(hariWib), [sampai, aturSampai] = useState(hariWib);
  const valid = !!mulai && !!sampai && mulai <= sampai && Date.parse(sampai) - Date.parse(mulai) <= 366 * 86400000;
  const data = useQuery({ queryKey: ["reports", "keuangan", mulai, sampai], queryFn: async () => (await api.get<Laporan>("/management/finance/reports", { params: { mulai, sampai } })).data, enabled: valid });
  const periode = (v: string) => { const hari = hariWib(), awal = new Date(`${hari}T00:00:00Z`); if (v === "7") awal.setUTCDate(awal.getUTCDate() - 6); if (v === "BULAN") awal.setUTCDate(1); aturMulai(awal.toISOString().slice(0, 10)); aturSampai(hari); };
  const d = data.data, maksimum = Math.max(1, ...(d?.tren.map(t => Math.abs(t.nominal)) ?? []));
  const titik = d?.tren.map((t, i) => `${30 + (i / Math.max(1, d.tren.length - 1)) * 840},${120 - t.nominal / maksimum * 95}`).join(" ");
  return <><PageTitle title="Laporan" subtitle="Penerimaan terverifikasi dan pelayanan selesai, berdasarkan tanggal WIB."/>
    <div className="keuangan-filter"><Button variant="secondary" onClick={() => periode("HARI")}>Hari ini</Button><Button variant="secondary" onClick={() => periode("7")}>7 hari</Button><Button variant="secondary" onClick={() => periode("BULAN")}>Bulan ini</Button><label>Dari<Input aria-label="Tanggal mulai" type="date" value={mulai} onChange={e => aturMulai(e.target.value)}/></label><label>Sampai<Input aria-label="Tanggal akhir" type="date" value={sampai} onChange={e => aturSampai(e.target.value)}/></label></div>
    {!valid ? <p role="alert">Pilih rentang tanggal yang valid, maksimal 366 hari.</p> : data.isPending ? <LoadingState text="Memuat laporan..."/> : data.isError ? <ErrorState text="Laporan belum dapat dimuat." onRetry={() => void data.refetch()}/> : d && <>
      <div className="keuangan-kpi">{([["Pendapatan bersih", d.pendapatan], ["Booking", d.booking], ["Walk-in", d.walkIn], ["Membership", d.membership]] as const).map(([l, n]) => <div key={l}><span>{l}</span><strong>{rupiah(n)}</strong></div>)}</div>
      <p className="keuangan-keterangan">Penerimaan bruto {rupiah(d.penerimaanBruto)} · Pengurang refund/koreksi terverifikasi {rupiah(d.koreksiRefund)}. DP dan pelunasan dihitung masing-masing satu kali. Pending, gagal, kedaluwarsa, dan manfaat gratis bukan penerimaan.</p>
      {d.perluPemeriksaan > 0 && <p className="cp-warning">Ada {d.perluPemeriksaan} dokumen historis lintas periode yang bukti penerimaannya perlu pemeriksaan Admin; tidak dimasukkan ke pendapatan terverifikasi.</p>}
      <Card className="keuangan-panel"><h2>Tren penerimaan bersih</h2><svg className="keuangan-grafik" viewBox="0 0 900 255" role="img" aria-label="Tren pendapatan bersih per hari dalam WIB"><line x1="30" y1="120" x2="870" y2="120" stroke="#cbd5e1"/><polyline points={titik} fill="none" stroke="#334e7c" strokeWidth="3"/>{d.tren.map((t, i) => <g key={t.tanggal}><circle cx={30 + i / Math.max(1, d.tren.length - 1) * 840} cy={120 - t.nominal / maksimum * 95} r="3" fill="#334e7c"><title>{t.tanggal}: {rupiah(t.nominal)}</title></circle>{(i === 0 || i === d.tren.length - 1) && <text x={i === 0 ? 30 : 870} y="248" textAnchor={i === 0 ? "start" : "end"} fontSize="12">{t.tanggal}</text>}</g>)}</svg><details><summary>Rincian harian</summary><table className="keuangan-table"><tbody>{d.tren.map(t => <tr key={t.tanggal}><td>{t.tanggal}</td><td>{rupiah(t.nominal)}</td></tr>)}</tbody></table></details></Card>
      <div className="keuangan-grid mt-4"><Card className="keuangan-panel"><h2>Metode pembayaran</h2>{!d.metode.length && <p>Belum ada penerimaan.</p>}{d.metode.map(m => <div className="flex justify-between py-3" key={m.nama}><span>{metodeDokumen(m.nama)}</span><strong>{rupiah(m.nominal)}</strong></div>)}</Card><Card className="keuangan-panel"><h2>Layanan terlaris</h2><p className="keuangan-keterangan">Jumlah unit layanan pada kunjungan selesai, termasuk manfaat Member gratis.</p><table className="keuangan-table"><thead><tr><th>Layanan</th><th>Jumlah</th></tr></thead><tbody>{d.layanan.map(l => <tr key={l.id}><td>{l.nama}</td><td>{l.jumlah}</td></tr>)}</tbody></table>{!d.layanan.length && <p>Belum ada layanan selesai.</p>}</Card></div>
      <Card className="keuangan-panel mt-4"><h2>Performa Barber</h2><p className="keuangan-keterangan">Berdasarkan tanggal pelayanan selesai. Nilai layanan setelah diskon bukan komisi atau penerimaan kas pada tanggal yang sama. Penjualan Membership tidak termasuk.</p><div className="overflow-x-auto"><table className="keuangan-table"><thead><tr><th>Barber</th><th>Kunjungan selesai</th><th>Nilai layanan</th></tr></thead><tbody>{d.barber.map(b => <tr key={b.id ?? "tanpa"}><td>{b.nama}</td><td>{b.kunjungan}</td><td>{rupiah(b.nilai)}</td></tr>)}</tbody></table>{!d.barber.length && <p>Belum ada kunjungan selesai.</p>}</div></Card>
    </>}
  </>;
}
