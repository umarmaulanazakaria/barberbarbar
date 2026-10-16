import { Link, useLocation } from "react-router-dom";
import type { EntriPesanan } from "../lib/pesanan-terpadu";
import { waktuWib } from "../lib/pesanan-terpadu";
import { rupiah } from "../lib/format";
import { Empty, StatusBadge } from "./ui";
export default function TabelPesananTerpadu({ data }: { data: EntriPesanan[] }) {
  const lokasi = useLocation();
  const tujuanWalkIn = (id: number | null) => { const q = new URLSearchParams(lokasi.pathname === "/history" || lokasi.pathname === "/orders" ? lokasi.search : ""); q.set("pesananId",String(id)); return `${lokasi.pathname === "/history" ? "/history" : "/orders"}?${q}`; };
  if (!data.length) return <Empty text="Tidak ada pesanan sesuai tanggal dan filter." />;
  return <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{["Pesanan / Booking","Pelanggan","Jenis","Jadwal pelayanan","Barber","Status","Pembayaran","Check-in","Total","Aksi"].map(j=><th key={j} className="px-3 py-3">{j}</th>)}</tr></thead><tbody>
    {data.map(b=>{const tujuan=b.bookingId!==null?`/orders/booking/${b.bookingId}`:tujuanWalkIn(b.pesananId);return <tr key={`${b.jenis}:${b.id}`} className="border-t border-slate-100 hover:bg-indigo-50/70">
      <td className="px-3 py-3"><Link className="font-bold text-indigo-600" to={tujuan}>{b.nomor}</Link>{b.bookingId!==null && b.nomorPesanan && <small className="block text-slate-500">{b.nomorPesanan}</small>}{b.nomorInvoice && <small className="block text-slate-500">{b.nomorInvoice}</small>}</td><td className="px-3">{b.pelanggan}</td><td className="px-3">{b.jenis==="BOOKING"?"Booking":"Walk-in"}</td><td className="px-3">{waktuWib(b.jadwal)}</td><td className="px-3">{b.barber??"Belum ditentukan"}</td><td className="px-3"><StatusBadge value={b.status}/></td><td className="px-3"><StatusBadge value={b.statusPembayaran}/></td><td className="px-3">{b.checkIn?waktuWib(b.checkIn):"—"}</td><td className="px-3">{rupiah(b.total)}</td><td className="px-3"><Link aria-label={`Detail ${b.nomor}`} className="font-bold text-indigo-600" to={tujuan}>Detail</Link></td>
    </tr>})}</tbody></table></div>;
}
