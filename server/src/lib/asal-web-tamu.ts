import { networkInterfaces, type NetworkInterfaceInfo } from "node:os";

export const asalWebTamu = (antarmuka: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces()) => {
  const asal = new Set((process.env.GUEST_WEB_ORIGINS ??
    "http://localhost:5175,http://127.0.0.1:5175").split(",").map(s => s.trim()).filter(Boolean));
  // Hanya development lokal: IP privat yang benar-benar dimiliki komputer ini.
  // Production tetap menggunakan allowlist eksplisit tanpa perluasan otomatis.
  if (process.env.NODE_ENV !== "production") {
    for (const daftar of Object.values(antarmuka)) for (const alamat of daftar ?? []) {
      if (alamat.family === "IPv4" && !alamat.internal &&
        /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(alamat.address))
        asal.add(`http://${alamat.address}:5175`);
    }
  }
  return [...asal];
};
