import { Server as ServerSocket, type Socket } from "socket.io";
import type { Server as ServerHttp } from "node:http";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import basisData from "../lib/prisma.js";
import { verifikasiIdentitasRealtime, type IdentitasRealtime } from "./autentikasi.js";
import { asalWebTamu, tokenCookieTamu, verifikasiTamuRealtime, type IdentitasTamuRealtime } from "./autentikasi-tamu.js";

const namaEvent = ["booking.changed","order.changed","payment.changed","membership.changed","refund.changed",
  "customer.changed","account-link.changed","catalog.changed"] as const;
const skemaSinyal = z.object({ jenis: z.enum(namaEvent), id: z.number().int().positive(), aksi: z.string().max(80),
  pelangganId: z.number().int().positive().nullable(), operator: z.enum(["ALL","ADMIN"]),
  versi: z.string().regex(/^\d+$/), waktu: z.string().max(80), refetch: z.literal(true) }).strict();
export type SinyalRealtime = z.infer<typeof skemaSinyal>;
type Balasan = (data: { berhasil: boolean }) => void;
type DataSocket = { token: string; identitas: IdentitasRealtime | IdentitasTamuRealtime };
type SocketTerotorisasi = Socket<Record<string, (...args: unknown[]) => void>, Record<string, (data: unknown) => void>,
  Record<string, never>, DataSocket>;

export const pasangRealtime = (http: ServerHttp) => {
  const instance = `barberbarbar-realtime:${randomUUID()}`;
  const asal = new Set((process.env.SOCKET_ALLOWED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173").split(",").map(s=>s.trim()).filter(Boolean));
  const asalTamu = new Set(asalWebTamu());
  for (const origin of asalTamu) asal.add(origin);
  for (const origin of asal) { const url = new URL(origin); if (url.origin !== origin || !["http:","https:"].includes(url.protocol)) throw new Error("SOCKET_ALLOWED_ORIGINS tidak valid"); }
  const io = new ServerSocket<Record<string, (...args: unknown[]) => void>, Record<string, (data: unknown) => void>, Record<string, never>, DataSocket>(http, {
    cors: { origin: [...asal], credentials: true }, maxHttpBufferSize: 8192,
    allowRequest: (req, selesai) => selesai(null, req.headers.origin === undefined || asal.has(req.headers.origin)),
  });
  let listenerSiap = false;
  const periksa = async (socket: SocketTerotorisasi) => {
    try { const identitas = socket.data.identitas.tipe === "TAMU"
      ? await verifikasiTamuRealtime(socket.data.token, socket.data.identitas)
      : await verifikasiIdentitasRealtime(socket.data.token, socket.data.identitas);
      socket.data.identitas = identitas; return identitas; }
    catch { socket.disconnect(true); return null; }
  };
  io.use(async (socket, lanjut) => {
    try {
      if (z.object({ tipe: z.literal("TAMU") }).strict().safeParse(socket.handshake.auth).success) {
        if (!socket.handshake.headers.origin || !asalTamu.has(socket.handshake.headers.origin)) throw new Error("AKSES_DITOLAK");
        socket.data.token = tokenCookieTamu(socket.handshake.headers.cookie);
        socket.data.identitas = await verifikasiTamuRealtime(socket.data.token);
        return lanjut();
      }
      const auth = z.object({ token: z.string().max(4096) }).strict().parse(socket.handshake.auth);
      socket.data.token = auth.token; socket.data.identitas = await verifikasiIdentitasRealtime(auth.token); lanjut();
    } catch { lanjut(new Error("AKSES_DITOLAK")); }
  });
  io.on("connection", socket => {
    const siapa = socket.data.identitas;
    socket.join(siapa.tipe === "TAMU" ? `booking:${siapa.bookingId}` : siapa.tipe === "CUSTOMER" ? `customer:${siapa.pelangganId}` : "operator:all");
    if (siapa.tipe === "ADMIN") socket.join("operator:admin");
    if (siapa.tipe !== "TAMU") socket.join("catalog:authenticated");
    if (listenerSiap) socket.emit("realtime.ready", { protokol: 1, refetch: true });
    const subscription = async (input: unknown, balas: unknown, masuk: boolean) => {
      const ack: Balasan = typeof balas === "function" ? balas as Balasan : () => {};
      const identitas = await periksa(socket);
      const p = z.object({ bookingId: z.number().int().positive() }).strict().safeParse(input);
      if (!identitas || identitas.tipe === "TAMU" || !p.success) return ack({ berhasil: false });
      try {
        const b = await basisData.booking.findFirst({ where: { id: p.data.bookingId,
          ...(identitas.tipe === "CUSTOMER" ? { pelangganId: identitas.pelangganId } : {}) }, select: { id: true } });
        if (!b || !socket.connected) return ack({ berhasil: false });
        const room = `booking:${b.id}`;
        if (masuk && !socket.rooms.has(room) && socket.rooms.size >= 54) return ack({ berhasil: false });
        if (masuk) await socket.join(room); else await socket.leave(room);
        ack({ berhasil: true });
      } catch { ack({ berhasil: false }); }
    };
    socket.on("booking.subscribe", (data, balas) => { void subscription(data, balas, true); });
    socket.on("booking.unsubscribe", (data, balas) => { void subscription(data, balas, false); });
    socket.on("room.join", (_data, balas) => { if (typeof balas === "function") (balas as Balasan)({ berhasil: false }); });
  });
  let berhenti = false;
  let koneksi: Client | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let pekerjaan = Promise.resolve();
  const sudah = new Set<string>();
  const kirim = async (sinyal: SinyalRealtime) => {
    const kunci = `${sinyal.versi}:${sinyal.jenis}:${sinyal.id}:${sinyal.aksi}`;
    if (sudah.has(kunci)) return;
    sudah.add(kunci); if (sudah.size > 5000) sudah.delete(sudah.values().next().value!);
    const publik = { id: sinyal.id, aksi: sinyal.aksi, versi: sinyal.versi, waktu: sinyal.waktu, refetch: true };
    for (const socket of io.sockets.sockets.values()) {
      const identitas = await periksa(socket);
      if (!identitas || !socket.connected) continue;
      if (identitas.tipe === "TAMU") {
        // Trigger existing memakai booking ID untuk booking/payment, pesanan ID untuk order.
        // Room dan relasi ditentukan server, bukan payload subscribe dari browser.
        const sesuai = (sinyal.jenis === "booking.changed" || sinyal.jenis === "payment.changed")
          ? sinyal.id === identitas.bookingId
          : sinyal.jenis === "order.changed" && !!await basisData.booking.findFirst({
            where: { id: identitas.bookingId, pesananId: sinyal.id }, select: { id: true },
          });
        if (sesuai && socket.connected && socket.rooms.has(`booking:${identitas.bookingId}`)) socket.emit(sinyal.jenis, publik);
        continue;
      }
      const boleh = sinyal.jenis === "catalog.changed" ? socket.rooms.has("catalog:authenticated") :
        identitas.tipe === "CUSTOMER" ? sinyal.pelangganId === identitas.pelangganId && socket.rooms.has(`customer:${identitas.pelangganId}`) :
        socket.rooms.has(sinyal.operator === "ADMIN" ? "operator:admin" : "operator:all");
      if (boleh) try { socket.emit(sinyal.jenis, publik); } catch { /* Commit DB sudah sah; kegagalan transport tidak mengubahnya. */ }
    }
  };
  const sambung = async () => {
    if (berhenti) return;
    const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, application_name: instance });
    koneksi = client;
    let dijadwalkan = false;
    const ulang = () => {
      if (dijadwalkan || berhenti) return; dijadwalkan = true;
      listenerSiap = false;
      console.warn("Realtime: koneksi notifikasi database terputus; client harus refetch.");
      void client.end().catch(()=>{});
      retry = setTimeout(()=>{ void sambung(); },2000); retry.unref();
    };
    client.on("error", ulang); client.on("end", ulang);
    client.on("notification", info => {
      if (berhenti || info.channel !== "barberbarbar_realtime" || !info.payload) return;
      try {
        const sinyal = skemaSinyal.parse(JSON.parse(info.payload));
        pekerjaan = pekerjaan.then(()=>kirim(sinyal)).catch(()=>{ console.warn("Realtime: sinyal belum dapat dikirim; refetch diperlukan."); });
      } catch { console.warn("Realtime: format sinyal ditolak."); }
    });
    try {
      await client.connect(); await client.query("LISTEN barberbarbar_realtime"); listenerSiap = true;
      for (const socket of io.sockets.sockets.values()) if (await periksa(socket)) socket.emit("realtime.ready", { protokol: 1, refetch: true });
    }
    catch { ulang(); }
  };
  const siap = sambung();
  let memeriksa = false;
  const pemeriksaan = setInterval(()=>{
    if (memeriksa || berhenti) return; memeriksa = true;
    void (async()=>{ for (const socket of io.sockets.sockets.values()) await periksa(socket); })()
      .finally(()=>{ memeriksa=false; });
  },1000); pemeriksaan.unref();
  return { io, siap, instance, hentikan: async () => {
    berhenti = true; clearInterval(pemeriksaan); if (retry) clearTimeout(retry);
    await siap; await koneksi?.end().catch(()=>{}); await pekerjaan;
    await new Promise<void>(selesai=>io.close(()=>selesai()));
  } };
};
