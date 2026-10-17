import { api } from "./api";
export type KodePerhatian="PEMERIKSAAN"|"CHECK_IN"|"TAGIHAN"|"DP";
export type AktivitasDashboard={jenis:"BOOKING"|"WALK_IN";id:number;bookingId:number|null;pesananId:number|null;nomor:string;pelanggan:string;jadwal:string;status:string;statusPembayaran:string;masalah?:string};
export type KategoriDashboard={kode:KodePerhatian;judul:string;total:number;halaman:number;data:AktivitasDashboard[]};
export type DashboardFinal={serverTime:string;hariIni:string;kpi:{bookingHariIni:number;menungguCheckIn:number;sedangDilayani:number;pembayaranHariIni:number};aktivitas:{data:AktivitasDashboard[];total:number;halaman:number;batas:10};perhatian:KategoriDashboard[]};
export const ambilDashboardFinal=async(params:Record<string,string|number>,signal?:AbortSignal)=>(await api.get<DashboardFinal>("/management/dashboard",{params,signal})).data;
