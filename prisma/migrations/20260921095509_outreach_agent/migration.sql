-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACT_FOUND', 'NO_CONTACT_FOUND', 'DRAFTED', 'APPROVED', 'SENT', 'REPLIED', 'BOUNCED', 'OPTED_OUT', 'REJECTED');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyNumber" TEXT NOT NULL,
    "companyType" TEXT NOT NULL DEFAULT '',
    "sicCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "website" TEXT NOT NULL DEFAULT '',
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "contactName" TEXT NOT NULL DEFAULT '',
    "registeredAddress" TEXT NOT NULL DEFAULT '',
    "postcode" TEXT NOT NULL DEFAULT '',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "source" TEXT NOT NULL DEFAULT 'companies_house',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachEmail" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "senderLabel" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "draftedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "postmarkId" TEXT NOT NULL DEFAULT '',
    "failReason" TEXT NOT NULL DEFAULT '',
    "unsubscribeToken" TEXT NOT NULL,
    "repliedAt" TIMESTAMP(3),
    "replyText" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "OutreachEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachSuppression" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_companyNumber_key" ON "Lead"("companyNumber");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachEmail_unsubscribeToken_key" ON "OutreachEmail"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "OutreachEmail_status_idx" ON "OutreachEmail"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachSuppression_email_key" ON "OutreachSuppression"("email");

-- AddForeignKey
ALTER TABLE "OutreachEmail" ADD CONSTRAINT "OutreachEmail_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEmail" ADD CONSTRAINT "OutreachEmail_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
