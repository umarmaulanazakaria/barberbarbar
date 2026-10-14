// Helper subprocess integration test, bukan endpoint atau runtime production.
import "dotenv/config";
if (!process.send || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL ?? "").hostname)) {
  throw new Error("Hanya subprocess IPC pengujian database lokal");
}
await import("../dist/server.js");
process.on("message", pesan => { if (pesan === "hentikan") process.emit("SIGTERM"); });
process.send({ siap: true });
