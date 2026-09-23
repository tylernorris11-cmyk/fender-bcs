/*
  Warnings:

  - You are about to drop the column `qty` on the `StockLength` table. All the data in the column will be lost.
  - You are about to drop the column `qty` on the `StockLengthMovement` table. All the data in the column will be lost.
  - Added the required column `weightKg` to the `StockLengthMovement` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "StockLength" DROP COLUMN "qty",
ADD COLUMN     "weightKg" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StockLengthMovement" DROP COLUMN "qty",
ADD COLUMN     "weightKg" DECIMAL(10,2) NOT NULL;
