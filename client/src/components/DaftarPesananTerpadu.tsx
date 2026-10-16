import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ambilPesananTerpadu, useHariOperasional } from "../lib/pesanan-terpadu";
import { statusRamah } from "../lib/teks";
import { Button, Card, ErrorState, Input, LoadingState, PageTitle, Select } from "./ui";
import TabelPesananTerpadu from "./TabelPesananTerpadu";
import NewOrderModal from "./NewOrderModal";
import OrderDetailModal from "./OrderDetailModal";
const status = ["WAITING","AWAITING_DP","PENDING_CONFIRMATION","CONFIRMED","CHECKED_IN","IN_SERVICE","COMPLETED","CANCELLED","REJECTED","NO_SHOW"];
export default function DaftarPesananTerpadu({ riwayat=false }: { riwayat?: boolean }) {
  const [params, aturParams] = useSearchParams(), [baru, aturBaru] = useState(false), [serverTime, aturServerTime] = useState<string>();
  const hari = useHariOperasional(serverTime);
  const filter = { jenis: params.get("jenis")??"SEMUA", periode: params.get("periode")??(riwayat?"RIWAYAT":"HARI_INI"), status: params.get("status")??"SEMUA", pembayaran: params.get("pembayaran")??"SEMUA", cari: params.get("cari")??"", ...(params.get("mulai")?{mulai:params.get("mulai")!}:{}), ...(params.get("selesai")?{selesai:params.get("selesai")!}:{}), halaman:Number(params.get("halaman"))||1, batas:20 };
  const lengkap=filter.periode!=="RENTANG" || !!params.get("mulai") && !!params.get("selesai");
  const daftar=useQuery({queryKey:["orders","terpadu",riwayat,hari,filter], queryFn:async()=>{const d=await ambilPesananTerpadu(filter);aturServerTime(d.serverTime);return d;},enabled:lengkap,refetchInterval:15000});
  const ubah=(key:string,value:string)=>{const p=new URLSearchParams(params);if(value)p.set(key,value);else p.delete(key);p.delete("halaman");aturParams(p);};
  const pilih=(id:number|null)=>{const p=new URLSearchParams(params);if(id!==null)p.set("pesananId",String(id));else p.delete("pesananId");aturParams(p);};
  const nomor=Number(params.get("pesananId")), total=daftar.data?.total??0, halaman=filter.halaman;
  return <><PageTitle title={riwayat?"Riwayat Pesanan":"Pesanan"} subtitle={riwayat?"Telusuri layanan, booking, pembayaran dan invoice pada tanggal sebelumnya":"Booking pelanggan dan walk-in dalam satu pusat operasional"} action={!riwayat?<Button onClick={()=>aturBaru(true)}>+ Pesanan Baru</Button>:undefined}/>
    <Card><div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-3"><Input aria-label="Cari pesanan" placeholder="Nomor booking / pesanan / pelanggan" value={filter.cari} onChange={e=>ubah("cari",e.target.value)}/>
      <Select aria-label="Jenis pesanan" value={filter.jenis} onChange={e=>ubah("jenis",e.target.value)}><option value="SEMUA">Semua jenis</option><option value="BOOKING">Booking</option><option value="WALK_IN">Walk-in</option></Select>
      <Select aria-label="Tanggal pesanan" value={filter.periode} onChange={e=>ubah("periode",e.target.value)}><option value="HARI_INI">Hari ini (WIB)</option><option value="SEMUA">Semua tanggal</option><option value="RENTANG">Tanggal / rentang lain</option><option value="RIWAYAT">Sebelum hari ini (WIB)</option></Select>
      {filter.periode==="RENTANG" && <><Input type="date" aria-label="Dari tanggal" value={params.get("mulai")??""} onChange={e=>ubah("mulai",e.target.value)}/><Input type="date" aria-label="Sampai tanggal" value={params.get("selesai")??""} onChange={e=>ubah("selesai",e.target.value)}/></>}
      <Select aria-label="Status pesanan" value={filter.status} onChange={e=>ubah("status",e.target.value)}><option value="SEMUA">Semua status</option>{status.map(s=><option key={s} value={s}>{statusRamah(s)}</option>)}</Select>
      <Select aria-label="Status pembayaran" value={filter.pembayaran} onChange={e=>ubah("pembayaran",e.target.value)}><option value="SEMUA">Semua pembayaran</option><option value="UNPAID">Belum lunas</option><option value="PAID">Lunas</option></Select><Button variant="secondary" disabled={daftar.isFetching||!lengkap} onClick={()=>void daftar.refetch()}>Perbarui</Button></div>
      {!lengkap?<p className="p-4 text-sm">Pilih tanggal mulai dan selesai.</p>:daftar.isPending?<LoadingState/>:daftar.isError?<ErrorState text="Daftar pesanan belum dapat dimuat. Periksa filter tanggal dan coba lagi." onRetry={()=>void daftar.refetch()}/>:<TabelPesananTerpadu data={daftar.data.data} tampilan={riwayat?"lengkap":"pesanan"}/>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm"><span aria-live="polite">{total} pesanan · Halaman {halaman} dari {Math.max(1,Math.ceil(total/20))}</span><div className="flex gap-2"><Button variant="secondary" disabled={halaman<=1||daftar.isFetching} onClick={()=>{const p=new URLSearchParams(params);p.set("halaman",String(halaman-1));aturParams(p)}}>Sebelumnya</Button><Button variant="secondary" disabled={halaman*20>=total||daftar.isFetching} onClick={()=>{const p=new URLSearchParams(params);p.set("halaman",String(halaman+1));aturParams(p)}}>Berikutnya</Button></div></div></Card>
    {!riwayat && <NewOrderModal open={baru} onClose={()=>aturBaru(false)} onCreated={pilih}/>}<OrderDetailModal orderId={Number.isSafeInteger(nomor)&&nomor>0?nomor:null} onClose={()=>pilih(null)}/>
  </>;
}
