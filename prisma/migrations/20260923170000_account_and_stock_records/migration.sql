-- DropIndex
DROP INDEX "Customer_code_key";

-- DropIndex
DROP INDEX "Product_code_key";

-- DropIndex
DROP INDEX "Supplier_name_key";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "nominalCodeId" TEXT,
ADD COLUMN     "vatCodeId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "costOfSalesNominalId" TEXT,
ADD COLUMN     "preferredSupplierId" TEXT,
ADD COLUMN     "salesNominalId" TEXT,
ADD COLUMN     "stockGroupId" TEXT,
ADD COLUMN     "stockNominalId" TEXT,
ADD COLUMN     "vatCodeId" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "code" TEXT,
ADD COLUMN     "nominalCodeId" TEXT,
ADD COLUMN     "vatCodeId" TEXT;

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "code" TEXT;

-- CreateTable
CREATE TABLE "StockGroup" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "StockGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockGroup_company_idx" ON "StockGroup"("company");

-- CreateIndex
CREATE UNIQUE INDEX "StockGroup_company_code_key" ON "StockGroup"("company", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_company_code_key" ON "Customer"("company", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Product_company_code_key" ON "Product"("company", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_company_code_key" ON "Supplier"("company", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_company_name_key" ON "Supplier"("company", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Location_code_key" ON "Location"("code");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_vatCodeId_fkey" FOREIGN KEY ("vatCodeId") REFERENCES "VatCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_nominalCodeId_fkey" FOREIGN KEY ("nominalCodeId") REFERENCES "NominalCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_stockGroupId_fkey" FOREIGN KEY ("stockGroupId") REFERENCES "StockGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_preferredSupplierId_fkey" FOREIGN KEY ("preferredSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_vatCodeId_fkey" FOREIGN KEY ("vatCodeId") REFERENCES "VatCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_salesNominalId_fkey" FOREIGN KEY ("salesNominalId") REFERENCES "NominalCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_costOfSalesNominalId_fkey" FOREIGN KEY ("costOfSalesNominalId") REFERENCES "NominalCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_stockNominalId_fkey" FOREIGN KEY ("stockNominalId") REFERENCES "NominalCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockGroup" ADD CONSTRAINT "StockGroup_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "StockGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_vatCodeId_fkey" FOREIGN KEY ("vatCodeId") REFERENCES "VatCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_nominalCodeId_fkey" FOREIGN KEY ("nominalCodeId") REFERENCES "NominalCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Today's product categories become top-level stock groups, one per company.
INSERT INTO "StockGroup" ("id", "company", "name")
SELECT gen_random_uuid()::text, "company", "category"
FROM (SELECT DISTINCT "company", "category" FROM "Product" WHERE "category" <> '') AS c;

UPDATE "Product" p
SET "stockGroupId" = g."id"
FROM "StockGroup" g
WHERE g."company" = p."company" AND g."name" = p."category" AND g."parentId" IS NULL;

-- Short codes for the two depots, Exchequer-style.
UPDATE "Location" SET "code" = 'SCU' WHERE "name" = 'Scunthorpe';
UPDATE "Location" SET "code" = 'HOU' WHERE "name" = 'Houghton le Spring';
