-- CreateTable
CREATE TABLE "Membership" (
    "id" SERIAL NOT NULL,
    "pelangganId" INTEGER NOT NULL,
    "memberCode" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Membership_pelangganId_key" ON "Membership"("pelangganId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_memberCode_key" ON "Membership"("memberCode");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "Pelanggan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
