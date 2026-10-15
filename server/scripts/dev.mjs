import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createConnection } from "node:net";

const direktoriServer = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const tsc = path.join(direktoriServer, "node_modules", "typescript", "bin", "tsc");
// Gagal sebelum compiler/watch dijalankan bila backend sudah hidup. Tidak
// menghentikan proses pemilik port; launcher memeriksa identitasnya tersendiri.
const digunakan = await new Promise(resolve => {
  const koneksi = createConnection({ host: '127.0.0.1', port: Number(process.env.PORT ?? 3000) });
  koneksi.once('connect', () => { koneksi.destroy(); resolve(true); });
  koneksi.once('error', () => resolve(false));
});
if (digunakan) {
  console.error('Port backend sudah digunakan. Gunakan launcher atau hentikan backend yang telah diverifikasi sebelum npm run dev.');
  process.exit(1);
}

const build = spawnSync(process.execPath, [tsc, "-p", "tsconfig.json"], {
  cwd: direktoriServer,
  stdio: "inherit",
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const proses = [
  spawn(
    process.execPath,
    [tsc, "-p", "tsconfig.json", "--watch", "--preserveWatchOutput"],
    { cwd: direktoriServer, stdio: "inherit" },
  ),
  // Batasi watch ke hasil compiler; perubahan node_modules bukan pemicu restart.
  spawn(process.execPath, ["--watch-path=dist", "--watch-preserve-output", "dist/server.js"], {
    cwd: direktoriServer,
    stdio: "inherit",
  }),
];

let sedangBerhenti = false;

const hentikan = (kode = 0) => {
  if (sedangBerhenti) return;
  sedangBerhenti = true;
  for (const anak of proses) {
    if (!anak.killed) anak.kill();
  }
  process.exitCode = kode;
};

for (const anak of proses) {
  anak.on("error", (error) => {
    console.error("Gagal menjalankan proses development:", error);
    hentikan(1);
  });
  anak.on("exit", (kode, sinyal) => {
    if (!sedangBerhenti && (kode !== 0 || sinyal)) hentikan(kode ?? 1);
  });
}

process.on("SIGINT", () => hentikan());
process.on("SIGTERM", () => hentikan());
