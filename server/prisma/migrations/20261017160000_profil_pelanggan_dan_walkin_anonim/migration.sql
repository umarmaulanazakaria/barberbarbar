BEGIN;
CREATE TABLE "ProfilPelanggan" (
 "id" SERIAL PRIMARY KEY,"pelangganId" INTEGER NOT NULL UNIQUE REFERENCES "Pelanggan"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "nama" TEXT NOT NULL,"nomorTelepon" TEXT,"email" TEXT,"catatan" TEXT,
 "dibuatPada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"diarsipkanPada" TIMESTAMPTZ(3)
);
CREATE INDEX "ProfilPelanggan_nomorTelepon_idx" ON "ProfilPelanggan"("nomorTelepon");
CREATE INDEX "ProfilPelanggan_email_idx" ON "ProfilPelanggan"(email);
CREATE TABLE "RiwayatProfilPelanggan" (
 "id" SERIAL PRIMARY KEY,"profilId" INTEGER NOT NULL REFERENCES "ProfilPelanggan"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "penggunaId" INTEGER,"aksi" TEXT NOT NULL,"rincian" JSONB,"dibuatPada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "RiwayatProfilPelanggan_profilId_dibuatPada_idx" ON "RiwayatProfilPelanggan"("profilId","dibuatPada");
ALTER TABLE "Pesanan" ALTER COLUMN "pelangganId" DROP NOT NULL;
ALTER TABLE "Pesanan" ADD COLUMN "profilPelangganId" INTEGER REFERENCES "ProfilPelanggan"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD COLUMN "profilPelangganId" INTEGER REFERENCES "ProfilPelanggan"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
-- Pertahankan pelanggan manual/Walk-in lama. Identitas khusus Booking tamu dan
-- pendaftaran akun tanpa Walk-in tidak otomatis menjadi profil operator.
INSERT INTO "ProfilPelanggan"("pelangganId",nama,"nomorTelepon","dibuatPada","diarsipkanPada")
SELECT c.id,c.nama,CASE WHEN c."nomorTelepon" IS NULL THEN NULL ELSE regexp_replace(regexp_replace(c."nomorTelepon",'[[:space:]().+\-]','','g'),'^62','0') END,c."dibuatPada" AT TIME ZONE 'UTC',NULL
FROM "Pelanggan" c WHERE (c."nomorTelepon" IS NULL OR c."nomorTelepon" NOT LIKE 'TAMU-%')
AND (EXISTS(SELECT 1 FROM "Pesanan" p WHERE p."pelangganId"=c.id AND NOT EXISTS(SELECT 1 FROM "Booking" b WHERE b."pesananId"=p.id))
OR (NOT EXISTS(SELECT 1 FROM "Booking" b WHERE b."pelangganId"=c.id) AND NOT EXISTS(SELECT 1 FROM "AkunPelanggan" a WHERE a."pelangganId"=c.id)));
UPDATE "Pesanan" p SET "profilPelangganId"=f.id FROM "ProfilPelanggan" f WHERE p."pelangganId"=f."pelangganId" AND NOT EXISTS(SELECT 1 FROM "Booking" b WHERE b."pesananId"=p.id);
INSERT INTO "RiwayatProfilPelanggan"("profilId",aksi,rincian) SELECT id,'MIGRASI_PROFIL',jsonb_build_object('sumber','PELANGGAN_MANUAL_WALKIN_EXISTING') FROM "ProfilPelanggan";
COMMIT;
