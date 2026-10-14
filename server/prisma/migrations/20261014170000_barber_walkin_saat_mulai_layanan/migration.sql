BEGIN;
ALTER TABLE "Pesanan" ALTER COLUMN "barberId" DROP NOT NULL;
ALTER TABLE "Pesanan" ADD CONSTRAINT "Pesanan_barber_saat_layanan" CHECK (
  "status" NOT IN ('IN_SERVICE', 'COMPLETED') OR "barberId" IS NOT NULL
);
COMMIT;
