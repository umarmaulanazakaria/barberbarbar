// Helper/harness minimal. Integrasi UI Web/Mobile/Customer dikerjakan berikutnya.
import { io } from "socket.io-client";
export const eventPerubahan = ["booking.changed","order.changed","payment.changed","membership.changed",
  "refund.changed","customer.changed","account-link.changed","catalog.changed"];
export const buatKlienRealtime = ({ alamat, ambilToken, refetch, gangguan = () => {} }) => {
  const socket = io(alamat, { autoConnect: false, reconnection: true });
  let selesai = false, aktif = false;
  const terlihat = new Set();
  const segarkan = data => {
    if (selesai) return;
    void Promise.resolve().then(()=>refetch(data)).catch(()=>gangguan("REFETCH_GAGAL"));
  };
  const siap = () => { terlihat.clear(); segarkan({ jenis: "realtime.ready", refetch: true }); };
  const perubahan = new Map(eventPerubahan.map(jenis => [jenis, data => {
    if (!data?.refetch) return;
    const key = `${jenis}:${data.id}:${data.versi}:${data.aksi}`;
    if (terlihat.has(key)) return;
    terlihat.add(key); if (terlihat.size > 1000) terlihat.delete(terlihat.values().next().value);
    segarkan({ jenis, ...data });
  }]));
  const error = () => gangguan("KONEKSI_DITOLAK_ATAU_TERPUTUS");
  return {
    socket,
    hubungkan: async () => {
      if (selesai) throw new Error("KLIEN_SUDAH_DITUTUP");
      if (!aktif) {
        aktif = true; socket.on("realtime.ready", siap); socket.on("connect_error", error);
        for (const [jenis, listener] of perubahan) socket.on(jenis, listener);
      }
      socket.auth = { token: await ambilToken() }; socket.connect();
    },
    pulihkan: () => segarkan({ jenis: "realtime.ready", refetch: true }), // foreground/online: REST refetch
    hentikan: () => {
      selesai = true; socket.off("realtime.ready", siap); socket.off("connect_error", error);
      for (const [jenis, listener] of perubahan) socket.off(jenis, listener);
      socket.disconnect(); terlihat.clear();
    },
  };
};
