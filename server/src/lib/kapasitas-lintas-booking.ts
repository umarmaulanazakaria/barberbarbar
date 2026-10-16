import {alokasiBarberUtuh} from "./alokasi-barber.js";
﻿import type { Prisma } from "../generated/prisma/client.js";
import { kapasitasBookingCukup } from "./jadwal-booking.js";
import { waktuDatabaseBooking } from "./deadline-booking.js";

export const statusReservasi = ["AWAITING_DP", "PENDING_CONFIRMATION", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"] as const;
// Pemanggil wajib memiliki kunciJadwalBooking; semua penulis berbagi lock yang sama.
export async function lepaskanTamuKedaluwarsa(tx: Prisma.TransactionClient, sekarang: Date) {
  const lama = await tx.booking.findMany({where:{sumberBooking:"TAMU",status:"AWAITING_DP",deadlineDp:{lte:sekarang}},select:{id:true}});
  for(const b of lama){
    const hasil=await tx.booking.updateMany({where:{id:b.id,status:"AWAITING_DP"},data:{status:"CANCELLED",dibatalkanPada:sekarang}});
    if(hasil.count)await tx.riwayatBooking.create({data:{bookingId:b.id,aksi:"TIMEOUT_DP",statusSebelum:"AWAITING_DP",statusSetelah:"CANCELLED",dibuatPada:sekarang,rincian:{sumber:"GUEST_DEADLINE",alasan:"DP guest belum diverifikasi dalam 15 menit"}}});
  }
}
export async function kapasitasLintasBooking(tx: Prisma.TransactionClient, calon: {mulaiPada:Date;selesaiPada:Date}, opsi: {
  bookingId?:number|undefined;pesananId?:number|undefined;barberId?:number|null|undefined;pelangganId?:number|undefined;hanyaJikaAdaTamu?:boolean;
} = {}) {
  const sekarang=await waktuDatabaseBooking(tx);
  await lepaskanTamuKedaluwarsa(tx,sekarang);
  const aktif=await tx.barber.findMany({where:{aktif:true},select:{id:true}});
  const booking=await tx.booking.findMany({where:{status:{in:[...statusReservasi]},...(opsi.bookingId?{id:{not:opsi.bookingId}}:{})},
    select:{id:true,sumberBooking:true,pelangganId:true,pesananId:true,barberPilihanId:true,barberDisetujuiId:true,barberFinalId:true,mulaiPada:true,selesaiPada:true}});
  const orders=await tx.pesanan.findMany({where:{status:{in:["WAITING","IN_SERVICE"]},...(opsi.pesananId?{id:{not:opsi.pesananId}}:{}),...(opsi.bookingId?{NOT:{booking:{id:opsi.bookingId}}}:{})},
    select:{id:true,barberId:true,checkInTime:true,items:{select:{durasiMenit:true,qty:true}},booking:{select:{id:true}}}});
  const rentang=booking.map(b=>({...b,barberId:b.barberFinalId??b.barberDisetujuiId??b.barberPilihanId}));
  for(const p of orders){
    const durasi=p.items.reduce((n,i)=>n+i.durasiMenit*i.qty,0)*60000;
    const akhir=new Date(Math.max(sekarang.getTime(),p.checkInTime.getTime())+Math.max(durasi,60000));
    const terhubung=rentang.find(b=>b.pesananId===p.id||b.id===p.booking?.id);
    if(terhubung){if(terhubung.selesaiPada<akhir)terhubung.selesaiPada=akhir;continue;}
    rentang.push({id:-p.id,sumberBooking:"PESANAN",pelangganId:-1,pesananId:p.id,barberPilihanId:null,barberDisetujuiId:null,barberFinalId:p.barberId,barberId:p.barberId,mulaiPada:p.checkInTime,selesaiPada:akhir});
  }
  const bentrok=rentang.filter(b=>b.mulaiPada<calon.selesaiPada&&b.selesaiPada>calon.mulaiPada);
  if(opsi.hanyaJikaAdaTamu&&!bentrok.some(b=>b.sumberBooking==="TAMU"))return true;
  if(opsi.pelangganId&&bentrok.some(b=>b.pelangganId===opsi.pelangganId))return false;
  if(opsi.barberId&&bentrok.some(b=>b.barberId===opsi.barberId))return false;
  return kapasitasBookingCukup(bentrok,calon,aktif.length)&&alokasiBarberUtuh(rentang,{...calon,barberId:opsi.barberId??null},aktif.map(b=>b.id));
}
