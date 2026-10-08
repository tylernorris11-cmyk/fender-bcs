-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryNoteSeq" INTEGER,
ADD COLUMN     "invoiceAddress" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "Order_company_deliveryNoteSeq_key" ON "Order"("company", "deliveryNoteSeq");

