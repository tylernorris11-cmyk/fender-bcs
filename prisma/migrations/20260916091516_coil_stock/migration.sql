-- CreateEnum
CREATE TYPE "CoilGrade" AS ENUM ('SOFT', 'MEDIUM', 'HIGH_CARBON');

-- CreateTable
CREATE TABLE "Coil" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL DEFAULT 'BS_SUPPLIES',
    "ref" TEXT NOT NULL,
    "grade" "CoilGrade",
    "weightKg" DECIMAL(10,2),
    "note" TEXT NOT NULL DEFAULT '',
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allocatedById" TEXT,
    "receivedAt" TIMESTAMP(3),
    "receivedById" TEXT,

    CONSTRAINT "Coil_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coil_ref_key" ON "Coil"("ref");

-- CreateIndex
CREATE INDEX "Coil_company_idx" ON "Coil"("company");

-- CreateIndex
CREATE INDEX "Coil_company_receivedAt_idx" ON "Coil"("company", "receivedAt");

-- AddForeignKey
ALTER TABLE "Coil" ADD CONSTRAINT "Coil_allocatedById_fkey" FOREIGN KEY ("allocatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coil" ADD CONSTRAINT "Coil_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
