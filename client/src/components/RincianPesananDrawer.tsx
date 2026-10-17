import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, RefreshCw, X } from "lucide-react";
import { api } from "../lib/api";
import { ambilBooking, ambilPembayaranBooking } from "../lib/booking";
import { useFokusDialog } from "../lib/fokus-dialog";
import { rupiah } from "../lib/format";
import { waktuWib } from "../lib/pesanan-terpadu";
import { statusRamah } from "../lib/teks";
import type { Barber, Pelanggan, Pesanan } from "../types";
import { Button, ErrorState, LoadingState, StatusBadge } from "./ui";

export default function RincianPesananDrawer() {
  const [params, aturParams] = useSearchParams();
  const bookingId = Number(params.get("rincianBooking")), pesananId = Number(params.get("rincianPesanan"));
  const id = bookingId || pesananId;
  const terbuka = Number.isSafeInteger(id) && id > 0;
  const tutup = useCallback(() => { aturParams(p => { const next = new URLSearchParams(p); next.delete("rincianBooking"); next.delete("rincianPesanan"); return next; }, {replace:true}); }, [aturParams]);
  const panel = useFokusDialog(terbuka);
  const booking = useQuery({queryKey:["booking",bookingId],queryFn:()=>ambilBooking(bookingId),enabled:terbuka&&!!bookingId,refetchInterval:15000});
  const pembayaran = useQuery({queryKey:["booking-payments",bookingId],queryFn:()=>ambilPembayaranBooking(bookingId),enabled:terbuka&&!!bookingId,refetchInterval:15000});
  const pesananTerkaitId = bookingId ? booking.data?.pesananId : pesananId;
  const pesanan = useQuery({queryKey:["order",pesananTerkaitId],queryFn:async()=>(await api.get<Pesanan>(`/orders/${pesananTerkaitId}`)).data,enabled:terbuka&&!!pesananTerkaitId,refetchInterval:15000});
  const pelangganId=booking.data?.pelanggan.id;
  const kontak = useQuery({queryKey:["customers","detail",pelangganId],queryFn:async()=>(await api.get<Pelanggan>(`/pelanggan/${pelangganId}`)).data,enabled:terbuka&&!!bookingId&&!!pelangganId&&!booking.data?.aksesTamu});
  const barberId=booking.data?.barberFinalId??booking.data?.barberDisetujuiId??booking.data?.barberPilihanId;
  const barber=useQuery({queryKey:["barbers"],queryFn:async()=>(await api.get<Barber[]>("/barbers")).data,enabled:terbuka&&!!bookingId&&!!barberId});
  useEffect(()=>{
    if(!terbuka)return;
    const shell=document.querySelector<HTMLElement>(".admin-shell"), lama=document.body.style.overflow, inertLama=shell?.inert;
    if(shell)shell.inert=true;
    document.body.style.overflow="hidden";
    const escape=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!e.defaultPrevented){e.preventDefault();tutup();}};
    window.addEventListener("keydown",escape);
    return()=>{if(shell)shell.inert=inertLama??false;document.body.style.overflow=lama;window.removeEventListener("keydown",escape);};
  },[terbuka,tutup]);
  if(!terbuka)return null;
  const b=booking.data, p=pesanan.data, sumber=bookingId?booking:pesanan;
  const judul=bookingId?b?.nomorBooking:p?.nomorPesanan, status=bookingId?b?.status:p?.status;
  const nama=bookingId?(b?.aksesTamu?.nama??b?.pelanggan.nama):p?.pelanggan.nama;
  const telepon=bookingId?(b?.aksesTamu?.nomorTelepon??kontak.data?.nomorTelepon):p?.pelanggan.nomorTelepon;
  const jadwal=bookingId?b?.mulaiPada:p?.checkInTime;
  const namaBarber=bookingId?(barberId?barber.data?.find(v=>v.id===barberId)?.nama:undefined):p?.barber?.nama;
  const items=(bookingId?(p?.items??b?.items):p?.items)??[];
  const riwayat=bookingId?(b?.riwayat.map(r=>({label:statusRamah(r.aksi),waktu:r.dibuatPada}))??[]):(p?.riwayatStatus?.map(r=>({label:statusRamah(r.status),waktu:r.diubahPada}))??[]);
  const dibuat=bookingId?b?.dibuatPada:p?.dibuatPada;
  const pembayaranLegacySah=p?.statusPembayaran==="PAID"&&!!p.pembayaran;
  const finansial=bookingId?pembayaran.data:p?{total:p.total,jumlahDibayar:pembayaranLegacySah?p.total:0,balance:pembayaranLegacySah?0:p.total,statusPembayaran:p.statusPembayaran}:undefined;
  const penuh=new URLSearchParams(params);penuh.delete("rincianBooking");penuh.delete("rincianPesanan");penuh.set("pesananId",String(pesananId));
  return createPortal(<><div className="quick-backdrop" aria-hidden="true" onClick={tutup}/><div ref={panel} role="dialog" aria-modal="true" aria-label="Rincian pesanan" className="quick-drawer" tabIndex={-1}>
    <header className="quick-header"><div><p>{bookingId?"Booking":"Walk-in"}</p><h2>{judul??"Memuat rincian…"}</h2>{status&&<StatusBadge value={status}/>}</div><button className="quick-close" aria-label="Tutup rincian pesanan" onClick={tutup}><X size={19}/></button></header>
    <div className="quick-body">{sumber.isPending?<LoadingState text="Memuat rincian…"/>:sumber.isError?<ErrorState text="Rincian belum dapat dimuat." onRetry={()=>void sumber.refetch()}/>:<>
      <section className="quick-section"><h3>Pelanggan & jadwal</h3><dl className="quick-meta"><div><dt>Nama</dt><dd>{nama??"—"}</dd></div><div><dt>Kontak</dt><dd>{telepon??(kontak.isFetching?"Memuat…":"Tidak tersedia")}</dd></div><div><dt>Tanggal · WIB</dt><dd>{jadwal?new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",dateStyle:"medium"}).format(new Date(jadwal)):"—"}</dd></div><div><dt>Jam · WIB</dt><dd>{jadwal?new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",timeStyle:"short"}).format(new Date(jadwal)):"—"}</dd></div><div><dt>Barber {b?.barberFinalId?"final":""}</dt><dd>{namaBarber??(barberId?"Memuat…":"Belum ditentukan")}</dd></div></dl></section>
      <section className="quick-section"><h3>{bookingId&&pesananTerkaitId?"Layanan aktual":"Layanan"}</h3>{bookingId&&pesananTerkaitId&&(pesanan.isPending||pesanan.isError)?(pesanan.isPending?<LoadingState text="Memuat layanan aktual?"/>:<ErrorState text="Layanan aktual belum dapat dimuat." onRetry={()=>void pesanan.refetch()}/>):items.map((i,index)=><div className="quick-item" key={`${i.layananId}:${index}`}><div>{i.namaLayanan}<small>{i.qty} × {rupiah(i.harga)}</small></div><strong>{rupiah(i.subtotal)}</strong></div>)}</section>
      <section className="quick-section"><h3>Pembayaran</h3>{bookingId&&pembayaran.isPending?<LoadingState text="Memuat pembayaran…"/>:bookingId&&pembayaran.isError?<ErrorState text="Status pembayaran belum dapat dipastikan." onRetry={()=>void pembayaran.refetch()}/>:finansial?<><dl className="quick-money"><div><dt>Total tagihan</dt><dd>{rupiah(finansial.total)}</dd></div><div><dt>Pembayaran diterima</dt><dd>{rupiah(finansial.jumlahDibayar)}</dd></div><div className="balance"><dt>Sisa tagihan</dt><dd>{rupiah(finansial.balance)}</dd></div></dl><div className="mt-3"><StatusBadge value={finansial.statusPembayaran}/></div><p className="quick-help">Hanya pembayaran terverifikasi yang dihitung.</p></>:null}</section>
      <section className="quick-section"><h3>Perkembangan</h3><ol className="quick-timeline">{dibuat&&<li>Dibuat<time dateTime={dibuat}>{waktuWib(dibuat)}</time></li>}{riwayat.slice(-3).map((r,i)=><li key={`${r.waktu}:${i}`}>{r.label}<time dateTime={r.waktu}>{waktuWib(r.waktu)}</time></li>)}</ol>{riwayat.length>3&&<p className="quick-help">Riwayat lengkap tersedia pada detail.</p>}</section>
      {(b?.catatan||p?.catatan||b?.alasanPenolakan)&&<section className="quick-section"><details><summary>Catatan & informasi lanjutan</summary><p>{b?.catatan??p?.catatan}</p>{b?.alasanPenolakan&&<p>Alasan penolakan: {b.alasanPenolakan}</p>}</details></section>}
    </>}</div><footer className="quick-footer"><Button variant="secondary" aria-label="Perbarui rincian" disabled={sumber.isFetching||!!bookingId&&pembayaran.isFetching} onClick={()=>{void sumber.refetch();if(bookingId)void pembayaran.refetch();if(pesananTerkaitId)void pesanan.refetch();}}><RefreshCw size={15}/>Perbarui</Button>{!sumber.isError&&judul&&<Link className="ui-button ui-button-primary inline-flex items-center justify-center gap-2" to={bookingId?`/orders/booking/${bookingId}`:`?${penuh}`}>{bookingId?"Kelola booking":"Detail & tindakan"}<ArrowUpRight size={16}/></Link>}</footer>
  </div></>,document.body);
}
