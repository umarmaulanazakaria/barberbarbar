import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock3, Scissors, UserRoundCheck, WalletCards, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import NewOrderModal from "../components/NewOrderModal";
import OrderDetailModal from "../components/OrderDetailModal";
import { ambilPesananTerpadu, useHariOperasional } from "../lib/pesanan-terpadu";
import TabelPesananTerpadu from "../components/TabelPesananTerpadu";
import { rupiah } from "../lib/format";
import { Button, Card, ContentPanel, ErrorState, LoadingState, Select, StatCard } from "../components/ui";
export default function DashboardPage(){
 const [newOrderOpen,setNewOrderOpen]=useState(false),[selectedOrderId,setSelectedOrderId]=useState<number|null>(null),[serverTime,aturServerTime]=useState<string>(),[periode,aturPeriode]=useState("HARI_INI");
 const hari=useHariOperasional(serverTime);
 const {data:terpadu,isLoading,isError,refetch}=useQuery({queryKey:["dashboard","terpadu",hari],queryFn:async()=>{const d=await ambilPesananTerpadu({periode:"HARI_INI",batas:7,ringkasan:"true"});aturServerTime(d.serverTime);return d;},refetchInterval:15000});
 const mendatang=useQuery({queryKey:["dashboard","mendatang",hari],queryFn:()=>ambilPesananTerpadu({periode:"MENDATANG",batas:7}),refetchInterval:15000});
 const data=terpadu?.metrik;
 return <><header className="dashboard-intro"><div><h1>Dashboard</h1><p>Operasional hari ini · {hari} WIB</p></div><Button onClick={()=>setNewOrderOpen(true)}><Plus size={16}/>Pesanan Baru</Button></header>
 {isLoading?<Card><LoadingState text="Memuat dashboard..."/></Card>:isError?<Card><ErrorState text="Dashboard belum dapat dimuat." onRetry={()=>void refetch()}/></Card>:<>
 <div className="stat-grid"><StatCard label="Pesanan menunggu" value={data?.waiting??"—"} icon={<Clock3 size={16}/>} catatan="Menunggu pelayanan"/><StatCard label="Sedang dilayani" value={data?.inService??"—"} icon={<Scissors size={16}/>} catatan="Pelayanan berlangsung"/><StatCard label="Selesai, belum lunas" value={data?.completedUnpaid??"—"} icon={<WalletCards size={16}/>} catatan="Perlu pelunasan"/><StatCard label="Pembayaran hari ini" value={data?.paidToday??"—"} icon={<UserRoundCheck size={16}/>} catatan="Transaksi lunas tercatat"/></div>
 <div className="dashboard-grid"><ContentPanel title="Aktivitas booking & pesanan" description="Pilih pelanggan untuk melihat rincian." action={<Select aria-label="Periode aktivitas" value={periode} onChange={e=>aturPeriode(e.target.value)}><option value="HARI_INI">Hari ini</option><option value="MENDATANG">Mendatang</option></Select>}>
 {periode==="HARI_INI"?<TabelPesananTerpadu data={terpadu?.data??[]} tampilan="dashboard"/>:mendatang.isPending?<LoadingState text="Memuat jadwal mendatang..."/>:mendatang.isError?<ErrorState text="Jadwal mendatang belum dapat dimuat." onRetry={()=>void mendatang.refetch()}/>:<TabelPesananTerpadu data={mendatang.data.data} tampilan="mendatang"/>}
 <div className="flex justify-end border-t border-slate-100 px-5 py-3"><Link className="inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-indigo-600" to={periode==="MENDATANG"?"/orders?periode=MENDATANG&jenis=BOOKING":"/orders"}>Lihat semua pesanan<ArrowRight size={14}/></Link></div></ContentPanel>
 <ContentPanel title="Perlu perhatian" description="Tindak lanjut operasional hari ini"><div className="attention-list"><Link to="/orders?status=WAITING"><span>Antrean pelayanan<small>Pesanan yang menunggu</small></span><strong>{data?.waiting??"—"}</strong></Link><Link to="/orders?status=COMPLETED&pembayaran=UNPAID"><span>Belum lunas<small>Layanan selesai, tagihan tersisa</small></span><strong>{data?.completedUnpaid??"—"}</strong></Link><Link to="/orders?periode=MENDATANG&jenis=BOOKING"><span>Jadwal mendatang<small>Lihat booking berikutnya</small></span><ArrowRight size={16}/></Link></div></ContentPanel></div>
 <div className="mt-4 grid gap-4 md:grid-cols-2"><Card className="dashboard-income"><span className="income-label"><WalletCards size={17}/>Pendapatan hari ini</span><strong>{data?rupiah(data.revenueToday):"—"}</strong><p>Pembayaran lunas yang tercatat hari ini. Transaksi pending tidak dihitung.</p></Card><ContentPanel title="Ringkasan barbershop"><div className="dashboard-resource"><div><span>Pelanggan aktif</span><strong>{data?.pelanggan??"—"}</strong></div><div><span>Barber aktif</span><strong>{data?.barberAktif??"—"}</strong></div><div><span>Layanan aktif</span><strong>{data?.layananAktif??"—"}</strong></div></div></ContentPanel></div></>}
 <NewOrderModal open={newOrderOpen} onClose={()=>setNewOrderOpen(false)} onCreated={id=>setSelectedOrderId(id)}/><OrderDetailModal orderId={selectedOrderId} onClose={()=>setSelectedOrderId(null)}/></>;
}
