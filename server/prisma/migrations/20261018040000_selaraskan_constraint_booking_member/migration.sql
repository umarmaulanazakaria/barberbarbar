BEGIN;
SET LOCAL lock_timeout = '5s';
SELECT pg_advisory_xact_lock(7354, 1);

-- Harga Member sudah diterapkan per item oleh backend, bukan diskon global kedua.
-- Cabang non-Member mempertahankan rumus snapshot dan DP lama.
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_snapshot_valid";
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_snapshot_valid" CHECK (
  "durasiMenit" > 0 AND "selesaiPada" > "mulaiPada"
  AND EXTRACT(EPOCH FROM ("selesaiPada" - "mulaiPada")) = "durasiMenit" * 60
  AND EXTRACT(SECOND FROM "mulaiPada") = 0
  AND "zonaWaktu" = 'Asia/Jakarta'
  AND ("mulaiPada" AT TIME ZONE 'Asia/Jakarta')::date = ("selesaiPada" AT TIME ZONE 'Asia/Jakarta')::date
  AND ("mulaiPada" AT TIME ZONE 'Asia/Jakarta')::time >= TIME '09:00'
  AND ("selesaiPada" AT TIME ZONE 'Asia/Jakarta')::time <= TIME '23:00'
  AND "subtotal" >= 0 AND "total" >= 0
  AND "total" = "subtotal" - "diskon"
  AND (
    (NOT "memberBebasDp"
      AND "discountPercent" = CASE WHEN "membershipAktif" THEN 10 ELSE 0 END
      AND "diskon" = floor("subtotal"::numeric * "discountPercent" / 100)
      AND "dpPersen" = 50 AND "nominalDp" = ceil("total"::numeric / 2))
    OR ("memberBebasDp" AND "membershipBerbayarId" IS NOT NULL
      AND "membershipAktif" AND "snapshotManfaat" IS NOT NULL
      AND "discountPercent" = 0 AND "diskon" = 0
      AND "dpPersen" = 0 AND "nominalDp" = 0 AND "deadlineDp" IS NULL)
  )
);
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_deadline_dp_valid";
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_deadline_dp_valid" CHECK (
  ("memberBebasDp" AND "membershipBerbayarId" IS NOT NULL AND "deadlineDp" IS NULL)
  OR (NOT "memberBebasDp" AND (
    ("sumberBooking" = 'AKUN' AND ("deadlineDp" IS NULL OR ("dikonfirmasiPada" IS NOT NULL AND "deadlineDp" = "dikonfirmasiPada" + INTERVAL '1 hour')))
    OR ("sumberBooking" = 'TAMU' AND "deadlineDp" IS NOT NULL AND "deadlineDp" = "dibuatPada" + INTERVAL '15 minutes')
  ))
);
-- Pilihan Barber dari katalog aktif divalidasi service dan FK existing.
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_guest_valid";
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_guest_valid" CHECK (
  ("sumberBooking" = 'TAMU' AND "barberDisetujuiId" IS NULL AND "discountPercent" = 0
    AND ((NOT "memberBebasDp" AND NOT "membershipAktif")
      OR ("memberBebasDp" AND "membershipAktif" AND "membershipBerbayarId" IS NOT NULL)))
  OR ("sumberBooking" = 'AKUN' AND "status"::text <> 'AWAITING_DP')
);
COMMIT;
