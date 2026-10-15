export const statusBooking = ["PENDING_CONFIRMATION", "CONFIRMED", "CHECKED_IN", "IN_SERVICE", "COMPLETED", "REJECTED", "CANCELLED", "NO_SHOW"];
export const waktuBooking = (nilai: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(nilai)) + " WIB";
