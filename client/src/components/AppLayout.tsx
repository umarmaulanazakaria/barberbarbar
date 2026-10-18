import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ChartNoAxesCombined, History, LayoutDashboard, Menu, Scissors, Settings, Users, UserRound, ReceiptText, Tags, LogOut, X, ShieldCheck, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import RealtimeOperator from "./RealtimeOperator";
import StrukOtomatis from "./StrukOtomatis";
import RincianPesananDrawer from "./RincianPesananDrawer";
const kelompok: readonly {nama:string;items:readonly (readonly [string,string,typeof LayoutDashboard])[]}[] = [
 {nama:"Operasional",items:[["Dashboard","/",LayoutDashboard],["Riwayat Pesanan","/history",History]]},
 {nama:"Barbershop",items:[["Pelanggan","/customers",Users],["Membership","/membership",Tags],["Barber","/barbers",UserRound],["Layanan","/services",Scissors]]},
 {nama:"Keuangan & sistem",items:[["Invoice","/invoices",ReceiptText],["Laporan","/reports",ChartNoAxesCombined],["Pengaturan","/settings",Settings]]},
] as const;
export default function AppLayout(){
 const [terbuka,aturTerbuka]=useState(false),[desktop,aturDesktop]=useState(()=>matchMedia("(min-width:1024px)").matches);
 const {user,logout}=useAuth(),lokasi=useLocation(),panel=useRef<HTMLElement>(null),pemicu=useRef<HTMLButtonElement>(null);
 const judul=kelompok.flatMap(k=>k.items).find(([,p])=>p==="/"?lokasi.pathname==="/":lokasi.pathname.startsWith(p))?.[0]??"Detail kunjungan";
 useEffect(()=>{const media=matchMedia("(min-width:1024px)");const ubah=()=>{aturDesktop(media.matches);if(media.matches)aturTerbuka(false);};media.addEventListener("change",ubah);return()=>media.removeEventListener("change",ubah);},[]);
 useEffect(()=>{aturTerbuka(false);},[lokasi.pathname]);
 useEffect(()=>{if(!terbuka)return;const lama=document.body.style.overflow;document.body.style.overflow="hidden";panel.current?.querySelector<HTMLButtonElement>('button')?.focus();return()=>{document.body.style.overflow=lama;pemicu.current?.focus();};},[terbuka]);
 return <div className={`admin-shell ${lokasi.pathname==="/"?"admin-dashboard":lokasi.pathname==="/history"?"admin-history":""}`}>{lokasi.pathname!=="/history"&&<RincianPesananDrawer/>}<a className="admin-skip no-print" href="#konten-admin">Lewati ke konten</a><RealtimeOperator/><StrukOtomatis/>
 {terbuka&&<button className="admin-backdrop no-print" aria-label="Tutup navigasi" onClick={()=>aturTerbuka(false)}/>}
 <aside ref={panel} id="navigasi-admin" className={`admin-sidebar no-print ${terbuka?"terbuka":""}`} inert={!desktop&&!terbuka?true:undefined} aria-hidden={!desktop&&!terbuka} role={terbuka?"dialog":undefined} aria-modal={terbuka?true:undefined} aria-label="Navigasi manajemen" onKeyDown={e=>{if(!terbuka)return;if(e.key==="Escape"){e.preventDefault();aturTerbuka(false);}if(e.key==="Tab"){const daftar=Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)')??[]).filter(el=>el.getClientRects().length);const awal=daftar[0],akhir=daftar.at(-1);if(e.shiftKey&&document.activeElement===awal){e.preventDefault();akhir?.focus();}else if(!e.shiftKey&&document.activeElement===akhir){e.preventDefault();awal?.focus();}}}}>
 <div className="admin-brand"><img src="/barber-barbar-icon.png" alt="" width="48" height="48"/><div><strong>BARBER BARBAR</strong><span>Manajemen barbershop</span></div><button className="admin-tutup" aria-label="Tutup menu" onClick={()=>aturTerbuka(false)}><X size={20}/></button></div>
 <nav aria-label="Navigasi utama">{kelompok.map(k=><div className="admin-menu-group" key={k.nama}><p>{k.nama}</p>{k.items.filter(([,p])=>p!=="/settings"||user?.role==="ADMIN").map(([nama,jalur,Ikon])=><NavLink key={jalur} to={jalur} end={jalur==="/"} className={({isActive})=>`admin-menu ${isActive?"aktif":""}`}><Ikon size={19}/><span>{nama}</span><ChevronRight className="admin-menu-panah" size={15}/></NavLink>)}</div>)}</nav>
 <div className="admin-operator"><div className="admin-avatar" aria-hidden="true">{user?.name.slice(0,1).toUpperCase()}</div><div><strong>{user?.name}</strong><span><ShieldCheck size={12}/>{user?.role==="ADMIN"?"Administrator":"Staf operasional"}</span></div><button onClick={logout} aria-label="Keluar dari akun" title="Keluar"><LogOut size={18}/></button></div>
 </aside><div className="admin-workspace" inert={terbuka?true:undefined}><header className="admin-topbar no-print"><button ref={pemicu} className="admin-buka" aria-label="Buka menu" aria-expanded={terbuka} aria-controls="navigasi-admin" onClick={()=>aturTerbuka(true)}><Menu size={22}/></button><div className="admin-konteks"><span>Manajemen</span><ChevronRight size={14}/><strong>{judul}</strong></div><div className="admin-tanggal">{new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(new Date())}<span>Waktu Indonesia Barat</span></div><div className="admin-top-avatar" title={user?.name}>{user?.name.slice(0,1).toUpperCase()}</div></header><main id="konten-admin" tabIndex={-1} className="admin-content"><Outlet/></main><footer className="admin-footer no-print"><span>BARBER BARBAR</span><span>Not cutting heads, just hair.</span></footer></div></div>;
}
