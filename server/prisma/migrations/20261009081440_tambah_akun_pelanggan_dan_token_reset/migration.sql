-- CreateTable
CREATE TABLE "AkunPelanggan" (
    "id" SERIAL NOT NULL,
    "pelangganId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diperbaruiPada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AkunPelanggan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" SERIAL NOT NULL,
    "akunPelangganId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "kedaluwarsaPada" TIMESTAMP(3) NOT NULL,
    "digunakanPada" TIMESTAMP(3),
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AkunPelanggan_pelangganId_key" ON "AkunPelanggan"("pelangganId");

-- CreateIndex
CREATE UNIQUE INDEX "AkunPelanggan_email_key" ON "AkunPelanggan"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_akunPelangganId_idx" ON "PasswordResetToken"("akunPelangganId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_kedaluwarsaPada_idx" ON "PasswordResetToken"("kedaluwarsaPada");

-- AddForeignKey
ALTER TABLE "AkunPelanggan" ADD CONSTRAINT "AkunPelanggan_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "Pelanggan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_akunPelangganId_fkey" FOREIGN KEY ("akunPelangganId") REFERENCES "AkunPelanggan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
