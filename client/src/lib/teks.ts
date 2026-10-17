export const pesanPembayaranPercobaan = 'Pembayaran percobaan — tidak ada uang sungguhan yang ditarik.';
export function pesanAman(pesan: unknown, pengganti = 'Terjadi kendala. Silakan coba beberapa saat lagi.') {
  if (typeof pesan !== 'string' || pesan.length > 350 || !pesan.trim() || !/\s/.test(pesan)) return pengganti;
  if (/[{}\[\]<>\n\r]|https?:\/\/|\bat\s+\w+.*:\d+|\b(?:API|backend|server|internal|stack|error|cannot|unexpected|EPERM|ENOENT|EACCES|endpoint|webhook|callback|socket|database|Prisma|JWT|token|Sandbox|developer|development|debug|mock|payload|schema|provider|snapshot|scheduler|reconcile|rekonsiliasi|request|reserved|constraint|transaction|undefined|null|TypeError|Error:|ECONN\w*|project\s*[345]|F\d+)\b/i.test(pesan)) return pengganti;
  return pesan;
}
const label: Record<string, string> = {
  MEMBER_CONFIRMED: "Bebas DP Membership", NO_PAYMENT_DUE: "Tanpa Tagihan", VERIFY_MEMBERSHIP_IDENTITY: "Identitas Member Diperiksa", MEMBER_GUEST_CONFIRMED: "Booking Member Dikonfirmasi",
  PENDING_CONFIRMATION: 'Menunggu Konfirmasi', CONFIRMED: 'Booking Dikonfirmasi', CHECKED_IN: 'Sudah Check-in',
  IN_SERVICE: 'Sedang Dilayani', COMPLETED: 'Layanan Selesai', REJECTED: 'Ditolak', CANCELLED: 'Dibatalkan', NO_SHOW: 'Tidak Hadir',
  PENDING_APPROVAL: 'Menunggu Persetujuan', PENDING: 'Menunggu Konfirmasi', PROCESSING: 'Sedang Diproses',
  APPROVED: 'Disetujui', SUCCEEDED: 'Berhasil', FAILED: 'Gagal', EXPIRED: 'Kedaluwarsa', UNSUPPORTED: 'Perlu Penanganan Pengelola',
  AWAITING_DP: 'Menunggu Pembayaran Uang Muka', DP_PAID: 'Uang Muka Terverifikasi', PARTIALLY_PAID: 'Dibayar Sebagian',
  UNPAID: 'Belum Dibayar', PAID: 'Pembayaran Berhasil', OVERDUE: 'Pembayaran Belum Dilunasi',
  REFUND_REVIEW: 'Pembayaran Perlu Ditinjau', DP_FORFEITED: 'Uang Muka Hangus',
  ACTIVE: 'Member Aktif', INACTIVE: 'Nonaktif', NON_MEMBER: 'Belum Menjadi Member', AKTIF: 'Aktif', DIBLOKIR: 'Diblokir',
  WAITING: 'Menunggu', DP: 'Uang Muka', PELUNASAN: 'Pelunasan', REFUND: 'Pengembalian Dana',
  MIDTRANS: 'Online', KASIR: 'Kasir', CASH: 'Tunai', CARD: 'Kartu', TRANSFER: 'Transfer', OTHER: 'Lainnya', QRIS: 'QRIS',
  DISETUJUI: 'Disetujui', DITOLAK: 'Ditolak', MENUNGGU: 'Menunggu Persetujuan',
  CREATE: 'Booking Diajukan', CREATED: 'Booking Diajukan', SUBMIT: 'Booking Diajukan', CONFIRM: 'Booking Dikonfirmasi',
  REJECT: 'Booking Ditolak', CANCEL: 'Booking Dibatalkan', CHECK_IN: 'Pelanggan Datang', START: 'Layanan Dimulai',
  COMPLETE: 'Layanan Selesai', RESCHEDULE: 'Jadwal Diubah', UPDATE_SERVICES: 'Layanan Diubah', CHANGE_SERVICES: 'Layanan Diubah',
  PROPOSE_BARBER: 'Pengganti Barber Diusulkan', ACCEPT_BARBER: 'Barber Pengganti Disetujui', REJECT_BARBER: 'Barber Pengganti Ditolak',
  TIMEOUT_CONFIRMATION: 'Batas Konfirmasi Terlewati', TIMEOUT_RESCHEDULE: 'Batas Konfirmasi Jadwal Terlewati',
  TIMEOUT_DP: 'Batas Pembayaran Uang Muka Terlewati', PAYMENT_OVERDUE: 'Batas Pelunasan Terlewati',
  PAYMENT_STATUS_VERIFIED: 'Status Pembayaran Diperbarui',
};
export const statusRamah = (status: string | null) => status === null ? '—' : label[status] ?? 'Status Diperbarui';
export function rincianRamah(data: unknown) {
  if (typeof data !== 'object' || data === null) return '';
  const nilai = data as Record<string, unknown>;
  const catatan = pesanAman(nilai.alasan ?? nilai.catatan, '');
  const uang = typeof nilai.nominal === 'number' && Number.isSafeInteger(nilai.nominal) && nilai.nominal >= 0
    ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(nilai.nominal) : '';
  return [catatan, uang].filter(Boolean).join(' · ');
}
