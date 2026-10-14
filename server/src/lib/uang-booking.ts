const bilangan = (nilai: number) => {
  if (!Number.isSafeInteger(nilai) || nilai < 0) throw new Error("Nominal Rupiah tidak valid");
  return BigInt(nilai);
};
const angka = (nilai: bigint) => {
  if (nilai < 0n || nilai > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Nominal di luar representasi aman");
  return Number(nilai);
};
export const hitungUangBooking = (items: Array<{ harga: number; qty: number }>, persen: number,
  dibayar: number[] = [], direfund: number[] = []) => {
  if (persen !== 0 && persen !== 10) throw new Error("Diskon snapshot tidak valid");
  const subtotal = items.reduce((sum, item) => sum + bilangan(item.harga) * bilangan(item.qty), 0n);
  const diskon = subtotal * BigInt(persen) / 100n;
  const total = subtotal - diskon;
  const bruto = dibayar.reduce((sum, nilai) => sum + bilangan(nilai), 0n);
  const refund = direfund.reduce((sum, nilai) => sum + bilangan(nilai), 0n);
  if (refund > bruto) throw new Error("Refund melebihi pembayaran valid");
  const paid = bruto - refund;
  return { subtotal: angka(subtotal), discountPercent: persen, diskon: angka(diskon), total: angka(total),
    nominalDp: angka((total + 1n) / 2n), jumlahDibayarBruto: angka(bruto), jumlahDibayar: angka(paid), jumlahRefund: angka(refund),
    balance: angka(total > paid ? total - paid : 0n), kelebihan: angka(paid > total ? paid - total : 0n) };
};
