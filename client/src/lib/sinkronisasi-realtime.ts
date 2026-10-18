import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import type { Role } from "../types";

export const jenisSinyal = ["booking.changed", "order.changed", "payment.changed", "membership.changed", "refund.changed", "customer.changed", "account-link.changed", "catalog.changed"] as const;
export type JenisSinyal = typeof jenisSinyal[number];
export type Sinyal = { id: number; aksi: string; versi: string; waktu: string; refetch: true };
const akarOperator = ["struk-resmi", "pengaturan-operasional", "dashboard", "bookings", "booking", "booking-payments", "orders", "order", "customers", "memberships", "services", "barbers", "invoices", "reports"];
export const akarSinkronisasi = (role: Role) => role === "ADMIN" ? [...akarOperator, "membership-requests", "account-link-requests", "barber-staff-accounts"] : akarOperator;
export function mulaiRealtimeOperator(token: string, role: Role, klien: QueryClient, jendela: Window, dokumen: Document, bukaSocket = () => io({ auth: { token }, autoConnect: false, forceNew: true })) {
  const socket = bukaSocket();
  const bersihkan = pasangSinkronisasi(socket, klien, role, jendela, dokumen);
  let berhenti = false;
  const hentikan = () => {
    if (berhenti) return;
    berhenti = true;
    bersihkan(); socket.removeAllListeners(); socket.disconnect(); socket.auth = {};
    jendela.removeEventListener("auth:logout", hentikan);
    jendela.removeEventListener("auth:session-changing", hentikan);
    jendela.removeEventListener("storage", gantiPenyimpanan);
  };
  const gantiPenyimpanan = (event: StorageEvent) => { if (event.key === null || event.key === "barber_token") { hentikan(); jendela.dispatchEvent(new Event("auth:logout")); } };
  jendela.addEventListener("auth:logout", hentikan);
  jendela.addEventListener("auth:session-changing", hentikan);
  jendela.addEventListener("storage", gantiPenyimpanan);
  socket.connect();
  return hentikan;
}
export function querySinyal(jenis: JenisSinyal, sinyal: Sinyal, role: Role): QueryKey[] {
  const umum = [["dashboard"], ["struk-resmi"], ["invoices"], ["reports"]];
  switch (jenis) {
    case "booking.changed": return [...umum, ["bookings"], ["booking", sinyal.id], ["booking-payments", sinyal.id], ["orders"], ["order"]];
    case "order.changed": return [...umum, ["orders"], ["order", sinyal.id], ["reports"], ["booking"], ["booking-payments"]];
    case "payment.changed": return [...umum, ["bookings"], ["booking-payments", sinyal.id], ["orders"], ["order"], ["invoices"], ["reports"]];
    case "membership.changed": return [...umum, ["memberships"], ["customers"], ...(role === "ADMIN" ? [["membership-requests"]] : [])];
    case "refund.changed": return role === "ADMIN" ? [...umum, ["booking-payments"], ["orders"], ["order"], ["invoices"], ["reports"]] : [];
    case "customer.changed": return [...umum, ["customers"], ["memberships"], ["orders"], ["order"], ["bookings"], ["booking"]];
    case "account-link.changed": return role === "ADMIN" ? [["account-link-requests"], ["customers"], ["dashboard"]] : [];
    case "catalog.changed": return [...umum, ...(sinyal.aksi.toUpperCase().includes("BARBER") ? [["barbers"], ...(role === "ADMIN" ? [["barber-staff-accounts"]] : [])] : sinyal.aksi.toUpperCase().includes("LAYANAN") ? [["services"]] : [["services"], ["barbers"]])];
  }
}

// Sinyal hanya memicu REST. Jangan menulis payload event ke cache domain.
export function pasangSinkronisasi(socket: Socket, klien: QueryClient, role: Role, jendela: Window, dokumen: Document) {
  let aktif = true;
  let terakhirPulih = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tertunda = new Map<string, QueryKey>();
  const seen = new Set<string>();
  const pulihkan = () => {
    if (!aktif || Date.now() - terakhirPulih < 1500) return;
    terakhirPulih = Date.now();
    for (const akar of akarSinkronisasi(role)) void klien.invalidateQueries({ queryKey: [akar] });
  };
  const handlers = jenisSinyal.map(jenis => {
    const handler = (s: Sinyal) => {
      if (!aktif || !s || !Number.isSafeInteger(s.id) || s.id < 1 || s.refetch !== true || typeof s.aksi !== "string" || typeof s.versi !== "string") return;
      const identitas = `${jenis}:${s.id}:${s.aksi}:${s.versi}`;
      if (seen.has(identitas)) return;
      seen.add(identitas);
      if (seen.size > 1000) seen.delete(seen.values().next().value!);
      for (const key of querySinyal(jenis, s, role)) tertunda.set(JSON.stringify(key), key);
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (!aktif) return;
        for (const key of tertunda.values()) void klien.invalidateQueries({ queryKey: key });
        tertunda.clear();
      }, 100);
    };
    socket.on(jenis, handler);
    return { jenis, handler };
  });
  const terlihat = () => { if (dokumen.visibilityState === "visible") pulihkan(); };
  // realtime.ready juga dikirim saat LISTEN PostgreSQL pulih, tanpa reconnect socket.
  const siap = () => { terakhirPulih = 0; pulihkan(); };
  socket.on("connect", pulihkan);
  socket.on("realtime.ready", siap);
  jendela.addEventListener("focus", terlihat);
  jendela.addEventListener("online", pulihkan);
  dokumen.addEventListener("visibilitychange", terlihat);
  // Fallback tetap aktif untuk best-effort delivery dan perubahan REST tanpa socket.
  const polling = setInterval(() => { if (dokumen.visibilityState === "visible") pulihkan(); }, 30000);
  return () => {
    aktif = false;
    if (timer) clearTimeout(timer);
    clearInterval(polling);
    tertunda.clear(); seen.clear();
    for (const { jenis, handler } of handlers) socket.off(jenis, handler);
    socket.off("connect", pulihkan); socket.off("realtime.ready", siap);
    jendela.removeEventListener("focus", terlihat); jendela.removeEventListener("online", pulihkan);
    dokumen.removeEventListener("visibilitychange", terlihat);
  };
}
