// Adapter fixture untuk kontrak JWT CUSTOMER historis; bukan aplikasi customer.
// Tidak bergantung pada folder/runtime React Native yang telah dipensiunkan.
import axios from 'axios';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { io } from 'socket.io-client';

export function buatKlienCustomerHistoris(alamat) {
  const publik = axios.create({baseURL: alamat, timeout: 15000});
  const cache = new QueryClient({defaultOptions:{queries:{retry:false}}});
  let sesi = {token:null, versi:0};
  const privat = async (method,url,data) => (await publik.request({method,url,data,headers:{Authorization:'Bearer '+sesi.token}})).data;
  return {
    publik, cache, QueryObserver,
    ambilSesi:()=>sesi,
    verifikasiToken:async token=>(await publik.get('/auth/customer/me',{headers:{Authorization:'Bearer '+token}})).data.akun,
    mulaiSesi:async(token,akun)=>{sesi={token,akun,versi:sesi.versi+1};},
    keluar:async()=>{sesi={token:null,versi:sesi.versi+1};cache.clear();},
    ambilMembership:()=>privat('get','/customer/membership'),
    ajukanMembership:()=>privat('post','/customer/membership/requests',{}),
    ambilBooking:async()=>(await privat('get','/customer/bookings')).data,
    detailBooking:async id=>(await privat('get',`/customer/bookings/${id}`)).booking,
    pembayaranBooking:async id=>(await privat('get',`/customer/bookings/${id}/payments`)).ringkasan,
    ambilRefund:async()=>(await privat('get','/customer/refunds')).data,
    buatBooking:async d=>(await privat('post','/customer/bookings',{items:d.items,barberPilihanId:d.barberPilihanId,mulaiPada:`${d.tanggal}T${d.jam}:00+07:00`,...(d.catatan?.trim()?{catatan:d.catatan.trim()}:{})})).booking,
    batalBooking:id=>privat('post',`/customer/bookings/${id}/cancel`,{}),
    buatCheckout:(id,pelunasan,kunciIdempotensi)=>privat('post',`/customer/bookings/${id}/payments/${pelunasan?'online-settlement':'dp'}`,{kunciIdempotensi}),
    pasangRealtime:()=>{
      const socket=io(alamat,{auth:{token:sesi.token},autoConnect:false,forceNew:true});
      const segarkan=()=>{void cache.invalidateQueries();};
      for(const jenis of ['connect','realtime.ready','booking.changed','order.changed','payment.changed','membership.changed','refund.changed'])socket.on(jenis,segarkan);
      socket.connect();return()=>{socket.removeAllListeners();socket.disconnect();};
    },
  };
}
