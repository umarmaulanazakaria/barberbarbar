import { Prisma } from "../generated/prisma/client.js";
import basisData from "../lib/prisma.js";
import { waktuDatabaseBooking, menitKonfirmasi } from "../lib/deadline-booking.js";
import { hariWib, awalWib } from "./pesanan-terpadu.service.js";
import { ambilBookingPembayaran, bacaRingkasanPembayaran } from "./pembayaran-booking.service.js";
import { z } from "zod";

export const kategoriPerhatian = ["PEMERIKSAAN", "CHECK_IN", "TAGIHAN", "DP"] as const;
export const skemaDashboard = z.object({
  jenis: z.enum(["BOOKING", "WALK_IN"]).default("BOOKING"),
  cari: z.string().trim().max(100).default(""),
  halaman: z.coerce.number().int().min(1).max(100000).default(1),
  kategoriPerhatian: z.enum(kategoriPerhatian).optional(),
  halamanPerhatian: z.coerce.number().int().min(1).max(100000).default(1),
}).strict();
type Filter = z.infer<typeof skemaDashboard>;
type Baris = { jenis:"BOOKING"|"WALK_IN";id:number;bookingId:number|null;pesananId:number|null;nomor:string;pelanggan:string;jadwal:Date;status:string;statusPembayaran:string;kategori?:typeof kategoriPerhatian[number];masalah?:string;urut?:Date };
const label = { PEMERIKSAAN:"Perlu pemeriksaan", CHECK_IN:"Check-in terlambat", TAGIHAN:"Tagihan belum lunas", DP:"Menunggu DP" };
const angkaAman = (nilai: bigint | number) => { const angka=Number(nilai); if(!Number.isSafeInteger(angka)||angka<0)throw Error("NOMINAL_DASHBOARD_INVALID");return angka; };

// Proyeksi read-only: bukti sah sama dengan bacaRingkasanPembayaran existing.
// Tidak menjadikan status SUCCEEDED tanpa bukti provider sebagai uang diterima.
export const ambilDashboardFinal = (filter:Filter, waktuUji?:Date) => basisData.$transaction(async tx=>{
  await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
  const sekarang=waktuUji??await waktuDatabaseBooking(tx), hariIni=hariWib(sekarang), awal=awalWib(hariIni), akhir=new Date(awal.getTime()+86400000);
  const dasar=Prisma.sql`WITH sah AS (
    SELECT t.* FROM "TransaksiPembayaranBooking" t LEFT JOIN "BuktiProviderBooking" e ON e."transaksiId"=t.id
    WHERE t.status='SUCCEEDED' AND ((t.kanal='KASIR' AND t.tujuan='PELUNASAN' AND t."jumlahDiterima" IS NOT NULL AND t.kembalian IS NOT NULL)
      OR (t.kanal='MIDTRANS' AND e."referensiProvider"=t."referensiProvider" AND e.nominal=t.nominal AND e."mataUang"='IDR'))
  ), booking AS (
    SELECT 'BOOKING'::text jenis,b.id,b.id "bookingId",b."pesananId",b."nomorBooking" nomor,c.nama pelanggan,b."mulaiPada" jadwal,b."checkInPada" "checkIn",b.status::text status,
      COALESCE(p.total,b.total) total,b."deadlineDp",b."deadlinePelunasan",b."dibatalkanPada",
      COALESCE((SELECT sum(CASE WHEN t.tujuan='REFUND' THEN -t.nominal ELSE t.nominal END) FROM sah t WHERE t."bookingId"=b.id),0) net,
      COALESCE((SELECT sum(t.nominal) FROM sah t WHERE t."bookingId"=b.id AND t.tujuan<>'REFUND'),0) bruto,
      EXISTS(SELECT 1 FROM "TransaksiPembayaranBooking" t WHERE t."bookingId"=b.id AND t.status='SUCCEEDED' AND NOT EXISTS(SELECT 1 FROM sah s WHERE s.id=t.id)) "tidakSah",
      (b."memberBebasDp" OR (SELECT count(*)>0 AND COALESCE(sum(t.nominal),0)>=b."nominalDp" FROM sah t WHERE t."bookingId"=b.id AND t.tujuan='DP' AND t.kanal='MIDTRANS'
        AND (t."roundKonfirmasiPada"=CASE WHEN b."sumberBooking"='TAMU' THEN b."dibuatPada" ELSE b."dikonfirmasiPada" END OR t."roundKonfirmasiPada"=b."dpDibawaDariRound")
        AND t."dibayarPada" IS NOT NULL AND t."deadlinePada" IS NOT NULL AND t."dibayarPada"<=t."deadlinePada")) "dpSah",
      COALESCE((SELECT r."dibuatPada" FROM "RiwayatBooking" r WHERE r."bookingId"=b.id AND r.aksi='RESCHEDULE' ORDER BY r.id DESC LIMIT 1),b."dibuatPada")+${menitKonfirmasi}*interval '1 minute' "deadlineKonfirmasi"
    FROM "Booking" b JOIN "Pelanggan" c ON c.id=b."pelangganId" LEFT JOIN "Pesanan" p ON p.id=b."pesananId"
  ), walkin AS (
    SELECT 'WALK_IN'::text jenis,p.id,NULL::int "bookingId",p.id "pesananId",p."nomorPesanan" nomor,COALESCE(f.nama,c.nama,'Pelanggan Anonim') pelanggan,p."checkInTime" AT TIME ZONE 'UTC' jadwal,
      p.status::text status,p."statusPembayaran"::text "statusPembayaran",
      ((p.total=0 AND p."invoiceManfaat" IS NOT NULL) OR (i.id IS NOT NULL AND i."jumlahDiterima">=0 AND i.kembalian>=0 AND i."jumlahDiterima"-i.kembalian=p.total)) "receiptSah"
    FROM "Pesanan" p LEFT JOIN "Pelanggan" c ON c.id=p."pelangganId" LEFT JOIN "ProfilPelanggan" f ON f.id=p."profilPelangganId" LEFT JOIN "Pembayaran" i ON i."pesananId"=p.id
    WHERE NOT EXISTS(SELECT 1 FROM "Booking" b WHERE b."pesananId"=p.id)
  ), valid AS (
    SELECT b.* FROM booking b WHERE b.status IN ('AWAITING_DP','PENDING_CONFIRMATION','CONFIRMED','CHECKED_IN','IN_SERVICE','COMPLETED')
    AND (b.status<>'AWAITING_DP' OR b."deadlineDp">${sekarang})
    AND (b.status<>'PENDING_CONFIRMATION' OR (b."deadlineKonfirmasi">${sekarang} AND b.jadwal>${sekarang}))
    AND (b.status<>'CONFIRMED' OR b."dpSah" OR b."deadlineDp">${sekarang})
  ), aktivitas AS (
    SELECT jenis,id,"bookingId","pesananId",nomor,pelanggan,jadwal,status,NULL::text "statusPembayaran" FROM valid
      WHERE jadwal>=${awal} AND status<>'COMPLETED'
    UNION ALL
    SELECT jenis,id,"bookingId","pesananId",nomor,pelanggan,jadwal,status,"statusPembayaran" FROM walkin
      WHERE jadwal>=${awal} AND jadwal<${akhir} AND status IN ('WAITING','IN_SERVICE','COMPLETED')
  ), masalah AS (
    SELECT jenis,id,"bookingId","pesananId",nomor,pelanggan,jadwal,status,NULL::text "statusPembayaran",'PEMERIKSAAN'::text kategori,'Pembayaran membutuhkan pemeriksaan'::text masalah,jadwal urut FROM booking
      WHERE "tidakSah" OR net>total OR (status IN ('CANCELLED','REJECTED') AND bruto>0 AND NOT(status='CANCELLED' AND "dibatalkanPada" IS NOT NULL AND jadwal-"dibatalkanPada"<interval '1 hour'))
    UNION ALL SELECT jenis,id,"bookingId","pesananId",nomor,pelanggan,jadwal,status,"statusPembayaran",'PEMERIKSAAN','Bukti pembayaran perlu diperiksa',jadwal FROM walkin WHERE "statusPembayaran"='PAID' AND NOT "receiptSah"
    UNION ALL SELECT jenis,id,"bookingId","pesananId",nomor,pelanggan,jadwal,status,NULL,'CHECK_IN','Jadwal terlewati; belum check-in',jadwal FROM booking WHERE status='CONFIRMED' AND "dpSah" AND "checkIn" IS NULL AND jadwal<${sekarang}
    UNION ALL SELECT jenis,id,"bookingId","pesananId",nomor,pelanggan,jadwal,status,NULL,'TAGIHAN','Pelayanan selesai, tagihan belum lunas',COALESCE("deadlinePelunasan",jadwal) FROM booking WHERE status='COMPLETED' AND net<total
    UNION ALL SELECT jenis,id,"bookingId","pesananId",nomor,pelanggan,jadwal,status,"statusPembayaran",'TAGIHAN','Pelayanan selesai, tagihan belum lunas',jadwal FROM walkin WHERE status='COMPLETED' AND "statusPembayaran"='UNPAID'
    UNION ALL SELECT jenis,id,"bookingId","pesananId",nomor,pelanggan,jadwal,status,NULL,'DP','Menunggu DP sebelum batas pembayaran',"deadlineDp" FROM valid WHERE status IN ('AWAITING_DP','CONFIRMED') AND NOT "dpSah" AND "deadlineDp">${sekarang}
  )`;
  const [kpi]=await tx.$queryRaw<{bookingHariIni:bigint;menungguCheckIn:bigint;sedangDilayani:bigint;pembayaranHariIni:bigint}[]>(Prisma.sql`${dasar} SELECT
    (SELECT count(*) FROM valid WHERE jadwal>=${awal} AND jadwal<${akhir}) "bookingHariIni",
    (SELECT count(*) FROM booking WHERE status='CONFIRMED' AND "dpSah" AND "checkIn" IS NULL AND jadwal>=${awal} AND jadwal<${akhir}) "menungguCheckIn",
    ((SELECT count(*) FROM booking WHERE status='IN_SERVICE')+(SELECT count(*) FROM walkin WHERE status='IN_SERVICE')) "sedangDilayani",
    (COALESCE((SELECT sum(nominal) FROM sah WHERE tujuan IN ('DP','PELUNASAN') AND "dibayarPada">=${awal} AND "dibayarPada"<${akhir}),0)+
      COALESCE((SELECT sum(i."jumlahDiterima"-i.kembalian) FROM "Pembayaran" i JOIN walkin w ON w."pesananId"=i."pesananId" WHERE w."statusPembayaran"='PAID' AND w."receiptSah" AND i."dibayarPada">=${awal} AND i."dibayarPada"<${akhir}),0)) "pembayaranHariIni"`);
  const pencarian=filter.cari?Prisma.sql`AND (pelanggan ILIKE ${'%'+filter.cari+'%'} OR nomor ILIKE ${'%'+filter.cari+'%'})`:Prisma.empty;
  const [hitung]=await tx.$queryRaw<{total:bigint}[]>(Prisma.sql`${dasar} SELECT count(*) total FROM aktivitas WHERE jenis=${filter.jenis} ${pencarian}`);
  const total=angkaAman(hitung!.total),halaman=Math.min(filter.halaman,Math.max(1,Math.ceil(total/10)));
  const aktivitas=await tx.$queryRaw<Baris[]>(Prisma.sql`${dasar} SELECT * FROM aktivitas WHERE jenis=${filter.jenis} ${pencarian}
    ORDER BY CASE WHEN jenis='WALK_IN' THEN CASE status WHEN 'WAITING' THEN 0 WHEN 'IN_SERVICE' THEN 1 ELSE 2 END ELSE 0 END,jadwal ASC,id ASC LIMIT 10 OFFSET ${(halaman-1)*10}`);
  const hitungMasalah=await tx.$queryRaw<{kategori:typeof kategoriPerhatian[number];total:bigint}[]>(Prisma.sql`${dasar} SELECT kategori,count(*) total FROM masalah GROUP BY kategori`);
  const halamanPerhatian=filter.halamanPerhatian;
  const perhatian=await tx.$queryRaw<Baris[]>(Prisma.sql`${dasar}, bernomor AS (SELECT *,row_number() OVER(PARTITION BY kategori ORDER BY urut ASC,jenis ASC,id ASC) posisi FROM masalah)
    SELECT * FROM bernomor WHERE posisi>CASE WHEN kategori=${filter.kategoriPerhatian??''} THEN ${(halamanPerhatian-1)*5} ELSE 0 END
      AND posisi<=CASE WHEN kategori=${filter.kategoriPerhatian??''} THEN ${halamanPerhatian*5} ELSE 5 END ORDER BY kategori,posisi`);
  const statusUang=new Map<number,string>();
  const dto=async(b:Baris)=>{
    if(b.bookingId!==null&&!statusUang.has(b.bookingId)){const uang=await bacaRingkasanPembayaran(tx,await ambilBookingPembayaran(tx,b.bookingId),sekarang);statusUang.set(b.bookingId,uang.statusPembayaran);}
    return {jenis:b.jenis,id:b.id,bookingId:b.bookingId,pesananId:b.pesananId,nomor:b.nomor,pelanggan:b.pelanggan,jadwal:b.jadwal.toISOString(),status:b.status,statusPembayaran:b.bookingId!==null?statusUang.get(b.bookingId)!:b.statusPembayaran,...(b.masalah?{masalah:b.masalah}:{})};
  };
  const data=[];for(const b of aktivitas)data.push(await dto(b));
  const kategori=[];for(const kode of kategoriPerhatian){const jumlah=angkaAman(hitungMasalah.find(k=>k.kategori===kode)?.total??0);if(!jumlah)continue;const items=[];for(const b of perhatian.filter(x=>x.kategori===kode))items.push(await dto(b));kategori.push({kode,judul:label[kode],total:jumlah,halaman:kode===filter.kategoriPerhatian?halamanPerhatian:1,data:items});}
  return {serverTime:sekarang.toISOString(),hariIni,kpi:{bookingHariIni:angkaAman(kpi!.bookingHariIni),menungguCheckIn:angkaAman(kpi!.menungguCheckIn),sedangDilayani:angkaAman(kpi!.sedangDilayani),pembayaranHariIni:angkaAman(kpi!.pembayaranHariIni)},aktivitas:{data,total,halaman,batas:10},perhatian:kategori};
},{isolationLevel:"RepeatableRead",timeout:30000});
