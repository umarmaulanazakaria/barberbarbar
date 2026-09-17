/*
  Warnings:

  - A unique constraint covering the columns `[barberId]` on the table `Pengguna` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Pengguna" ADD COLUMN     "barberId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Pengguna_barberId_key" ON "Pengguna"("barberId");

-- AddForeignKey
ALTER TABLE "Pengguna" ADD CONSTRAINT "Pengguna_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
