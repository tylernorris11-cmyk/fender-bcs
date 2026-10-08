-- AlterTable
ALTER TABLE "ProductionJobRow" ADD COLUMN     "barMarkId" TEXT,
ADD COLUMN     "process" "ProductionProcess";

-- CreateIndex
CREATE UNIQUE INDEX "ProductionJobRow_barMarkId_process_key" ON "ProductionJobRow"("barMarkId", "process");

-- AddForeignKey
ALTER TABLE "ProductionJobRow" ADD CONSTRAINT "ProductionJobRow_barMarkId_fkey" FOREIGN KEY ("barMarkId") REFERENCES "BarMark"("id") ON DELETE SET NULL ON UPDATE CASCADE;

