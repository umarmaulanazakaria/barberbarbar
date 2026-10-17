import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { rupiah } from "../lib/format";
import { waktuWib } from "../lib/pesanan-terpadu";
import { statusDokumen, sumberDokumen, type Dokumen } from "../lib/dokumen-keuangan";
import { Button, Card, Empty, ErrorState, Input, LoadingState, PageTitle, Select } from "../components/ui";
import DetailDokumenKeuangan from "../components/DetailDokumenKeuangan";
import "../components/Keuangan.css";
export default function InvoicesPage() {
 const [cari, aturCari] = useState(""), [sumber, aturSumber] = useState("SEMUA"), [status, aturStatus] = useState("SEMUA"), [halaman, aturHalaman] = useState(1), [pilih, aturPilih] = useState<string | null>(null);
 const data = useQuery({ queryKey: ["invoices", cari, sumber, status, halaman], queryFn: async () => (await api.get<{data:Dokumen[];total:number}>("/management/finance/documents", {params:{cari,sumber,status,halaman}})).data });
 return <><PageTitle title="Invoice" subtitle="Dokumen otomatis dari transaksi Booking, Walk-in, dan Membership."/>
 <div className="keuangan-filter"><Input aria-label="Cari invoice atau pelanggan" placeholder="Cari nomor, pelanggan..." value={cari} onChange={e=>{aturCari(e.target.value);aturHalaman(1)}}/><Select aria-label="Sumber transaksi" value={sumber} onChange={e=>{aturSumber(e.target.value);aturHalaman(1)}}><option value="SEMUA">Semua sumber</option>{["BOOKING","WALK_IN","MEMBERSHIP"].map(v=><option key={v} value={v}>{sumberDokumen(v)}</option>)}</Select><Select aria-label="Status pembayaran" value={status} onChange={e=>{aturStatus(e.target.value);aturHalaman(1)}}><option value="SEMUA">Semua status</option>{Object.entries(statusDokumen).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select></div>
 <Card className="overflow-hidden">{data.isPending?<LoadingState text="Memuat invoice..."/>:data.isError?<ErrorState text="Invoice belum dapat dimuat." onRetry={()=>void data.refetch()}/>:!data.data?.data.length?<Empty text="Tidak ada dokumen sesuai filter."/>:<div className="overflow-x-auto"><table className="keuangan-table"><thead><tr>{["Nomor / Referensi","Pelanggan","Sumber","Tanggal - WIB","Nominal","Status",""].map((h,i)=><th key={i}>{h}</th>)}</tr></thead><tbody>{data.data.data.map(d=><tr key={d.id}><td><strong>{d.nomor}</strong><div className="text-xs text-slate-500">{d.referensi}{!d.final?" - Tagihan belum final":""}</div></td><td>{d.pelanggan}</td><td>{sumberDokumen(d.sumber)}</td><td>{waktuWib(d.tanggal)}</td><td>{rupiah(d.total)}</td><td><span className={"keuangan-status "+d.status}>{statusDokumen[d.status]}</span></td><td><Button variant="secondary" onClick={()=>aturPilih(d.id)}>Detail</Button></td></tr>)}</tbody></table></div>}
 <div className="keuangan-footer"><span>{data.data?.total??0} dokumen</span><Button variant="secondary" disabled={halaman<=1} onClick={()=>aturHalaman(v=>v-1)}>Sebelumnya</Button><span>{halaman}</span><Button variant="secondary" disabled={halaman*20>=(data.data?.total??0)} onClick={()=>aturHalaman(v=>v+1)}>Berikutnya</Button></div></Card>{pilih&&<DetailDokumenKeuangan id={pilih} onClose={()=>aturPilih(null)}/>}</>;
}
