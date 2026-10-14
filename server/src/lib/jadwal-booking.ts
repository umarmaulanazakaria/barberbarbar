export const zonaBooking = "Asia/Jakarta";
const menit = 60_000;
const format = new Intl.DateTimeFormat("en-CA", { timeZone: zonaBooking,
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const bagian = (waktu: Date) => {
  const p = Object.fromEntries(format.formatToParts(waktu).map(item => [item.type, item.value]));
  return { tanggal: `${p.year}-${p.month}-${p.day}`, menitHari: Number(p.hour) * 60 + Number(p.minute) };
};
export const validasiWaktuBooking = (mulai: Date, durasi: number, sekarang = new Date()) => {
  if (!Number.isFinite(mulai.getTime()) || !Number.isSafeInteger(durasi) || durasi <= 0 ||
      mulai.getUTCSeconds() !== 0 || mulai.getUTCMilliseconds() !== 0) return null;
  if (mulai <= sekarang || mulai.getTime() > sekarang.getTime() + 14 * 24 * 60 * menit) return null;
  const awal = bagian(mulai);
  if (awal.tanggal === bagian(sekarang).tanggal && mulai.getTime() < sekarang.getTime() + 180 * menit) return null;
  const selesai = new Date(mulai.getTime() + durasi * menit);
  const akhir = bagian(selesai);
  if (awal.menitHari < 9 * 60 || awal.menitHari >= 23 * 60 ||
      awal.tanggal !== akhir.tanggal || akhir.menitHari > 23 * 60) return null;
  return selesai;
};

type Rentang = { mulaiPada: Date; selesaiPada: Date };
// Sweep event memakai end sebelum start pada menit sama: overlap [start,end).
// Tidak menjumlah semua booking yang menyentuh rentang kandidat sekaligus.
export const kapasitasBookingCukup = (rentang: Rentang[], calon: Rentang, kapasitas: number) => {
  if (kapasitas < 1) return false;
  const kejadian: Array<[number, number]> = [];
  for (const booking of [...rentang, calon]) {
    const awal = Math.max(booking.mulaiPada.getTime(), calon.mulaiPada.getTime());
    const akhir = Math.min(booking.selesaiPada.getTime(), calon.selesaiPada.getTime());
    if (awal < akhir) kejadian.push([awal, 1], [akhir, -1]);
  }
  kejadian.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let terpakai = 0;
  for (const [, perubahan] of kejadian) { terpakai += perubahan; if (terpakai > kapasitas) return false; }
  return true;
};
