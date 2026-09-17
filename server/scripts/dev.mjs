import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const direktoriServer = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const tsc = path.join(direktoriServer, "node_modules", "typescript", "bin", "tsc");

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
  spawn(process.execPath, ["--watch", "dist/server.js"], {
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
