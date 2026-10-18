import type { MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { EntriPesanan } from "../lib/pesanan-terpadu";
import { waktuWib } from "../lib/pesanan-terpadu";
import { rupiah } from "../lib/format";
import { StatusBadge } from "./ui";

const labelStatus: Record<string, string> = {
  WAITING: "Menunggu",
  PENDING_CONFIRMATION: "Menunggu",
  AWAITING_DP: "Menunggu DP",
  CONFIRMED: "Dikonfirmasi",
  CHECKED_IN: "Check-in",
  IN_SERVICE: "Dilayani",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
  REJECTED: "Ditolak",
  NO_SHOW: "Tidak hadir",
};
const jamWib = (iso: string) => new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(new Date(iso));
const jenisPesanan = (entri: EntriPesanan) => entri.jenis === "BOOKING" ? "Booking" : "Walk-in";
const kelasNama = "block font-semibold leading-5 text-slate-900 [overflow-wrap:anywhere]";

type Props = {
  data: EntriPesanan[];
  dashboard: boolean;
  mendatang?: boolean;
  tujuan: (entri: EntriPesanan) => string;
};

export default function RingkasanPesanan({ data, dashboard, mendatang = false, tujuan }: Props) {
  const navigasi = useNavigate();
  const bukaBaris = (event: MouseEvent<HTMLTableRowElement>, entri: EntriPesanan) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ||
      (event.target instanceof Element && event.target.closest("a"))) return;
    navigasi(tujuan(entri));
  };
  const jam = (entri: EntriPesanan) => mendatang ? new Intl.DateTimeFormat("id-ID", {timeZone:"Asia/Jakarta",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(entri.jadwal)) : dashboard ? jamWib(entri.jadwal) : waktuWib(entri.jadwal);
  const badge = (entri: EntriPesanan) => <StatusBadge value={entri.status} label={labelStatus[entri.status]} />;
  const visibilitasTabel = dashboard ? "hidden md:table" : "hidden lg:table";

  return <>
    <table aria-label={mendatang ? "Jadwal mendatang" : dashboard ? "Pesanan terbaru" : "Daftar pesanan"} className={`${visibilitasTabel} w-full table-fixed text-left text-sm`}>
      <colgroup>{(dashboard ? (mendatang ? [30, 24, 23, 23] : [36, 14, 27, 23]) : [24, 18, 18, 14, 16, 10]).map((lebar, i) => <col key={i} style={{ width: `${lebar}%` }} />)}</colgroup>
      <thead className="bg-slate-50 text-xs text-slate-500"><tr>
        {(dashboard ? ["Pelanggan", mendatang ? "Tanggal & Jam" : "Jam", "Barber", "Status"] : ["Pelanggan", "Jadwal", "Barber", "Status", "Pembayaran", "Aksi"]).map(label => <th key={label} scope="col" className="px-4 py-3 font-semibold">{label}</th>)}
      </tr></thead>
      <tbody>{data.map(entri => <tr key={`${entri.jenis}:${entri.id}`} onClick={event => bukaBaris(event, entri)} className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-indigo-50/60 focus-within:bg-indigo-50/60">
        <td className="px-4 py-4 align-top"><Link to={tujuan(entri)} className={`${kelasNama} rounded-sm hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600`}>{entri.pelanggan}</Link><span className="mt-1 block text-xs text-slate-500">{jenisPesanan(entri)}</span></td>
        <td className="px-4 py-4 align-top text-xs leading-5 text-slate-600"><time dateTime={entri.jadwal} className={dashboard && !mendatang ? "whitespace-nowrap font-medium tabular-nums" : "block"}>{jam(entri)}</time></td>
        <td className="px-4 py-4 align-top text-xs leading-5 text-slate-600 [overflow-wrap:anywhere]">{entri.barber ?? "Belum ditentukan"}</td>
        <td className="px-4 py-4 align-top">{badge(entri)}</td>
        {!dashboard && <><td className="px-4 py-4 align-top"><StatusBadge value={entri.statusPembayaran} /><span className="mt-1 block text-xs text-slate-500">{rupiah(entri.total)}</span></td><td className="px-4 py-4 align-top"><Link to={tujuan(entri)} className="rounded-sm text-xs font-semibold text-indigo-600 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-600">Detail</Link></td></>}
      </tr>)}</tbody>
    </table>

    <ul aria-label={mendatang ? "Jadwal mendatang" : dashboard ? "Pesanan terbaru" : "Daftar pesanan"} className={`${dashboard ? "md:hidden" : "lg:hidden"} divide-y divide-slate-100`}>
      {data.map(entri => <li key={`${entri.jenis}:${entri.id}`}><Link to={tujuan(entri)} className="block px-4 py-4 transition-colors hover:bg-indigo-50/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-600">
        <span className={kelasNama}>{entri.pelanggan}</span>
        <span className="mt-1 block text-xs text-slate-500">{jenisPesanan(entri)}</span>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><time dateTime={entri.jadwal} className="text-xs font-medium tabular-nums text-slate-600">{jam(entri)}</time>{badge(entri)}</div>
        <p className="mt-2 text-xs leading-5 text-slate-600 [overflow-wrap:anywhere]"><span className="text-slate-400">Barber: </span>{entri.barber ?? "Belum ditentukan"}</p>
        {!dashboard && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"><StatusBadge value={entri.statusPembayaran} /><span className="text-xs text-slate-500">{rupiah(entri.total)}</span></div>}
      </Link></li>)}
    </ul>
  </>;
}
