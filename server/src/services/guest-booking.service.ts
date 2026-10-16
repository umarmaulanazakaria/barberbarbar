import {konfigurasiSnapPublik} from "../lib/midtrans.js";
﻿import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import basisData from "../lib/prisma.js";
import { kunciJadwalBooking } from "../lib/transaksi-booking.js";
import { waktuDatabaseBooking } from "../lib/deadline-booking.js";
import { validasiWaktuBooking } from "../lib/jadwal-booking.js";
import { kapasitasLintasBooking, lepaskanTamuKedaluwarsa } from "../lib/kapasitas-lintas-booking.js";
import { KesalahanPembayaranBooking, ambilBookingPembayaran, bacaRingkasanPembayaran } from "./pembayaran-booking.service.js";
import { buatSnapBooking, sinkronkanPembayaranTamu } from "./midtrans-booking.service.js";

const tolak = (pesan:string,kode=400):never=>{throw new KesalahanPembayaranBooking(kode,pesan);};
const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
const telepon=(s:string)=>{const n=s.replace(/[\s()-]/g,"");return n.startsWith("08")?"+62"+n.slice(1):n.startsWith("62")?"+"+n:n;};
export const skemaGuest=z.object({nama:z.string().trim().min(2).max(80),nomorTelepon:z.string().max(24).transform(telepon).pipe(z.string().regex(/^\+628\d{7,11}$/)),
  mulaiPada:z.string().datetime({offset:true}),items:z.array(z.object({layananId:z.number().int().positive(),qty:z.number().int().min(1).max(10)}).strict()).min(1).max(20),kunciIdempotensi:z.uuid()}).strict()
  .refine(d=>new Set(d.items.map(i=>i.layananId)).size===d.items.length);
export type DataGuest=z.infer<typeof skemaGuest>;
export const buatBookingTamu=async(data:DataGuest)=>basisData.$transaction(async tx=>{
  await kunciJadwalBooking(tx);
  const sekarang=await waktuDatabaseBooking(tx);
  const sidik=hash(JSON.stringify({...data,items:[...data.items].sort((a,b)=>a.layananId-b.layananId)}));
  const lama=await tx.aksesBookingTamu.findUnique({where:{kunciIdempotensi:data.kunciIdempotensi},select:{id:true}});
  if(lama)return tolak("Permintaan ini sudah diterima. Gunakan tautan pribadi yang telah diterbitkan; jangan membuat pembayaran ulang.",409);
  const layanan=await tx.layanan.findMany({where:{id:{in:data.items.map(i=>i.layananId)},aktif:true}});
  if(layanan.length!==data.items.length)return tolak("Layanan tidak tersedia");
  const items=data.items.map(i=>{const l=layanan.find(l=>l.id===i.layananId)!;return{layananId:l.id,namaLayanan:l.nama,harga:l.harga,durasiMenit:l.durasiMenit,qty:i.qty,subtotal:l.harga*i.qty};});
  const durasiMenit=items.reduce((n,i)=>n+i.durasiMenit*i.qty,0),total=items.reduce((n,i)=>n+i.subtotal,0),mulaiPada=new Date(data.mulaiPada);
  const selesaiPada=validasiWaktuBooking(mulaiPada,durasiMenit,sekarang);
  if(!selesaiPada)return tolak("Jadwal tidak valid. Jam operasional 09.00–23.00 WIB, maksimal 14 hari, minimal 3 jam untuk hari ini.");
  if(total<=0||total>2147483647||!Number.isSafeInteger(total)||items.some(i=>i.harga<0||i.durasiMenit<=0))return tolak("Nominal layanan tidak dapat diproses");
  if(!await kapasitasLintasBooking(tx,{mulaiPada,selesaiPada}))return tolak("Kapasitas jadwal sudah penuh. Pilih waktu lain.",409);
  // Nomor HP adalah klaim kontak, bukan bukti kepemilikan akun. Jangan cari/link akun dari nomor ini.
  const identitas=await tx.pelanggan.create({data:{nama:data.nama,nomorTelepon:`TAMU-${randomUUID()}`}});
  const token=randomBytes(32).toString("hex"),deadlineDp=new Date(sekarang.getTime()+15*60000);
  const booking=await tx.booking.create({data:{nomorBooking:`BKG-${randomUUID()}`,sumberBooking:"TAMU",pelangganId:identitas.id,status:"AWAITING_DP",dibuatPada:sekarang,
    mulaiPada,selesaiPada,durasiMenit,subtotal:total,total,membershipAktif:false,discountPercent:0,diskon:0,dpPersen:50,nominalDp:Math.ceil(total/2),deadlineDp,
    items:{create:items},aksesTamu:{create:{tokenHash:hash(token),kunciIdempotensi:data.kunciIdempotensi,sidikPermintaan:sidik,nama:data.nama,nomorTelepon:data.nomorTelepon,kedaluwarsaPada:new Date(selesaiPada.getTime()+30*86400000)}},
    riwayat:{create:{aksi:"GUEST_CREATED",statusSebelum:"AWAITING_DP",statusSetelah:"AWAITING_DP",dibuatPada:sekarang,rincian:{sumber:"WEB_TAMU"}}}},select:{id:true,nomorBooking:true,deadlineDp:true}});
  return{token,tautanPribadi:`#/b/${token}`,booking,serverTime:sekarang.toISOString()};
},{isolationLevel:"ReadCommitted"});

export const verifikasiAksesTamu=async(token:string)=>{
  if(!/^[0-9a-f]{64}$/.test(token))return tolak("Tautan pribadi tidak valid atau tidak tersedia.",404);
  return basisData.$transaction(async tx=>{
    const sekarang=await waktuDatabaseBooking(tx);
    const akses=await tx.aksesBookingTamu.findUnique({where:{tokenHash:hash(token)},select:{bookingId:true,kedaluwarsaPada:true,booking:{select:{sumberBooking:true}}}});
    if(!akses||akses.booking.sumberBooking!=="TAMU"||akses.kedaluwarsaPada<=sekarang)return tolak("Tautan pribadi tidak valid atau tidak tersedia.",404);
    return akses.bookingId;
  });
};
export const detailBookingTamu=async(id:number)=>{
  await basisData.$transaction(async tx=>{await kunciJadwalBooking(tx);await lepaskanTamuKedaluwarsa(tx,await waktuDatabaseBooking(tx));});
  return basisData.$transaction(async tx=>{
    await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
    const serverTime=await waktuDatabaseBooking(tx);
    const booking=await tx.booking.findUniqueOrThrow({where:{id},select:{nomorBooking:true,status:true,mulaiPada:true,selesaiPada:true,durasiMenit:true,dibuatPada:true,deadlineDp:true,deadlinePelunasan:true,
      items:{select:{namaLayanan:true,layananId:true,qty:true,harga:true,subtotal:true,durasiMenit:true}},pesanan:{select:{items:{select:{namaLayanan:true,layananId:true,qty:true,harga:true,subtotal:true,durasiMenit:true}}}},aksesTamu:{select:{nama:true,nomorTelepon:true,kedaluwarsaPada:true}}}});
    const ringkasan=await bacaRingkasanPembayaran(tx,await ambilBookingPembayaran(tx,id),serverTime);
    const {pesanan,...rincian}=booking;
    return {booking:{...rincian,items:pesanan?.items??booking.items},ringkasan,serverTime:serverTime.toISOString()};
  },{isolationLevel:"RepeatableRead"});
};
export const checkoutTamu=async(id:number,tujuan:"DP"|"PELUNASAN",kunci:string)=>{
  const b=await basisData.booking.findUniqueOrThrow({where:{id},select:{pelangganId:true}});
  return {...await buatSnapBooking(id,b.pelangganId,tujuan,kunci),...konfigurasiSnapPublik()};
};
export const sinkronTamu=async(id:number)=>{
  const transaksi=await basisData.transaksiPembayaranBooking.findMany({where:{bookingId:id,kanal:"MIDTRANS",tujuan:{in:["DP","PELUNASAN"]},status:"PENDING"},select:{id:true},take:4});
  for(const t of transaksi)await sinkronkanPembayaranTamu(t.id);
  return detailBookingTamu(id);
};
