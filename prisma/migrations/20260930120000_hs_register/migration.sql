-- CreateEnum
CREATE TYPE "HsAssessmentKind" AS ENUM ('RISK_ASSESSMENT', 'METHOD_STATEMENT');

-- CreateEnum
CREATE TYPE "HsRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "HsIncidentType" AS ENUM ('INCIDENT', 'NEAR_MISS', 'HAZARD');

-- CreateEnum
CREATE TYPE "HsIncidentStatus" AS ENUM ('UNDER_REVIEW', 'INVESTIGATION', 'CLOSED');

-- CreateTable
CREATE TABLE "HsAssessment" (
    "id" TEXT NOT NULL,
    "company" "Company",
    "kind" "HsAssessmentKind" NOT NULL,
    "ref" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "area" TEXT NOT NULL DEFAULT '',
    "riskLevel" "HsRiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "reviewDue" TIMESTAMP(3) NOT NULL,
    "lastReviewedAt" TIMESTAMP(3),
    "steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fileUrl" TEXT NOT NULL DEFAULT '',
    "fileName" TEXT NOT NULL DEFAULT '',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HsAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HsHazard" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "hazard" TEXT NOT NULL,
    "whoAtRisk" TEXT NOT NULL DEFAULT '',
    "controls" TEXT NOT NULL DEFAULT '',
    "likelihood" INTEGER NOT NULL,
    "severity" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HsHazard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HsIncident" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL,
    "ref" TEXT NOT NULL,
    "type" "HsIncidentType" NOT NULL,
    "status" "HsIncidentStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "area" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL,
    "injuredPerson" TEXT NOT NULL DEFAULT '',
    "injury" TEXT NOT NULL DEFAULT '',
    "immediateAction" TEXT NOT NULL DEFAULT '',
    "riddor" BOOLEAN NOT NULL DEFAULT false,
    "investigatorId" TEXT,
    "findings" TEXT NOT NULL DEFAULT '',
    "reportedById" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "HsIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HsIncidentPhoto" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HsIncidentPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HsAction" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL,
    "title" TEXT NOT NULL,
    "ownerId" TEXT,
    "dueOn" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "incidentId" TEXT,
    "assessmentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HsAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HsTrainingRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "personName" TEXT NOT NULL DEFAULT '',
    "course" TEXT NOT NULL,
    "achievedOn" TIMESTAMP(3),
    "expiresOn" TIMESTAMP(3),
    "certificateUrl" TEXT NOT NULL DEFAULT '',
    "certificateName" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "addedById" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HsTrainingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HsAssessment_ref_key" ON "HsAssessment"("ref");

-- CreateIndex
CREATE INDEX "HsAssessment_company_kind_archived_idx" ON "HsAssessment"("company", "kind", "archived");

-- CreateIndex
CREATE INDEX "HsHazard_assessmentId_idx" ON "HsHazard"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "HsIncident_ref_key" ON "HsIncident"("ref");

-- CreateIndex
CREATE INDEX "HsIncident_company_status_idx" ON "HsIncident"("company", "status");

-- CreateIndex
CREATE INDEX "HsIncident_occurredAt_idx" ON "HsIncident"("occurredAt");

-- CreateIndex
CREATE INDEX "HsIncidentPhoto_incidentId_idx" ON "HsIncidentPhoto"("incidentId");

-- CreateIndex
CREATE INDEX "HsAction_company_completedAt_idx" ON "HsAction"("company", "completedAt");

-- CreateIndex
CREATE INDEX "HsAction_incidentId_idx" ON "HsAction"("incidentId");

-- CreateIndex
CREATE INDEX "HsAction_assessmentId_idx" ON "HsAction"("assessmentId");

-- CreateIndex
CREATE INDEX "HsTrainingRecord_userId_idx" ON "HsTrainingRecord"("userId");

-- CreateIndex
CREATE INDEX "HsTrainingRecord_expiresOn_idx" ON "HsTrainingRecord"("expiresOn");

-- AddForeignKey
ALTER TABLE "HsAssessment" ADD CONSTRAINT "HsAssessment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HsHazard" ADD CONSTRAINT "HsHazard_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "HsAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HsIncident" ADD CONSTRAINT "HsIncident_investigatorId_fkey" FOREIGN KEY ("investigatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HsIncident" ADD CONSTRAINT "HsIncident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HsIncidentPhoto" ADD CONSTRAINT "HsIncidentPhoto_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "HsIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HsAction" ADD CONSTRAINT "HsAction_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HsAction" ADD CONSTRAINT "HsAction_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HsAction" ADD CONSTRAINT "HsAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HsAction" ADD CONSTRAINT "HsAction_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "HsIncident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HsAction" ADD CONSTRAINT "HsAction_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "HsAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HsTrainingRecord" ADD CONSTRAINT "HsTrainingRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HsTrainingRecord" ADD CONSTRAINT "HsTrainingRecord_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

