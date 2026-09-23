-- CreateTable
CREATE TABLE "OrderLineBatch" (
    "id" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "qty" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "OrderLineBatch_pkey" PRIMARY KEY ("id")
);

-- Carry over any single-batch picks already recorded, at the line's full quantity.
INSERT INTO "OrderLineBatch" ("id", "orderLineId", "batchId", "qty")
SELECT gen_random_uuid()::text, "id", "batchId", "qty" FROM "OrderLine" WHERE "batchId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "OrderLine" DROP CONSTRAINT "OrderLine_batchId_fkey";

-- AlterTable
ALTER TABLE "OrderLine" DROP COLUMN "batchId";

-- CreateIndex
CREATE INDEX "OrderLineBatch_orderLineId_idx" ON "OrderLineBatch"("orderLineId");

-- CreateIndex
CREATE INDEX "OrderLineBatch_batchId_idx" ON "OrderLineBatch"("batchId");

-- AddForeignKey
ALTER TABLE "OrderLineBatch" ADD CONSTRAINT "OrderLineBatch_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineBatch" ADD CONSTRAINT "OrderLineBatch_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
