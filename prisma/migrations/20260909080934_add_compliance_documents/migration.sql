-- CreateEnum
CREATE TYPE "ComplianceDocumentCategory" AS ENUM ('PROCEDURE', 'CARES_GUIDANCE', 'SCOPE_OF_APPROVAL', 'OTHER');

-- CreateTable
CREATE TABLE "ComplianceDocument" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL DEFAULT 'FENDER',
    "category" "ComplianceDocumentCategory" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ComplianceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceDocument_company_idx" ON "ComplianceDocument"("company");

-- CreateIndex
CREATE INDEX "ComplianceDocument_category_idx" ON "ComplianceDocument"("category");

-- AddForeignKey
ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
