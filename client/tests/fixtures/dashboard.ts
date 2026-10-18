import type { Page } from "@playwright/test";
import { siapkanAdmin } from "./admin";
import type { AktivitasDashboard, KategoriDashboard } from "../../src/lib/dashboard-final";
export async function siapkanDashboard(page:Page,role:"ADMIN"|"STAFF"="ADMIN"){
 const dasar=await siapkanAdmin(page,role);
 const rows:AktivitasDashboard[]=Array.from({length:26},(_,i)=>({jenis:"BOOKING",id:i+1,bookingId:i+1,pesananId:null,nomor:i===0?"BKG-UI-001":`BKG-${String(i+1).padStart(3,'0')}`,pelanggan:i===0?"Ardi Pratama":`Pelanggan ${String(i+1).padStart(2,'0')}`,jadwal:new Date(Date.parse("2026-10-17T06:00:00Z")+i*3600000).toISOString(),status:i%3===0?"AWAITING_DP":i%3===1?"CONFIRMED":"IN_SERVICE",statusPembayaran:i%3===0?"AWAITING_DP":"DP_PAID"}));
 const walkins:AktivitasDashboard[]=Array.from({length:13},(_,i)=>({jenis:"WALK_IN",id:i+101,bookingId:null,pesananId:i===0?1:i+101,nomor:`ORD-${String(i+1).padStart(3,'0')}`,pelanggan:`Walk-in ${i+1}`,jadwal:"2026-10-17T06:00:00Z",status:i<5?"WAITING":i<9?"IN_SERVICE":"COMPLETED",statusPembayaran:i<9?"UNPAID":"PAID"}));
 const grup:KategoriDashboard[]=[{kode:"PEMERIKSAAN",judul:"Perlu pemeriksaan",total:7,halaman:1,data:rows.slice(0,7).map(b=>({...b,masalah:"Pembayaran membutuhkan pemeriksaan"}))},{kode:"CHECK_IN",judul:"Check-in terlambat",total:4,halaman:1,data:rows.slice(0,4).map(b=>({...b,masalah:"Jadwal terlewati; belum check-in"}))},{kode:"TAGIHAN",judul:"Tagihan belum lunas",total:6,halaman:1,data:[...walkins.slice(0,3),...rows.slice(0,3)].map(b=>({...b,masalah:"Pelayanan selesai, tagihan belum lunas"}))},{kode:"DP",judul:"Menunggu DP",total:12,halaman:1,data:rows.slice(0,12).map(b=>({...b,masalah:"Menunggu DP sebelum batas pembayaran"}))}];
 const state={...dasar,rows,walkins,grup,error:false,empty:false,clock:"2026-10-17T05:00:00Z",requests:[] as Record<string,string>[],delay:false,delaySearch:""};
 await page.route("**/api/management/dashboard?*",async r=>{
  const q=Object.fromEntries(new URL(r.request().url()).searchParams);state.requests.push(q);
  if(state.delay||state.delaySearch&&q.cari===state.delaySearch)await new Promise(resolve=>setTimeout(resolve,800));
  if(r.request().failure())return;
  if(state.error)return r.fulfill({status:503,json:{pesan:"Gangguan fixture dashboard"}});
  let data=state.empty?[]:q.jenis==="WALK_IN"?state.walkins:state.rows;
  if(q.cari)data=data.filter(b=>(b.pelanggan+" "+b.nomor).toLowerCase().includes(q.cari.toLowerCase()));
  const total=data.length,halaman=Math.min(Number(q.halaman)||1,Math.max(1,Math.ceil(total/10)));
  return r.fulfill({json:{serverTime:state.clock,hariIni:state.clock.slice(0,10),kpi:{bookingHariIni:state.empty?0:18,menungguCheckIn:state.empty?0:6,sedangDilayani:state.empty?0:4,pembayaranHariIni:state.empty?0:1250000},aktivitas:{data:data.slice((halaman-1)*10,halaman*10),total,halaman,batas:10},perhatian:state.empty?[]:state.grup.filter(g=>g.data.length>0).map(g=>{const h=q.kategoriPerhatian===g.kode?Number(q.halamanPerhatian)||1:1;return{...g,total:g.data.length,halaman:h,data:g.data.slice((h-1)*5,h*5)};})}});
 });
 return state;
}
