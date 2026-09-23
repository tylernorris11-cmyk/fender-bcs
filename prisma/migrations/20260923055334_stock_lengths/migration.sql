-- CreateEnum
CREATE TYPE "StockLengthMovementType" AS ENUM ('PRODUCED', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "StockLength" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL DEFAULT 'BS_SUPPLIES',
    "lengthFt" INTEGER NOT NULL,
    "lengthIn" INTEGER NOT NULL DEFAULT 0,
    "thicknessMm" DECIMAL(6,2) NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLength_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLengthMovement" (
    "id" TEXT NOT NULL,
    "stockLengthId" TEXT NOT NULL,
    "type" "StockLengthMovementType" NOT NULL,
    "qty" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLengthMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockLength_company_lengthFt_lengthIn_thicknessMm_key" ON "StockLength"("company", "lengthFt", "lengthIn", "thicknessMm");

-- CreateIndex
CREATE INDEX "StockLengthMovement_stockLengthId_at_idx" ON "StockLengthMovement"("stockLengthId", "at");

-- AddForeignKey
ALTER TABLE "StockLengthMovement" ADD CONSTRAINT "StockLengthMovement_stockLengthId_fkey" FOREIGN KEY ("stockLengthId") REFERENCES "StockLength"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLengthMovement" ADD CONSTRAINT "StockLengthMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
