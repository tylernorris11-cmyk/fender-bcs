/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `StockLength` table. All the data in the column will be lost.
  - You are about to drop the `StockLengthMovement` table. This table now has no rows — each bundle is its own row instead of a running total with a movement log.
  - A unique constraint covering the columns `[tag]` on the table `StockLength` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tag` to the `StockLength` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "StockLengthMovement" DROP CONSTRAINT "StockLengthMovement_stockLengthId_fkey";

-- DropForeignKey
ALTER TABLE "StockLengthMovement" DROP CONSTRAINT "StockLengthMovement_userId_fkey";

-- DropIndex
DROP INDEX "StockLength_company_lengthFt_lengthIn_thicknessMm_key";

-- AlterTable
ALTER TABLE "StockLength" DROP COLUMN "updatedAt",
ADD COLUMN     "tag" TEXT NOT NULL,
ADD COLUMN     "note" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "producedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "producedById" TEXT,
ALTER COLUMN "weightKg" DROP DEFAULT;

-- DropTable
DROP TABLE "StockLengthMovement";

-- DropEnum
DROP TYPE "StockLengthMovementType";

-- CreateIndex
CREATE UNIQUE INDEX "StockLength_tag_key" ON "StockLength"("tag");

-- CreateIndex
CREATE INDEX "StockLength_company_idx" ON "StockLength"("company");

-- CreateIndex
CREATE INDEX "StockLength_company_lengthFt_lengthIn_thicknessMm_idx" ON "StockLength"("company", "lengthFt", "lengthIn", "thicknessMm");

-- AddForeignKey
ALTER TABLE "StockLength" ADD CONSTRAINT "StockLength_producedById_fkey" FOREIGN KEY ("producedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
