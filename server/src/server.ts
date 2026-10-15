import "dotenv/config";
import aplikasi from "./app.js";
import basisData from "./lib/prisma.js";
import { mulaiSchedulerBooking } from "./lib/scheduler-booking.js";
import { createServer } from "node:http";
import { pasangRealtime } from "./realtime/server.js";

const PORT = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65_535) {
  throw new Error("PORT harus berupa angka antara 1 dan 65535");
}

// Scanner hanya didaftarkan oleh entrypoint, bukan import app pada test HTTP.
let scheduler: ReturnType<typeof mulaiSchedulerBooking> | undefined;
const server = createServer(aplikasi);
const realtime = pasangRealtime(server);
server.listen(PORT, () => {
  scheduler = mulaiSchedulerBooking();
  console.log(`Server berjalan di http://localhost:${PORT}`);
});

server.on("error", () => {
  console.error(`Server gagal listen pada port ${PORT}: LISTEN_ERROR`);
  hentikanServer("LISTEN_ERROR", 1);
});

let sedangBerhenti = false;

const hentikanServer = (alasan: string, kodeKeluar = 0) => {
  if (sedangBerhenti) return;
  sedangBerhenti = true;
  console.log(`Menghentikan server (${alasan})...`);

  const paksaBerhenti = setTimeout(() => {
    console.error("Server tidak berhenti dalam 30 detik; proses dihentikan paksa.");
    process.exit(1);
  }, 30_000);
  paksaBerhenti.unref();

  void (async () => {
    try {
      await scheduler?.hentikan();
      // io.close menutup socket/HTTP yang sama; jangan menunggu HTTP drain
      // sebelum menutup koneksi WebSocket yang berumur panjang.
      await realtime.hentikan();
      await basisData.$disconnect();
    } catch {
      console.error("Gagal memutus koneksi database: DATABASE_DISCONNECT_FAILED");
      kodeKeluar = 1;
    } finally {
      clearTimeout(paksaBerhenti);
      process.exit(kodeKeluar);
    }
  })();
};

process.on("SIGINT", () => hentikanServer("SIGINT"));
process.on("SIGTERM", () => hentikanServer("SIGTERM"));
process.on("unhandledRejection", () => {
  console.error("Unhandled rejection: ASYNC_FAILURE");
  hentikanServer("unhandledRejection", 1);
});
process.on("uncaughtException", () => {
  console.error("Uncaught exception: PROCESS_FAILURE");
  hentikanServer("uncaughtException", 1);
});
