import "dotenv/config";
import aplikasi from "./app.js";
import basisData from "./lib/prisma.js";

const PORT = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65_535) {
  throw new Error("PORT harus berupa angka antara 1 dan 65535");
}

const server = aplikasi.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});

server.on("error", (error) => {
  console.error(`Server gagal listen pada port ${PORT}:`, error);
  process.exitCode = 1;
});

let sedangBerhenti = false;

const hentikanServer = (alasan: string, kodeKeluar = 0) => {
  if (sedangBerhenti) return;
  sedangBerhenti = true;
  console.log(`Menghentikan server (${alasan})...`);

  const paksaBerhenti = setTimeout(() => {
    console.error("Server tidak berhenti dalam 10 detik; proses dihentikan paksa.");
    process.exit(1);
  }, 10_000);
  paksaBerhenti.unref();

  server.close(async (error) => {
    if (error) {
      console.error("Gagal menutup HTTP server:", error);
      kodeKeluar = 1;
    }

    try {
      await basisData.$disconnect();
    } catch (errorDatabase) {
      console.error("Gagal memutus koneksi database:", errorDatabase);
      kodeKeluar = 1;
    } finally {
      clearTimeout(paksaBerhenti);
      process.exit(kodeKeluar);
    }
  });
};

process.on("SIGINT", () => hentikanServer("SIGINT"));
process.on("SIGTERM", () => hentikanServer("SIGTERM"));
process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
  hentikanServer("unhandledRejection", 1);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  hentikanServer("uncaughtException", 1);
});
