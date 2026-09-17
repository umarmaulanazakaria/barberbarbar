-- CreateTable
CREATE TABLE "Pelanggan" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "nomorTelepon" TEXT NOT NULL,
    "alamat" TEXT,
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pelanggan_pkey" PRIMARY KEY ("id")
);
