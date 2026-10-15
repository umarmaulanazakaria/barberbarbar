import { pindaiDeadlineBooking, type PencatatSchedulerBooking } from "../services/scheduler-booking.service.js";

type KendaliScheduler = { hentikan: () => Promise<void> };
let aktif: KendaliScheduler | undefined;

export const mulaiSchedulerBooking = (): KendaliScheduler => {
  if (aktif) return aktif;
  const pengaturan = process.env.SCHEDULER_BOOKING_AKTIF;
  if (pengaturan !== undefined && !["true", "false"].includes(pengaturan)) throw new Error("SCHEDULER_BOOKING_AKTIF harus true atau false");
  const interval = Number(process.env.SCHEDULER_BOOKING_INTERVAL_MS ?? 15_000);
  if (!Number.isInteger(interval) || interval < 1_000 || interval > 60_000) throw new Error("Interval scheduler harus 1000-60000 ms");
  if (pengaturan === "false") return { hentikan: async () => {} };
  let berhenti = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pekerjaan: Promise<void> = Promise.resolve();
  const catat: PencatatSchedulerBooking = data => console.log(JSON.stringify({ sumber: "scheduler-booking", ...data }));
  const jalankan = () => {
    pekerjaan = (async () => {
      try { await pindaiDeadlineBooking({ berhenti: () => berhenti, catat }); }
      catch { catat({ kejadian: "ERROR", kode: "SCAN_DATABASE_GAGAL" }); }
      finally {
        if (!berhenti) { timer = setTimeout(jalankan, interval); timer.unref(); }
      }
    })();
  };
  aktif = { hentikan: async () => {
    berhenti = true;
    if (timer) clearTimeout(timer);
    await pekerjaan;
    aktif = undefined;
  } };
  // Scanner langsung pada startup: deadline yang terlewat ketika mati ditemukan
  // dari database. Timer hanya pemicu scan; tidak menyimpan job/deadline.
  jalankan();
  return aktif;
};
