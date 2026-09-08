-- CreateEnum
CREATE TYPE "CertificateSize" AS ENUM ('MM10', 'MM12', 'MM16', 'MM20', 'MM25', 'MM32', 'MESH');

-- AlterTable
ALTER TABLE "TestCertificate" ADD COLUMN     "size" "CertificateSize";

-- CreateIndex
CREATE INDEX "TestCertificate_company_size_idx" ON "TestCertificate"("company", "size");
