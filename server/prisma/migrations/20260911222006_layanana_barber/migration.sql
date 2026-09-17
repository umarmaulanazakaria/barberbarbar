-- CreateTable
CREATE TABLE "Barber" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "nomorTelepon" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Barber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Layanan" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "durasiMenit" INTEGER NOT NULL,
    "harga" INTEGER NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Layanan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Barber_nomorTelepon_key" ON "Barber"("nomorTelepon");
