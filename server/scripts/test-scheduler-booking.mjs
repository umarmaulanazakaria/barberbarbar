import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { fork } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import bcrypt from "bcrypt";
if (!["localhost","127.0.0.1","[::1]"].includes(new URL(process.env.DATABASE_URL ?? "").hostname)) throw new Error("Hanya DB lokal");
// Provider seluruh suite adalah MOCK, tidak memakai key merchant sebenarnya.
process.env.MIDTRANS_MERCHANT_ID = "fixture-scheduler";
process.env.MIDTRANS_SERVER_KEY = randomBytes(32).toString("hex");
process.env.MIDTRANS_CLIENT_KEY = "fixture-client";
process.env.MIDTRANS_IS_PRODUCTION = "false";
const { default: db } = await import("../dist/lib/prisma.js");
const { prosesDeadlineBooking, pindaiDeadlineBooking } = await import("../dist/services/scheduler-booking.service.js");
const { waktuDatabaseBooking, batasKonfirmasiBooking } = await import("../dist/lib/deadline-booking.js");
const { putuskanBooking, checkInBooking, mulaiLayananBooking, rescheduleBooking } = await import("../dist/services/operasional-booking.service.js");
const { ringkasanPembayaranBooking, bacaRingkasanPembayaran, ambilBookingPembayaran, bayarPelunasanKasirBooking } = await import("../dist/services/pembayaran-booking.service.js");
const { gerbangMidtrans } = await import("../dist/lib/midtrans.js");
const { sinkronkanPembayaran, notifikasiMidtrans } = await import("../dist/services/midtrans-booking.service.js");
const { mulaiSchedulerBooking } = await import("../dist/lib/scheduler-booking.js");
const { buatBookingPelanggan } = await import("../dist/services/booking.service.js");
const sdkAsli = { ...gerbangMidtrans }, provider = new Map(), anak = new Set(), ids = [];
const tanda = `uji-scheduler-${randomUUID()}`, password = randomBytes(20).toString("hex");
let pelanggan, operator, staff, barber, layanan, dasar, lulus = 0, refundCalls = 0, kendali;
const utc = kerja => db.$transaction(async tx => { await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`; return kerja(tx); });
const tambah = (waktu, ms) => new Date(waktu.getTime() + ms);
const pass = teks => { lulus++; console.log(`PASS SCHEDULER: ${teks}`); };
const status = id => utc(tx => tx.booking.findUniqueOrThrow({ where: { id } }));
const ubah = (id, data) => utc(tx => tx.booking.update({ where: { id }, data }));
const riwayat = (id, aksi) => db.riwayatBooking.count({ where: { bookingId: id, ...(aksi ? { aksi } : {}) } });
const batas = b => utc(tx => batasKonfirmasiBooking(tx, b));
const proses = (b, waktu) => prosesDeadlineBooking(b.id, { sekarang: waktu });
const buat = async (jenis = "PENDING_CONFIRMATION", data = {}) => {
  const jadwal = new Date(dasar); jadwal.setUTCDate(jadwal.getUTCDate() + 1 + Math.floor(ids.length / 20));
  jadwal.setUTCHours(2 + Math.floor((ids.length % 20) / 2), (ids.length % 2) * 30, 0, 0);
  const b = await utc(tx => tx.booking.create({ data: { nomorBooking: `TEST-${randomUUID()}`, pelangganId: pelanggan.id,
    barberPilihanId: barber.id, status: jenis, dibuatPada: dasar, mulaiPada: jadwal, selesaiPada: tambah(jadwal, 1_800_000),
    durasiMenit: 30, subtotal: 10000, membershipAktif: false, discountPercent: 0, diskon: 0, total: 10000, nominalDp: 5000,
    ...(jenis === "CONFIRMED" || jenis === "CHECKED_IN" || jenis === "IN_SERVICE" || jenis === "COMPLETED" ? { dikonfirmasiPada: dasar, deadlineDp: tambah(dasar, 3_600_000) } : {}),
    ...(jenis === "COMPLETED" ? { layananSelesaiPada: dasar, deadlinePelunasan: tambah(dasar, 3_600_000) } : {}), ...data,
    items: { create: { layananId: layanan.id, namaLayanan: tanda, harga: 10000, qty: 1, subtotal: 10000, durasiMenit: 30 } },
  } })); ids.push(b.id); return b;
};
const waktuProvider = w => tambah(w, 7 * 3_600_000).toISOString().slice(0,19).replace("T"," ");
const pembayaran = async (b, tujuan = "DP") => {
  const ref = `MOCK-${randomUUID()}`;
  const t = await utc(tx => tx.transaksiPembayaranBooking.create({ data: { bookingId: b.id, tujuan, kanal: "MIDTRANS", nominal: 5000,
    kunciIdempotensi: randomUUID(), sidikPermintaan: "fixture-private", referensiProvider: ref,
    ...(tujuan === "DP" ? { roundKonfirmasiPada: b.dikonfirmasiPada, deadlinePada: b.deadlineDp } : {}) } }));
  provider.set(ref, { order_id: ref, transaction_id: randomUUID(), merchant_id: "fixture-scheduler", gross_amount: "5000.00", currency: "IDR",
    transaction_status: "pending", payment_type: "qris", status_code: "201", transaction_time: waktuProvider(b.dikonfirmasiPada ?? dasar) });
  return t;
};
const settled = (t, waktu) => { const p = provider.get(t.referensiProvider); p.status_code = "200"; p.transaction_status = "settlement"; p.settlement_time = waktuProvider(waktu); return p; };
const notifikasi = p => notifikasiMidtrans({ ...p, signature_key: createHash("sha512").update(p.order_id+p.status_code+p.gross_amount+process.env.MIDTRANS_SERVER_KEY).digest("hex") });
const bayarDp = async b => { const t = await pembayaran(b); settled(t, tambah(b.dikonfirmasiPada, 1000)); await sinkronkanPembayaran(t.id); return t; };
const ringkasSaat = (id, waktu) => utc(async tx => bacaRingkasanPembayaran(tx, await ambilBookingPembayaran(tx, id), waktu));
const tunggu = async cek => { for (let i=0;i<150;i++) { if (await cek()) return; await new Promise(r=>setTimeout(r,40)); } throw new Error("TIMEOUT_UJI"); };
const mulaiAnak = async () => {
  const socket = createServer(); socket.listen(0,"127.0.0.1"); await once(socket,"listening"); const port = socket.address().port; await new Promise(r=>socket.close(r));
  const child = fork(new URL("./jalankan-server-uji-scheduler.mjs", import.meta.url), [], { execArgv: [], windowsHide: true,
    env: { ...process.env, PORT: String(port), SCHEDULER_BOOKING_AKTIF: "true", SCHEDULER_BOOKING_INTERVAL_MS: "1000" }, stdio: ["ignore","pipe","pipe","ipc"] });
  anak.add(child); child.stdout.on("data",()=>{}); child.stderr.on("data",()=>{}); child.on("error",()=>{});
  await tunggu(async()=>{ try { return (await fetch(`http://127.0.0.1:${port}/`)).status===200; } catch { return false; } }); return child;
};
const hentikanAnak = async child => { const keluar = once(child,"exit"); child.send("hentikan"); const [kode] = await keluar; assert.equal(kode,0); anak.delete(child); };
try {
  // Runner subprocess memindai DB lokal; jangan menjalankannya pada booking asli.
  assert.equal(await db.booking.count(),0,"Suite memerlukan DB lokal tanpa booking existing; tidak mengubah booking asli");
  dasar = await db.$transaction(waktuDatabaseBooking);
  const hash = await bcrypt.hash(password,10);
  pelanggan = await db.pelanggan.create({ data: { nama: tanda, nomorTelepon: `08${randomBytes(8).readBigUInt64BE().toString().slice(0,11)}`,
    akunPelanggan: { create: { email: `${tanda}-customer@example.invalid`, passwordHash: hash } } }, include: { akunPelanggan: true } });
  operator = await db.pengguna.create({ data: { name: tanda, email: `${tanda}@example.invalid`, passwordHash: hash, role: "ADMIN" } });
  barber = await db.barber.create({ data: { nama: tanda } }); layanan = await db.layanan.create({ data: { nama: tanda, harga: 10000, durasiMenit: 30 } });
  staff = await db.pengguna.create({ data: { name: tanda, email: `${tanda}-staff@example.invalid`, passwordHash: hash, role: "STAFF", barberId: barber.id } });
  gerbangMidtrans.status = async ref => { if (!provider.has(ref)) throw new Error("MOCK_PROVIDER_DOWN"); return structuredClone(provider.get(ref)); };
  gerbangMidtrans.refund = async () => { refundCalls++; throw new Error("REFUND_TIDAK_BOLEH_DIPANGGIL"); };
  const a = await buat(), deadline = (await batas(a)).deadline;
  assert.equal(await proses(a,tambah(a.dibuatPada,29*60_000)),null); assert.equal(await proses(a,tambah(deadline,-1)),null);
  const dua = await Promise.all([proses(a,deadline),proses(a,deadline)]); assert.equal(dua.filter(Boolean).length,1);
  assert.equal((await status(a.id)).status,"CANCELLED"); assert.equal(await riwayat(a.id,"TIMEOUT_CONFIRMATION"),1);
  assert.equal(await db.booking.count({where:{id:a.id,status:{in:["PENDING_CONFIRMATION","CONFIRMED","CHECKED_IN","IN_SERVICE"]}}}),0);
  assert.equal(await proses(a,tambah(deadline,1)),null);
  const slotBaru=await buatBookingPelanggan(pelanggan.id,{mulaiPada:a.mulaiPada.toISOString(),barberPilihanId:barber.id,items:[{layananId:layanan.id,qty:1}]});
  assert.equal(slotBaru.status,"BERHASIL");ids.push(slotBaru.booking.id);
  pass("29 menit/batas-1ms aman; tepat30 eligible; dua runner satu CANCELLED/riwayat; slot dilepas; scan ulang idempotent");
  const b = await buat(), bd = (await batas(b)).deadline;
  const awal = await Promise.all([putuskanBooking(b.id,operator.id,true,undefined,tambah(bd,-1)),proses(b,tambah(bd,-1))]);
  assert.equal(awal[0].status,"CONFIRMED");assert.equal(awal[1],null);assert.equal(await proses(b,bd),null);
  pass("Konfirmasi sebelum deadline menang sah; already confirmed tidak dibatalkan oleh timeout konfirmasi");
  for (const setuju of [true,false]) { const c=await buat(), cd=(await batas(c)).deadline;
    const hasil=await Promise.allSettled([putuskanBooking(c.id,setuju?operator.id:staff.id,setuju,"Uji reject",cd),proses(c,cd)]);
    assert.equal(hasil[0].status,"rejected");assert.equal((await status(c.id)).status,"CANCELLED");assert.equal(await riwayat(c.id),1); }
  pass("ADMIN confirm / STAFF reject versus timeout tepatdeadline: satu keputusan terminal atomik");
  const d=await buat("CONFIRMED"); const td=await pembayaran(d);
  assert.equal(await proses(d,tambah(d.deadlineDp,-1)),null); await proses(d,d.deadlineDp);
  assert.equal((await status(d.id)).status,"CANCELLED");assert.equal((await db.transaksiPembayaranBooking.findUnique({where:{id:td.id}})).status,"PENDING");
  assert.equal(await riwayat(d.id,"TIMEOUT_DP"),1);assert.equal(await db.permohonanRefundBooking.count({where:{bookingId:d.id}}),0);
  pass("DP sebelum deadline tetap; pending provider saat batas dibatalkan tanpa hilang payment atau kredit palsu");
  const e=await buat("CONFIRMED"),te=await pembayaran(e);settled(te,tambah(e.dikonfirmasiPada,1000));
  await proses(e,e.deadlineDp);assert.equal((await status(e.id)).status,"CONFIRMED");assert.equal((await db.transaksiPembayaranBooking.findUnique({where:{id:te.id}})).status,"SUCCEEDED");
  pass("GetStatus settlement tepatwaktu sebelum webhook mempertahankan booking dan mencatat DP sah");
  const f=await buat("CONFIRMED"),tf=await pembayaran(f);const pf=provider.get(tf.referensiProvider);provider.delete(tf.referensiProvider);
  const log=[];await prosesDeadlineBooking(f.id,{sekarang:f.deadlineDp,catat:x=>log.push(x)});assert.equal((await status(f.id)).status,"CANCELLED");assert.ok(log.some(x=>x.kode==="PROVIDER_BELUM_TERVERIFIKASI"));
  provider.set(tf.referensiProvider,pf);settled(tf,tambah(f.deadlineDp,1000));
  await Promise.all([notifikasi(pf),notifikasi(pf),notifikasi(pf)]);
  assert.equal((await status(f.id)).status,"CANCELLED");assert.equal(await db.buktiProviderBooking.count({where:{transaksiId:tf.id}}),1);
  const rf=await db.permohonanRefundBooking.findMany({where:{bookingId:f.id}});assert.equal(rf.length,1);assert.equal(rf[0].nominal,5000);assert.equal(rf[0].status,"PENDING_APPROVAL");
  pass("Provider gagal tidak menahan slot; webhook terlambat/duplicate menyimpan kredit dan satu refund100% wajib ADMIN");
  const g=await buat("CONFIRMED"),tg=await pembayaran(g),pg=settled(tg,tambah(g.dikonfirmasiPada,1000));
  await Promise.all([notifikasi(pg),proses(g,g.deadlineDp)]);assert.equal((await status(g.id)).status,"CONFIRMED");assert.equal(await db.buktiProviderBooking.count({where:{transaksiId:tg.id}}),1);
  pass("Webhook versus scanner: settlement tepatwaktu menang sebagai satu kredit, booking tidak batal");
  const h=await buat("CONFIRMED"),th=await pembayaran(h);settled(th,tambah(h.deadlineDp,1000));await proses(h,tambah(h.deadlineDp,1000));
  assert.equal((await status(h.id)).status,"CANCELLED");assert.equal(await db.permohonanRefundBooking.count({where:{bookingId:h.id}}),1);
  pass("Provider membayar lewat deadline: tidak memberi hak pelayanan; kredit utuh/refund request tunggal");
  const n=await buat("CONFIRMED");await bayarDp(n);const nd=tambah(n.mulaiPada,15*60_000);
  assert.equal(await proses(n,tambah(nd,-1)),null);await proses(n,nd);assert.equal((await status(n.id)).status,"NO_SHOW");
  const nr=await ringkasanPembayaranBooking(n.id);assert.equal(nr.jumlahDibayar,5000);assert.equal(nr.jumlahRefund,0);assert.equal(nr.balance,0);assert.equal(nr.statusPembayaran,"DP_FORFEITED");
  assert.equal(await db.permohonanRefundBooking.count({where:{bookingId:n.id}}),0);assert.equal(await db.invoiceBooking.count({where:{bookingId:n.id}}),0);
  pass("No-show tepat15menit: slot dilepas, DP utuh/hangus, nol refund/sisa tagihan, tidak membuat invoice palsu");
  const consent=await buat("CONFIRMED");await bayarDp(consent);
  const usulanTanpaTimeout=await utc(tx=>tx.usulanBarberBooking.create({data:{bookingId:consent.id,barberId:barber.id,alasan:"Fixture consent pending"}}));
  assert.equal(await proses(consent,tambah(dasar,2*3_600_000)),null);
  assert.equal((await status(consent.id)).status,"CONFIRMED");
  assert.equal((await db.usulanBarberBooking.findUniqueOrThrow({where:{id:usulanTanpaTimeout.id}})).status,"PENDING");
  pass("Consent pending tidak memiliki timeout proposal; setelah2jam dan DP sah sebelum jadwal tetap PENDING/CONFIRMED");
  const ci=await buat("CONFIRMED");await bayarDp(ci);await checkInBooking(ci.id,operator.id,tambah(ci.mulaiPada,-60_000));
  assert.equal(await proses(ci,tambah(ci.mulaiPada,20*60_000)),null);assert.equal((await status(ci.id)).status,"CHECKED_IN");
  await mulaiLayananBooking(ci.id,barber.id,operator.id);assert.equal(await proses(ci,tambah(ci.mulaiPada,20*60_000)),null);
  pass("Early check-in, CHECKED_IN menunggu service dan IN_SERVICE tidak menjadi NO_SHOW");
  const startRace=await buat("CONFIRMED");await bayarDp(startRace);await checkInBooking(startRace.id,operator.id,tambah(startRace.mulaiPada,-60_000));
  // Barber fixture pertama masih melayani; selesaikan hanya fixture sendiri.
  const pesananCi=(await status(ci.id)).pesananId;await utc(tx=>tx.pesanan.update({where:{id:pesananCi},data:{status:"COMPLETED"}}));
  await Promise.all([mulaiLayananBooking(startRace.id,barber.id,operator.id),proses(startRace,tambah(startRace.mulaiPada,15*60_000))]);
  assert.equal((await status(startRace.id)).status,"IN_SERVICE");assert.equal(await riwayat(startRace.id,"AUTO_NO_SHOW"),0);
  pass("IN_SERVICE versus scanner: CHECKED_IN tidak diterminalkan dan hanya satu Pesanan");
  const cir=await buat("CONFIRMED");await bayarDp(cir);const cirD=tambah(cir.mulaiPada,15*60_000);
  const race=await Promise.allSettled([checkInBooking(cir.id,operator.id,cirD),proses(cir,cirD)]);assert.equal(race[0].status,"rejected");assert.equal((await status(cir.id)).status,"NO_SHOW");
  pass("Check-in versus NO_SHOW tepat batas: check-in terlambat ditolak, satu riwayat NO_SHOW");
  const ov=await buat("COMPLETED");await bayarDp(ov);assert.equal(await proses(ov,tambah(ov.deadlinePelunasan,-1)),null);
  assert.equal((await ringkasSaat(ov.id,tambah(ov.deadlinePelunasan,-1))).statusPembayaran,"PARTIALLY_PAID");
  await Promise.all([proses(ov,ov.deadlinePelunasan),proses(ov,ov.deadlinePelunasan)]);
  assert.equal((await ringkasSaat(ov.id,ov.deadlinePelunasan)).statusPembayaran,"OVERDUE");assert.equal(await riwayat(ov.id,"PAYMENT_OVERDUE"),1);
  await bayarPelunasanKasirBooking(ov.id,operator.id,{metode:"CASH",jumlahDiterima:5000,kunciIdempotensi:randomUUID()});
  const ovr=await ringkasanPembayaranBooking(ov.id);assert.equal(ovr.statusPembayaran,"PAID");assert.equal(ovr.balance,0);assert.equal(ovr.invoiceSementara,false);
  assert.equal((await status(ov.id)).status,"COMPLETED");assert.equal(await riwayat(ov.id,"PAYMENT_OVERDUE"),1);assert.equal((await db.pelanggan.findUnique({where:{id:pelanggan.id}})).status,"AKTIF");
  pass("OVERDUE tepat1jam satu histori; kasir masih membayar, PAID/invoice final, COMPLETED/akun tetap, histori utuh");
  const paid=await buat("COMPLETED");await bayarDp(paid);await bayarPelunasanKasirBooking(paid.id,operator.id,{metode:"CASH",jumlahDiterima:5000,kunciIdempotensi:randomUUID()});
  assert.equal(await proses(paid,tambah(paid.deadlinePelunasan,1)),null);assert.equal(await riwayat(paid.id,"PAYMENT_OVERDUE"),0);
  pass("Booking lunas tidak ditandai overdue");
  const online=await buat("COMPLETED");await bayarDp(online);await proses(online,online.deadlinePelunasan);
  const to=await pembayaran(online,"PELUNASAN"),po=settled(to,tambah(online.deadlinePelunasan,1000));await notifikasi(po);await notifikasi(po);
  assert.equal((await ringkasanPembayaranBooking(online.id)).statusPembayaran,"PAID");assert.equal(await db.invoiceBooking.count({where:{bookingId:online.id}}),1);assert.equal(await riwayat(online.id,"PAYMENT_OVERDUE"),1);
  pass("Pelunasan online MOCK setelah overdue tetap aktif; webhook duplicate satu kredit/invoice, histori overdue utuh");
  for(const kanal of ["KASIR","MIDTRANS"]){const pay=await buat("COMPLETED");await bayarDp(pay);
    let bayar;if(kanal==="KASIR")bayar=()=>bayarPelunasanKasirBooking(pay.id,operator.id,{metode:"CASH",jumlahDiterima:5000,kunciIdempotensi:randomUUID()});
    else{const tp=await pembayaran(pay,"PELUNASAN"),pp=settled(tp,pay.deadlinePelunasan);bayar=()=>notifikasi(pp);}
    await Promise.all([bayar(),proses(pay,pay.deadlinePelunasan)]);assert.equal((await ringkasanPembayaranBooking(pay.id)).statusPembayaran,"PAID");assert.ok(await riwayat(pay.id,"PAYMENT_OVERDUE")<=1);assert.equal(await db.invoiceBooking.count({where:{bookingId:pay.id}}),1);}
  pass("Kasir/webhook versus overdue atomik: paid selalu akhir, maksimal satu histori sah sebelum paid, satu invoice");
  const rs=await buat("CONFIRMED");await bayarDp(rs);
  await utc(tx=>tx.usulanBarberBooking.create({data:{bookingId:rs.id,barberId:barber.id,alasan:"Fixture reschedule",status:"REJECTED",diputuskanPada:tambah(rs.dikonfirmasiPada,1000)}}));
  const baru=tambah(rs.mulaiPada,60_000*60);await rescheduleBooking(rs.id,pelanggan.id,pelanggan.akunPelanggan.id,{mulaiPada:baru.toISOString()});
  const rsb=await status(rs.id),rsd=await batas(rsb);assert.equal(rsb.status,"PENDING_CONFIRMATION");assert.equal(rsb.mulaiPada.getTime(),baru.getTime());
  assert.equal(await proses(rsb,tambah(rsd.deadline,-1)),null);await proses(rsb,rsd.deadline);
  assert.equal((await status(rs.id)).status,"CANCELLED");assert.equal(await riwayat(rs.id,"TIMEOUT_RESCHEDULE"),1);assert.equal((await status(rs.id)).mulaiPada.getTime(),baru.getTime());
  const rr=await db.permohonanRefundBooking.findMany({where:{bookingId:rs.id}});assert.equal(rr.length,1);assert.equal(rr[0].nominal,5000);assert.equal(rr[0].status,"PENDING_APPROVAL");assert.equal((await ringkasanPembayaranBooking(rs.id)).jumlahDibayar,5000);
  pass("Reschedule lewat service existing: batas30menit versi aktif, slot baru dilepas/tidak restore lama, DP utuh/refund100% wajib ADMIN");
  const versi=await buat("PENDING_CONFIRMATION",{dibuatPada:tambah(dasar,-3_600_000)});
  await utc(async tx=>{for(const w of [tambah(dasar,-40*60_000),dasar])await tx.riwayatBooking.create({data:{bookingId:versi.id,aksi:"RESCHEDULE",statusSebelum:"CONFIRMED",statusSetelah:"PENDING_CONFIRMATION",dibuatPada:w}});});
  assert.equal(await proses(versi,tambah(dasar,29*60_000)),null);await putuskanBooking(versi.id,operator.id,true,undefined,tambah(dasar,29*60_000));assert.equal(await proses(versi,tambah(dasar,30*60_000)),null);
  pass("Deadline versi reschedule lama tidak membatalkan versi baru; reschedule dikonfirmasi tidak timeout");
  const raceRs=await buat("CONFIRMED",{dikonfirmasiPada:tambah(dasar,-2*3_600_000),deadlineDp:tambah(dasar,-3_600_000)});await bayarDp(raceRs);
  await utc(tx=>tx.usulanBarberBooking.create({data:{bookingId:raceRs.id,barberId:barber.id,alasan:"Fixture race reschedule",status:"REJECTED",diputuskanPada:tambah(raceRs.dikonfirmasiPada,1000)}}));
  const rsJadwal=tambah(raceRs.mulaiPada,60*60_000);
  await Promise.all([rescheduleBooking(raceRs.id,pelanggan.id,pelanggan.akunPelanggan.id,{mulaiPada:rsJadwal.toISOString()}),prosesDeadlineBooking(raceRs.id)]);
  assert.equal((await status(raceRs.id)).status,"PENDING_CONFIRMATION");assert.equal(await riwayat(raceRs.id,"TIMEOUT_RESCHEDULE"),0);assert.equal(await riwayat(raceRs.id,"TIMEOUT_DP"),0);
  pass("Customer reschedule versus scanner DP: DP sah/versi baru tidak dibatalkan dari snapshot lama");
  const roll=await buat(),asli=db.$transaction.bind(db);db.$transaction=(jalan,opsi)=>asli(async tx=>jalan(new Proxy(tx,{get(target,nama){if(nama==="riwayatBooking")return new Proxy(target.riwayatBooking,{get(del,aksi){if(aksi==="create")return async data=>{if(data.data.bookingId===roll.id)throw new Error("ROLLBACK_TEST");return del.create(data);};return Reflect.get(del,aksi);}});return Reflect.get(target,nama);}})),opsi);
  try {await assert.rejects(()=>proses(roll,tambah(roll.dibuatPada,30*60_000)),/ROLLBACK_TEST/);} finally {db.$transaction=asli;}
  assert.equal((await status(roll.id)).status,"PENDING_CONFIRMATION");assert.equal(await riwayat(roll.id),0);await proses(roll,tambah(roll.dibuatPada,30*60_000));
  pass("Kegagalan audit rollback status/histori; pengulangan aman berhasil");
  const uangRollback=await buat("CONFIRMED");await bayarDp(uangRollback);
  const awalRollback=tambah(dasar,-31*60_000);await utc(async tx=>{
    await tx.booking.update({where:{id:uangRollback.id},data:{status:"PENDING_CONFIRMATION",dikonfirmasiPada:null,deadlineDp:null,dpDibawaDariRound:uangRollback.dikonfirmasiPada}});
    await tx.riwayatBooking.create({data:{bookingId:uangRollback.id,aksi:"RESCHEDULE",statusSebelum:"CONFIRMED",statusSetelah:"PENDING_CONFIRMATION",dibuatPada:awalRollback}});
  });
  const asliUang=db.$transaction.bind(db);db.$transaction=(jalan,opsi)=>asliUang(async tx=>jalan(new Proxy(tx,{get(target,nama){if(nama==="permohonanRefundBooking")return new Proxy(target.permohonanRefundBooking,{get(del,aksi){if(aksi==="create")return async()=>{throw new Error("ROLLBACK_REFUND_REQUEST");};return Reflect.get(del,aksi);}});return Reflect.get(target,nama);}})),opsi);
  try{await assert.rejects(()=>prosesDeadlineBooking(uangRollback.id),/ROLLBACK_REFUND_REQUEST/);}finally{db.$transaction=asliUang;}
  assert.equal((await status(uangRollback.id)).status,"PENDING_CONFIRMATION");assert.equal(await riwayat(uangRollback.id,"TIMEOUT_RESCHEDULE"),0);assert.equal(await db.permohonanRefundBooking.count({where:{bookingId:uangRollback.id}}),0);
  assert.equal((await ringkasanPembayaranBooking(uangRollback.id)).jumlahDibayar,5000);await prosesDeadlineBooking(uangRollback.id);
  assert.equal(await db.permohonanRefundBooking.count({where:{bookingId:uangRollback.id}}),1);
  pass("Kegagalan refund request rollback pembatalan dan riwayat bersama; kredit DP tidak berubah; retry satu request");
  // Hilangkan kandidat fixture lain saja sebelum pengujian scanner runtime nyata.
  await utc(tx=>tx.booking.updateMany({where:{id:{in:ids},status:{in:["PENDING_CONFIRMATION","CONFIRMED","CHECKED_IN","IN_SERVICE"]}},data:{status:"CANCELLED",dibatalkanPada:dasar}}));
  const mati=await buat("PENDING_CONFIRMATION",{dibuatPada:tambah(dasar,-31*60_000)});
  const child1=await mulaiAnak();await tunggu(async()=> (await status(mati.id)).status==="CANCELLED");await hentikanAnak(child1);
  const catchup=await buat("PENDING_CONFIRMATION",{dibuatPada:tambah(dasar,-31*60_000)});
  const [child2,child3]=await Promise.all([mulaiAnak(),mulaiAnak()]);await tunggu(async()=> (await status(catchup.id)).status==="CANCELLED");
  assert.equal(await riwayat(catchup.id,"TIMEOUT_CONFIRMATION"),1);await Promise.all([hentikanAnak(child2),hentikanAnak(child3)]);
  pass("Backend HTTP nyata startup/restart catch-up ketika mati; dua proses scanner satu histori; shutdown bersih exit0");
  const gagalSatu=await buat("PENDING_CONFIRMATION",{dibuatPada:tambah(dasar,-31*60_000)}),lanjut=await buat("PENDING_CONFIRMATION",{dibuatPada:tambah(dasar,-31*60_000)});
  const asli2=db.$transaction.bind(db);db.$transaction=(jalan,opsi)=>asli2(async tx=>jalan(new Proxy(tx,{get(target,nama){if(nama==="riwayatBooking")return new Proxy(target.riwayatBooking,{get(del,aksi){if(aksi==="create")return async data=>{if(data.data.bookingId===gagalSatu.id)throw new Error("ERROR_FIXTURE");return del.create(data);};return Reflect.get(del,aksi);}});return Reflect.get(target,nama);}})),opsi);
  let hasilScan;const logs=[];try{hasilScan=await pindaiDeadlineBooking({catat:x=>logs.push(x)});}finally{db.$transaction=asli2;}
  assert.equal(hasilScan.gagal,1);assert.equal((await status(lanjut.id)).status,"CANCELLED");assert.equal((await status(gagalSatu.id)).status,"PENDING_CONFIRMATION");
  assert.ok(!JSON.stringify(logs).includes(password));assert.ok(!JSON.stringify(logs).includes(process.env.MIDTRANS_SERVER_KEY));await pindaiDeadlineBooking();assert.equal(await riwayat(gagalSatu.id),1);
  pass("Satu booking gagal tidak menghentikan kandidat lain; retry scan berikutnya aman; log tidak memuat rahasia");
  const halaman=[];for(let i=0;i<101;i++)halaman.push(await buat("PENDING_CONFIRMATION",{dibuatPada:tambah(dasar,-31*60_000)}));
  const paging=await pindaiDeadlineBooking();assert.equal(paging.berhasil,101);assert.equal(await db.riwayatBooking.count({where:{bookingId:{in:halaman.map(b=>b.id)},aksi:"TIMEOUT_CONFIRMATION"}}),101);
  assert.equal((await pindaiDeadlineBooking()).berhasil,0);
  pass("Pagination melampaui100 kandidat diproses tanpa starvation; scan ulang tidak menggandakan histori");
  process.env.SCHEDULER_BOOKING_AKTIF="true";process.env.SCHEDULER_BOOKING_INTERVAL_MS="1000";
  kendali=mulaiSchedulerBooking();assert.equal(kendali,mulaiSchedulerBooking());await new Promise(r=>setTimeout(r,150));
  const interval=await buat("PENDING_CONFIRMATION",{dibuatPada:tambah(dasar,-31*60_000)});await tunggu(async()=> (await status(interval.id)).status==="CANCELLED");
  await kendali.hentikan();assert.equal(await riwayat(interval.id,"TIMEOUT_CONFIRMATION"),1);
  pass("Runner singleton per proses; kandidat setelah startup diproses scan berkala; stop menunggu pekerjaan selesai");
  const waktuAsli=Date.now;Date.now=()=>0;try{const dbNow=await db.$transaction(waktuDatabaseBooking);assert.ok(dbNow.getUTCFullYear()>=2026);}finally{Date.now=waktuAsli;}
  process.env.SCHEDULER_BOOKING_AKTIF="false";kendali=mulaiSchedulerBooking();await kendali.hentikan();assert.equal(refundCalls,0);
  pass("Clock DB epoch independen clock proses/timezone; kill-switch tersedia; nol panggilan refund provider");
  console.log(`Total: ${lulus} kelompok SCHEDULER PASS; provider MOCK, pembayaran Sandbox nyata tidak diulang.`);
} catch(e) {
  const aman=x=>/^(PENDING|SUCCEEDED|CONFIRMED|CANCELLED|NO_SHOW|CHECKED_IN|COMPLETED|IN_SERVICE|\d+|true|false)$/.test(String(x))?x:"REDACTED";
  console.error(`FAIL SCHEDULER setelah ${lulus} kelompok: ${e.code ?? e.name}; actual=${aman(e.actual)} expected=${aman(e.expected)}; pesan/payload sensitif tidak dicetak.`);
  console.error(e.stack?.split("\n").filter(l=>l.includes("test-scheduler-booking.mjs:")).join("\n")??"");process.exitCode=1;
}
finally {
  await kendali?.hentikan();for(const child of anak){
    if(child.exitCode!==null || child.signalCode!==null)continue;
    const selesai=once(child,"exit");if(child.connected)child.send("hentikan");else child.kill();
    const timer=setTimeout(()=>child.kill(),5000);try{await selesai;}finally{clearTimeout(timer);}
  }
  Object.assign(gerbangMidtrans,sdkAsli);
  try {if(pelanggan){await utc(async tx=>{const books=await tx.booking.findMany({where:{id:{in:ids},pelangganId:pelanggan.id},select:{id:true,pesananId:true}});const bid=books.map(b=>b.id),orders=books.filter(b=>b.pesananId).map(b=>b.pesananId);
    await tx.permohonanRefundBooking.deleteMany({where:{bookingId:{in:bid}}});await tx.invoiceBooking.deleteMany({where:{bookingId:{in:bid}}});
    await tx.transaksiPembayaranBooking.deleteMany({where:{bookingId:{in:bid},tujuan:"REFUND"}});await tx.transaksiPembayaranBooking.deleteMany({where:{bookingId:{in:bid}}});
    await tx.booking.deleteMany({where:{id:{in:bid}}});await tx.pembayaran.deleteMany({where:{pesananId:{in:orders}}});await tx.pesanan.deleteMany({where:{id:{in:orders}}});await tx.pelanggan.delete({where:{id:pelanggan.id}});});}
    if(operator)await db.pengguna.delete({where:{id:operator.id}});if(staff)await db.pengguna.delete({where:{id:staff.id}});if(layanan)await db.layanan.delete({where:{id:layanan.id}});if(barber)await db.barber.delete({where:{id:barber.id}});
    console.log("PASS cleanup: hanya fixture acak milik suite dibersihkan.");
  } finally {await db.$disconnect();}
}
