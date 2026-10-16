BEGIN;
-- Retain the exact legacy rule and add a separate guest rule.
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_deadline_dp_valid";
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_deadline_dp_valid" CHECK (
 ("sumberBooking" = 'AKUN' AND ("deadlineDp" IS NULL OR ("dikonfirmasiPada" IS NOT NULL AND "deadlineDp" = "dikonfirmasiPada" + INTERVAL '1 hour')))
 OR ("sumberBooking" = 'TAMU' AND "deadlineDp" IS NOT NULL AND "deadlineDp" = "dibuatPada" + INTERVAL '15 minutes')
);
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_guest_valid" CHECK (
 ("sumberBooking" = 'TAMU' AND "barberPilihanId" IS NULL AND "barberDisetujuiId" IS NULL AND NOT "membershipAktif" AND "discountPercent" = 0)
 OR ("sumberBooking" = 'AKUN' AND "status"::text <> 'AWAITING_DP')
);
COMMIT;
