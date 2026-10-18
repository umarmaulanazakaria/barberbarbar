import { Link, useLocation } from "react-router-dom";
import type { EntriPesanan } from "../lib/pesanan-terpadu";
import { waktuWib } from "../lib/pesanan-terpadu";
import { rupiah } from "../lib/format";
import { Empty, StatusBadge } from "./ui";
export default function TabelPesananTerpadu({data,tampilan="lengkap"}:{data:EntriPesanan[];tampilan?:"lengkap"|"dashboard"|"mendatang"|"pesanan"}) {
 const lokasi=useLocation();
 const tujuan=(b:EntriPesanan)=>{const q=new URLSearchParams(lokasi.search);q.delete("rincianBooking");q.delete("rincianPesanan");q.set(b.bookingId!==null?"rincianBooking":"rincianPesanan",String(b.bookingId??b.pesananId));return `${lokasi.pathname}?${q}`;};
 if(!data.length)return <Empty text="Tidak ada pesanan sesuai tanggal dan filter."/>;
 const ringkas=tampilan==="dashboard"||tampilan==="mendatang";
 return <><div className="order-desktop"><table className="order-table text-left"><colgroup>{(ringkas?[34,25,26,15]:[28,22,24,17,9]).map((n,i)=><col key={i} style={{width:`${n}%`}}/>)}</colgroup><thead><tr><th>Pelanggan</th><th>Jadwal · WIB</th><th>Status</th><th className="amount">Total</th>{!ringkas&&<th><span className="sr-only">Aksi</span></th>}</tr></thead><tbody>{data.map(b=><tr key={`${b.jenis}:${b.id}`} onClick={e=>{if(e.target instanceof Element&&!e.target.closest("a,button,input"))e.currentTarget.querySelector<HTMLAnchorElement>("a")?.click();}}><td><Link to={tujuan(b)} className="order-primary order-link" aria-label={`Rincian ${b.pelanggan}`}>{b.pelanggan}</Link><small>{b.nomor} · {b.jenis==="BOOKING"?"Booking":"Walk-in"}</small>{b.nomorInvoice&&<small>{b.nomorInvoice}</small>}</td><td>{waktuWib(b.jadwal).replace(" WIB","")}<small>{b.barber??"Barber belum ditentukan"}</small></td><td><StatusBadge value={b.status}/><small><StatusBadge value={b.statusPembayaran}/></small></td><td className="amount">{rupiah(b.total)}</td>{!ringkas&&<td><Link to={tujuan(b)} className="order-link" aria-label={`Detail ${b.nomor}`}>Detail</Link></td>}</tr>)}</tbody></table></div>
 <div className="order-mobile">{data.map(b=><Link to={tujuan(b)} key={`${b.jenis}:${b.id}`} className="order-mobile-item" aria-label={`Rincian ${b.nomor}`}><div><span><strong>{b.pelanggan}</strong><small>{b.nomor} · {b.jenis==="BOOKING"?"Booking":"Walk-in"}</small></span><StatusBadge value={b.status}/></div><small>{waktuWib(b.jadwal)}</small><small>{b.barber??"Barber belum ditentukan"}</small><div className="order-mobile-bottom"><StatusBadge value={b.statusPembayaran}/><strong>{rupiah(b.total)}</strong></div></Link>)}</div></>;
}
