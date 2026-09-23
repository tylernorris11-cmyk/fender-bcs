-- CreateEnum
CREATE TYPE "NominalType" AS ENUM ('PROFIT_AND_LOSS', 'BALANCE_SHEET');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('NOM');

-- CreateTable
CREATE TABLE "NominalCode" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "NominalType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NominalCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VatCode" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "VatCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsSettings" (
    "company" "Company" NOT NULL,
    "yearStartMonth" INTEGER NOT NULL DEFAULT 4,
    "lockedYear" INTEGER,
    "lockedPeriod" INTEGER,

    CONSTRAINT "AccountsSettings_pkey" PRIMARY KEY ("company")
);

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "company" "Company" NOT NULL,
    "docType" "TransactionType" NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("company","docType")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL,
    "docType" "TransactionType" NOT NULL,
    "ourRef" TEXT NOT NULL,
    "transDate" DATE NOT NULL,
    "year" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedById" TEXT,
    "reversesId" TEXT,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NominalPosting" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "nominalCodeId" TEXT NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "NominalPosting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NominalCode_company_code_key" ON "NominalCode"("company", "code");

-- CreateIndex
CREATE UNIQUE INDEX "VatCode_company_code_key" ON "VatCode"("company", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_reversesId_key" ON "Transaction"("reversesId");

-- CreateIndex
CREATE INDEX "Transaction_company_year_period_idx" ON "Transaction"("company", "year", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_company_ourRef_key" ON "Transaction"("company", "ourRef");

-- CreateIndex
CREATE INDEX "NominalPosting_transactionId_idx" ON "NominalPosting"("transactionId");

-- CreateIndex
CREATE INDEX "NominalPosting_nominalCodeId_idx" ON "NominalPosting"("nominalCodeId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NominalPosting" ADD CONSTRAINT "NominalPosting_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NominalPosting" ADD CONSTRAINT "NominalPosting_nominalCodeId_fkey" FOREIGN KEY ("nominalCodeId") REFERENCES "NominalCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A posting line is either a debit or a credit, never negative and never both.
ALTER TABLE "NominalPosting" ADD CONSTRAINT "NominalPosting_one_sided" CHECK ("debit" >= 0 AND "credit" >= 0 AND ("debit" = 0 OR "credit" = 0) AND ("debit" > 0 OR "credit" > 0));
