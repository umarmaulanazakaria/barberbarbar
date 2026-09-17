export const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
export const waktu = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
export const tanggal = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
const statusLabels: Record<string, string> = {
  WAITING: "Waiting",
  IN_SERVICE: "In Service",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  UNPAID: "Unpaid",
  PAID: "Paid",
};
export const labelStatus = (value: string) => statusLabels[value] ?? value;
