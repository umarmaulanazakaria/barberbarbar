import {createHash,randomBytes,createCipheriv,createDecipheriv,timingSafeEqual} from "node:crypto";
import db from "../lib/prisma.js";
import type {Prisma} from "../generated/prisma/client.js";
import {waktuDatabaseBooking} from "../lib/deadline-booking.js";
import {ambilBookingPembayaran,bacaRingkasanPembayaran,KesalahanPembayaranBooking} from "./pembayaran-booking.service.js";

export const hashRahasia=(s:string)=>createHash("sha256").update(s).digest("hex");
export const rahasiaSesi=()=>randomBytes(32).toString("hex");
const tolak=():never=>{throw new KesalahanPembayaranBooking(404,"Kode booking tidak ditemukan atau tidak valid.");};
export const kunciTracking=()=>{
 const raw=process.env.BOOKING_TRACKING_ENCRYPTION_KEY??"",key=Buffer.from(raw,"base64");
 if(key.length!==32||key.toString("base64")!==raw)throw new KesalahanPembayaranBooking(503,"Akses booking belum tersedia.");
 return key;
};
export const kesiapanBookingWeb=async()=>{
 if(process.env.GUEST_BOOKING_ENABLED!=="true")return false;
 try{kunciTracking();const [r]=await db.$queryRaw<{siap:boolean}[]>`SELECT ((SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='AksesBookingTamu' AND column_name IN ('trackingHash','trackingTerenkripsi','versiAkses'))=3 AND to_regclass('public."SesiBookingTamu"') IS NOT NULL) AS siap`;return r?.siap===true}catch{return false}
};
export const normalisasiKode=(s:string)=>{const n=s.replace(/[-\s]/g,"").toUpperCase();return /^BB[0-9A-F]{32}$/.test(n)?n:"";};
const kodeBaru=()=>"BB-"+randomBytes(16).toString("hex").toUpperCase().match(/.{4}/g)!.join("-");
const aad=(id:number,versi:number)=>Buffer.from(`booking-tracking-v1:${id}:${versi}`);
const enkripsi=(kode:string,id:number,versi:number)=>{const iv=randomBytes(12),c=createCipheriv("aes-256-gcm",kunciTracking(),iv);c.setAAD(aad(id,versi));const ct=Buffer.concat([c.update(kode,"utf8"),c.final()]);return["v1",iv.toString("hex"),ct.toString("hex"),c.getAuthTag().toString("hex")].join(":");};
const dekripsi=(s:string,id:number,versi:number)=>{const[v,iv,ct,tag]=s.split(":");if(v!=="v1"||!iv||!ct||!tag)throw Error("TRACKING_CIPHER_INVALID");const c=createDecipheriv("aes-256-gcm",kunciTracking(),Buffer.from(iv,"hex"));c.setAAD(aad(id,versi));c.setAuthTag(Buffer.from(tag,"hex"));return Buffer.concat([c.update(Buffer.from(ct,"hex")),c.final()]).toString("utf8");};
const kunciAkses=async(tx:Prisma.TransactionClient,id:number)=>{await tx.$queryRaw`SELECT id FROM "AksesBookingTamu" WHERE "bookingId"=${id} FOR UPDATE`;};
export const aksesSesi=async(token:string,tx:Prisma.TransactionClient)=>{
 if(!/^[0-9a-f]{64}$/.test(token))return tolak();
 const s=await tx.sesiBookingTamu.findUnique({where:{tokenHash:hashRahasia(token)},include:{akses:true}}),now=await waktuDatabaseBooking(tx);
 if(!s||s.kedaluwarsaPada<=now||s.akses.kedaluwarsaPada<=now||s.versiAkses!==s.akses.versiAkses)return tolak();
 return s;
};
export const verifikasiSesi=(token:string)=>db.$transaction(async tx=>(await aksesSesi(token,tx)).bookingId);
export const bukaSesiTracking=(kode:string)=>db.$transaction(async tx=>{
 kunciTracking();const normal=normalisasiKode(kode);if(!normal)return tolak();const hash=hashRahasia(normal);
 const awal=await tx.aksesBookingTamu.findUnique({where:{trackingHash:hash},select:{bookingId:true}});if(!awal)return tolak();
 await kunciAkses(tx,awal.bookingId);const akses=await tx.aksesBookingTamu.findUniqueOrThrow({where:{bookingId:awal.bookingId}}),now=await waktuDatabaseBooking(tx);
 if(!akses.trackingHash||!timingSafeEqual(Buffer.from(akses.trackingHash),Buffer.from(hash))||akses.kedaluwarsaPada<=now)return tolak();
 const token=rahasiaSesi(),akhir=new Date(Math.min(now.getTime()+8*3600000,akses.kedaluwarsaPada.getTime()));
 await tx.sesiBookingTamu.create({data:{bookingId:akses.bookingId,versiAkses:akses.versiAkses,sumber:"TRACKING",tokenHash:hashRahasia(token),kedaluwarsaPada:akhir}});
 return{token,kedaluwarsaPada:akhir};
});
export const bukaSesiLegacy=(token:string)=>db.$transaction(async tx=>{
 if(!/^[0-9a-f]{64}$/.test(token))return tolak();const awal=await tx.aksesBookingTamu.findUnique({where:{tokenHash:hashRahasia(token)},select:{bookingId:true}});if(!awal)return tolak();
 await kunciAkses(tx,awal.bookingId);const a=await tx.aksesBookingTamu.findUniqueOrThrow({where:{bookingId:awal.bookingId}}),now=await waktuDatabaseBooking(tx);
 if(a.tokenHash!==hashRahasia(token)||a.kedaluwarsaPada<=now)return tolak();
 const baru=rahasiaSesi(),akhir=new Date(Math.min(now.getTime()+24*3600000,a.kedaluwarsaPada.getTime()));
 await tx.sesiBookingTamu.create({data:{bookingId:a.bookingId,tokenHash:hashRahasia(baru),versiAkses:a.versiAkses,sumber:"SEMENTARA",kedaluwarsaPada:akhir}});return{token:baru,kedaluwarsaPada:akhir};
});
const dpSah=async(tx:Prisma.TransactionClient,id:number)=>{
 const b=await ambilBookingPembayaran(tx,id);if(b.sumberBooking!=="TAMU")return false;
 const r=await bacaRingkasanPembayaran(tx,b);if(r.bebasDp && b.membershipBerbayarId)return ["CONFIRMED","CHECKED_IN","IN_SERVICE","COMPLETED"].includes(b.status);if(!r.dpTerverifikasi)return false;
 return !!await tx.riwayatBooking.findFirst({where:{bookingId:id,aksi:"AUTO_CONFIRM_GUEST"},select:{id:true}});
};
export const kodeUntukSesi=(token:string)=>db.$transaction(async tx=>{
 const s=await aksesSesi(token,tx);await kunciAkses(tx,s.bookingId);await aksesSesi(token,tx);
 const a=await tx.aksesBookingTamu.findUniqueOrThrow({where:{bookingId:s.bookingId}});
 if(a.trackingHash&&a.trackingTerenkripsi){const kode=dekripsi(a.trackingTerenkripsi,a.bookingId,a.versiAkses);if(hashRahasia(normalisasiKode(kode))!==a.trackingHash)throw Error("TRACKING_INTEGRITY");return kode;}
 if(!await dpSah(tx,s.bookingId))return null;
 const kode=kodeBaru();await tx.aksesBookingTamu.update({where:{bookingId:s.bookingId},data:{trackingHash:hashRahasia(normalisasiKode(kode)),trackingTerenkripsi:enkripsi(kode,s.bookingId,a.versiAkses)}});
 const b=await ambilBookingPembayaran(tx,s.bookingId);await tx.riwayatBooking.create({data:{bookingId:s.bookingId,aksi:"TRACKING_ISSUED",statusSebelum:b.status,statusSetelah:b.status,rincian:{versi:a.versiAkses}}});return kode;
});
export const gantiKodeAdmin=(id:number,penggunaId:number,alasan:string)=>db.$transaction(async tx=>{
 kunciTracking();await kunciAkses(tx,id);const a=await tx.aksesBookingTamu.findUnique({where:{bookingId:id}}),now=await waktuDatabaseBooking(tx);if(!a||a.kedaluwarsaPada<=now||!await dpSah(tx,id))throw new KesalahanPembayaranBooking(409,"Booking belum memenuhi syarat pemulihan kode.");
 const versi=a.versiAkses+1,kode=kodeBaru(),b=await ambilBookingPembayaran(tx,id);
 await tx.aksesBookingTamu.update({where:{bookingId:id},data:{versiAkses:versi,trackingHash:hashRahasia(normalisasiKode(kode)),trackingTerenkripsi:enkripsi(kode,id,versi),tokenHash:hashRahasia(rahasiaSesi())}});
 await tx.riwayatBooking.create({data:{bookingId:id,penggunaId,aksi:"TRACKING_REISSUED",statusSebelum:b.status,statusSetelah:b.status,rincian:{versi,identitasDiverifikasi:true,alasan}}});return{kode};
});
