-- CreateEnum
CREATE TYPE "SteelGauge" AS ENUM ('LIGHT', 'HEAVY');

-- CreateTable
CREATE TABLE "SteelStockItem" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL DEFAULT 'FENDER',
    "gauge" "SteelGauge" NOT NULL,
    "castNumber" TEXT NOT NULL,
    "diameterMm" INTEGER NOT NULL,
    "lengthM" INTEGER,
    "weightKg" DECIMAL(10,2) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedById" TEXT,

    CONSTRAINT "SteelStockItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SteelStockItem_company_gauge_diameterMm_idx" ON "SteelStockItem"("company", "gauge", "diameterMm");

-- CreateIndex
CREATE INDEX "SteelStockItem_castNumber_idx" ON "SteelStockItem"("castNumber");

-- AddForeignKey
ALTER TABLE "SteelStockItem" ADD CONSTRAINT "SteelStockItem_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

