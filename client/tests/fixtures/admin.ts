import type { Page } from "@playwright/test";
export const waktu="2026-10-17T07:00:00.000Z";
export const pelanggan={id:1,nama:"Ardi Pratama",nomorTelepon:"081234567890",alamat:"Alamat fixture browser",dibuatPada:waktu,status:"AKTIF",membership:null};
export const barber={id:1,nama:"Raka",nomorTelepon:null,aktif:true,dibuatPada:waktu,pengguna:null};
export const layanan={id:1,nama:"Haircut & Styling",harga:50000,durasiMenit:30,aktif:true,dibuatPada:waktu};
export const pesanan={id:1,nomorPesanan:"ORD-UI-001",pelangganId:1,barberId:1,status:"COMPLETED",statusPembayaran:"PAID",checkInTime:waktu,catatan:null,subtotal:100000,discountPercent:0,diskon:0,total:100000,dibuatPada:waktu,diperbaruiPada:waktu,pelanggan,barber,items:[{id:1,pesananId:1,layananId:1,namaLayanan:layanan.nama,harga:50000,qty:2,subtotal:100000,durasiMenit:30}],pembayaran:{id:1,pesananId:1,nomorInvoice:"INV-UI-001",metode:"CASH",jumlahDiterima:100000,kembalian:0,catatan:null,dibayarPada:waktu},riwayatStatus:[]};
export const booking={id:1,nomorBooking:"BKG-UI-001",status:"CONFIRMED",mulaiPada:waktu,selesaiPada:"2026-10-17T08:00:00Z",zonaWaktu:"Asia/Jakarta",durasiMenit:60,barberPilihanId:null,barberDisetujuiId:null,barberFinalId:null,pesananId:null,subtotal:100000,discountPercent:0,diskon:0,total:100000,nominalDp:50000,catatan:null,dibuatPada:waktu,deadlineDp:waktu,deadlinePelunasan:null,alasanPenolakan:null,pelanggan,items:pesanan.items,usulanBarber:[],riwayat:[],aksesTamu:{nama:pelanggan.nama,nomorTelepon:pelanggan.nomorTelepon}};
export const pembayaran={subtotal:100000,diskon:0,total:100000,jumlahDibayar:50000,balance:50000,kelebihan:0,nominalDpAwal:50000,dpTerverifikasi:true,statusPembayaran:"DP_PAID",invoiceSementara:true,invoice:null,transaksi:[{id:1,tujuan:"DP",kanal:"MIDTRANS",status:"SUCCEEDED",nominal:50000,mataUang:"IDR",metode:null,dibuatPada:waktu,dibayarPada:waktu}]};
export async function siapkanAdmin(page:Page,role:"ADMIN"|"STAFF"="ADMIN") {
  const state={booking:{...structuredClone(booking),pesananId:booking.pesananId as number|null},kosong:false,error:false,mutasi:[] as {path:string;body:unknown}[],pesanan:structuredClone(pesanan)};
  const user={id:9,name:"Operator Browser",email:"operator@example.invalid",role};
  await page.addInitScript(u=>{localStorage.setItem("barber_token","fixture-browser-only");localStorage.setItem("barber_user",JSON.stringify(u));},user);
  await page.routeWebSocket("**/socket.io/**",ws=>ws.close());
  await page.route("**/api/**",async r=>{
    const req=r.request(),url=new URL(req.url()),p=url.pathname.replace(/^\/api/,"");
    if(p==="/auth/me")return r.fulfill({json:{pengguna:user}});
    if(req.method()!=="GET"){state.mutasi.push({path:p,body:req.postDataJSON()});return r.fulfill({json:{...layanan,...req.postDataJSON(),...((p.includes("orders"))?state.pesanan:{})}});}
    if(state.error)return r.fulfill({status:503,json:{pesan:"Gangguan fixture"}});
    const list=<T,>(v:T[])=>state.kosong?[]:v;
    if(p==="/management/dashboard")return r.fulfill({json:{serverTime:new Date().toISOString(),hariIni:"2026-10-17",kpi:{bookingHariIni:state.kosong?0:1,menungguCheckIn:0,sedangDilayani:0,pembayaranHariIni:state.kosong?0:100000},aktivitas:{data:list([{jenis:"BOOKING",id:1,bookingId:1,pesananId:null,nomor:booking.nomorBooking,pelanggan:pelanggan.nama,jadwal:waktu,status:"CONFIRMED",statusPembayaran:"DP_PAID"}]),total:state.kosong?0:1,halaman:1,batas:10},perhatian:[]}});
    if(p==="/management/history")return r.fulfill({json:{data:list([{jenis:"BOOKING",id:1,nomor:booking.nomorBooking,pelanggan:pelanggan.nama,jadwal:waktu,penutupan:waktu,sumberPenutupan:"RiwayatBooking",statusBackend:"COMPLETED",statusAkhir:"COMPLETED",statusPembayaran:"PAID"},{jenis:"WALK_IN",id:1,nomor:pesanan.nomorPesanan,pelanggan:"Dimas Saputra",jadwal:waktu,penutupan:waktu,sumberPenutupan:"RiwayatStatusPesanan",statusBackend:"COMPLETED",statusAkhir:"COMPLETED",statusPembayaran:"PAID"}]),total:state.kosong?0:2,halaman:1,batas:20,totalHalaman:1,tanpaWaktuPenutupan:0,hariIni:"2026-10-17",serverTime:waktu}});
    if(p==="/management/orders")return r.fulfill({json:{data:list([{jenis:"BOOKING",id:1,bookingId:1,pesananId:null,nomor:booking.nomorBooking,nomorPesanan:null,pelanggan:pelanggan.nama,barber:null,jadwal:waktu,checkIn:null,status:"CONFIRMED",statusPembayaran:"DP_PAID",total:100000,nomorInvoice:null},{jenis:"WALK_IN",id:2,bookingId:null,pesananId:1,nomor:pesanan.nomorPesanan,nomorPesanan:pesanan.nomorPesanan,pelanggan:"Dimas Saputra",barber:"Raka",jadwal:waktu,checkIn:waktu,status:"COMPLETED",statusPembayaran:"PAID",total:100000,nomorInvoice:"INV-UI-001"}]),total:state.kosong?0:2,halaman:1,batas:20,hariIni:"2026-10-17",serverTime:new Date().toISOString(),metrik:{waiting:0,inService:0,completedUnpaid:0,paidToday:state.kosong?0:1,revenueToday:state.kosong?0:100000,pelanggan:state.kosong?0:1,barberAktif:1,layananAktif:1}}});
    if(p==="/pelanggan")return r.fulfill({json:list([pelanggan])});
    if(p.startsWith("/barbers"))return r.fulfill({json:list([barber])});
    if(p==="/layanan")return r.fulfill({json:list([layanan])});
    if(p==="/memberships")return r.fulfill({json:list([{id:1,pelangganId:1,memberCode:"MBR-UI-001",discountPercent:10,isActive:true,joinedAt:waktu,pelanggan}])});
    if(p==="/orders")return r.fulfill({json:list([state.pesanan])});
    if(/^\/orders\/\d+$/.test(p))return r.fulfill({json:state.pesanan});
    if(p==="/invoices")return r.fulfill({json:list([{...pesanan.pembayaran,pesanan}])});
    if(p==="/dashboard/reports")return r.fulfill({json:{jumlahPesanan:state.kosong?0:1,selesai:state.kosong?0:1,dibatalkan:0,belumDibayar:0,revenue:state.kosong?0:100000,pesanan:list([pesanan])}});
    if(p==="/bookings/1")return r.fulfill({json:{booking:state.booking}});
    if(p==="/bookings/1/payments")return r.fulfill({json:{ringkasan:pembayaran}});
    return r.fulfill({json:{data:[]}});
  });return state;
}
