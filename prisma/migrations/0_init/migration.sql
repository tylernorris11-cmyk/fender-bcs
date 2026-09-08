-- CreateEnum
CREATE TYPE "Company" AS ENUM ('FENDER', 'BS_SUPPLIES');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'SALES', 'OFFICE', 'QUALITY', 'YARD', 'DRIVER', 'VIEWER');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('GOODS_IN', 'PICKED', 'RETURNED', 'ADJUSTMENT', 'SCRAP', 'QUARANTINE', 'RELEASED');

-- CreateEnum
CREATE TYPE "BarCountMode" AS ENUM ('CIRCLE_DETECTOR', 'AI_ESTIMATE', 'BOTH');

-- CreateEnum
CREATE TYPE "OrderStage" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_PRODUCTION', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'CONFIRMED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductionProcess" AS ENUM ('CUTTING', 'BENDING', 'STEMA');

-- CreateEnum
CREATE TYPE "NcrType" AS ENUM ('CUSTOMER_COMPLAINT', 'INTERNAL', 'SUPPLIER_ISSUE');

-- CreateEnum
CREATE TYPE "NcrStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('VEHICLE', 'MACHINE');

-- CreateEnum
CREATE TYPE "CheckResult" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('DELIVERY', 'COLLECTION', 'INSPECTION', 'SERVICE', 'AUDIT', 'OTHER');

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "HolidayStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HseDocumentCategory" AS ENUM ('POLICY', 'RAMS', 'COSHH', 'METHOD_STATEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "TrainingCategory" AS ENUM ('GENERAL', 'PPE', 'MACHINE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL DEFAULT '',
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "initials" TEXT NOT NULL DEFAULT '',
    "colour" TEXT NOT NULL DEFAULT '#16A085',
    "mustReset" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resetTokenHash" TEXT,
    "resetTokenExpires" TIMESTAMP(3),
    "companies" "Company"[] DEFAULT ARRAY['FENDER']::"Company"[],
    "holidayAllowanceDays" INTEGER NOT NULL DEFAULT 28,
    "hiddenModules" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL DEFAULT 'FENDER',
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "town" TEXT NOT NULL DEFAULT '',
    "postcode" TEXT NOT NULL DEFAULT '',
    "paymentTerms" TEXT NOT NULL DEFAULT '30 days end of month',
    "creditLimit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "accountManagerId" TEXT,
    "customerSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerDocument" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'Other',
    "url" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL DEFAULT 'FENDER',
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 't',
    "kgPerUnit" DECIMAL(12,3) NOT NULL DEFAULT 1000,
    "standard" TEXT NOT NULL DEFAULT '',
    "reorderAt" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isRebar" BOOLEAN NOT NULL DEFAULT false,
    "lengthFt" INTEGER,
    "lengthIn" INTEGER,
    "thicknessMm" DECIMAL(6,2),
    "bundleWeightKg" DECIMAL(10,2),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Price" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "minQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "setByName" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Price_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseCost" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL DEFAULT 'FENDER',
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'United Kingdom',
    "contactName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "approvedFor" TEXT NOT NULL DEFAULT '',
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL DEFAULT 'FENDER',
    "heatNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "certNumber" TEXT NOT NULL DEFAULT '',
    "millCertUrl" TEXT NOT NULL DEFAULT '',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qtyReceived" DECIMAL(12,3) NOT NULL,
    "qtyRemaining" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(12,2),
    "depot" TEXT NOT NULL DEFAULT 'Scunthorpe',
    "location" TEXT NOT NULL DEFAULT '',
    "deliveryNote" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Available',
    "quarantineRef" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "type" "MovementType" NOT NULL,
    "qty" DECIMAL(12,3) NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarCount" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL DEFAULT 'FENDER',
    "mode" "BarCountMode" NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "photoWidth" INTEGER,
    "photoHeight" INTEGER,
    "orderId" TEXT,
    "detectedCount" INTEGER,
    "detectedCircles" JSONB,
    "aiEstimateCount" INTEGER,
    "aiEstimateError" TEXT NOT NULL DEFAULT '',
    "confirmedCount" INTEGER NOT NULL,
    "confirmedCircles" JSONB,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL DEFAULT 'FENDER',
    "number" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "stage" "OrderStage" NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "deliveryDate" TIMESTAMP(3),
    "town" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "poNumber" TEXT NOT NULL DEFAULT '',
    "yardNotes" TEXT NOT NULL DEFAULT '',
    "depot" TEXT NOT NULL DEFAULT 'Scunthorpe',
    "raisedById" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "overrideCredit" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT NOT NULL DEFAULT '',
    "deliveredAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 't',
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "weightKg" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "batchId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL DEFAULT 'FENDER',
    "number" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "expectedDate" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "raisedById" TEXT,
    "costCentreId" TEXT,
    "sentAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 't',
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarMark" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "mark" TEXT NOT NULL,
    "diaMm" INTEGER NOT NULL,
    "shapeCode" TEXT NOT NULL,
    "shapeName" TEXT NOT NULL DEFAULT '',
    "lengthMm" INTEGER NOT NULL,
    "bars" INTEGER NOT NULL,
    "a" INTEGER,
    "b" INTEGER,
    "c" INTEGER,
    "d" INTEGER,
    "ef" INTEGER,
    "radiusMm" INTEGER,
    "weightKg" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "batchId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BarMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneById" TEXT,
    "doneAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL DEFAULT 'FENDER',
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "station" TEXT NOT NULL,
    "assetId" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QcCheck" (
    "id" TEXT NOT NULL,
    "barMarkId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "nominalMm" INTEGER NOT NULL,
    "measuredMm" INTEGER NOT NULL,
    "toleranceMm" TEXT NOT NULL DEFAULT '',
    "pass" BOOLEAN NOT NULL,
    "checkedById" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "QcCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionJob" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL DEFAULT 'FENDER',
    "jobNumber" TEXT NOT NULL,
    "process" "ProductionProcess" NOT NULL,
    "orderId" TEXT,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "lastPartFinishedAt" TIMESTAMP(3),

    CONSTRAINT "ProductionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionJobRow" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "diaMm" DECIMAL(5,1),
    "barMark" TEXT NOT NULL DEFAULT '',
    "castNumber" TEXT NOT NULL DEFAULT '',
    "mill" TEXT NOT NULL DEFAULT '',
    "machine" TEXT NOT NULL DEFAULT '',
    "steelGrade" TEXT NOT NULL DEFAULT '',
    "tallyWeightKg" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "comments" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionJobRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtherWorkTask" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL DEFAULT 'FENDER',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "photoUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "doneById" TEXT,
    "doneAt" TIMESTAMP(3),
    "doneNote" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "OtherWorkTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL DEFAULT 'FENDER',
    "scheme" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "holder" TEXT NOT NULL DEFAULT 'Fender Steel',
    "supplierId" TEXT,
    "issuedOn" TIMESTAMP(3) NOT NULL,
    "expiresOn" TIMESTAMP(3) NOT NULL,
    "fileUrl" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ncr" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL DEFAULT 'FENDER',
    "ref" TEXT NOT NULL,
    "type" "NcrType" NOT NULL,
    "status" "NcrStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "correctiveAction" TEXT NOT NULL DEFAULT '',
    "rootCause" TEXT NOT NULL DEFAULT '',
    "orderId" TEXT,
    "customerId" TEXT,
    "batchId" TEXT,
    "supplierId" TEXT,
    "raisedById" TEXT,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Ncr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditAction" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL DEFAULT 'FENDER',
    "ref" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'CARES audit',
    "description" TEXT NOT NULL,
    "owner" TEXT NOT NULL DEFAULT '',
    "dueOn" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "evidence" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AuditAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuarterlyReturn" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL DEFAULT 'FENDER',
    "period" TEXT NOT NULL,
    "tonnage" DECIMAL(12,3) NOT NULL,
    "preparedBy" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3),
    "reference" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "QuarterlyReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "company" "Company",
    "makeModel" TEXT NOT NULL DEFAULT '',
    "year" INTEGER,
    "serialNumber" TEXT NOT NULL DEFAULT '',
    "depot" TEXT NOT NULL DEFAULT 'Scunthorpe',
    "hours" INTEGER,
    "liftingEquipment" BOOLEAN NOT NULL DEFAULT false,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "motDue" TIMESTAMP(3),
    "taxDue" TIMESTAMP(3),
    "weeklyCheckDue" TIMESTAMP(3),
    "puwerDue" TIMESTAMP(3),
    "lolerDue" TIMESTAMP(3),
    "serviceDue" TIMESTAMP(3),
    "calibrationDue" TIMESTAMP(3),
    "emergencyLightTestDue" TIMESTAMP(3),
    "emergencyLightDurationDue" TIMESTAMP(3),

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelEntry" (
    "id" TEXT NOT NULL,
    "assetId" TEXT,
    "otherVehicle" TEXT NOT NULL DEFAULT '',
    "mileage" INTEGER NOT NULL,
    "driverName" TEXT NOT NULL,
    "litresBefore" DECIMAL(10,2) NOT NULL,
    "litresAfter" DECIMAL(10,2) NOT NULL,
    "loggedById" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetIssue" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reportedById" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AssetIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetChecklistItem" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "critical" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AssetChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'Pass',
    "provider" TEXT NOT NULL DEFAULT '',
    "performedOn" TIMESTAMP(3) NOT NULL,
    "nextDueOn" TIMESTAMP(3),
    "certificate" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "loggedById" TEXT,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetCheck" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "userId" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" "CheckResult" NOT NULL DEFAULT 'PASS',
    "notes" TEXT NOT NULL DEFAULT '',
    "photo" TEXT,
    "mileage" INTEGER,

    CONSTRAINT "AssetCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetCheckItem" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT NOT NULL DEFAULT '',
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AssetCheckItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetNote" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "userId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "EventType" NOT NULL DEFAULT 'OTHER',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "town" TEXT NOT NULL DEFAULT '',
    "detail" TEXT NOT NULL DEFAULT '',
    "orderId" TEXT,
    "assetId" TEXT,
    "assignedTo" TEXT NOT NULL DEFAULT '',
    "done" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PlanningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Town" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Town_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCentre" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL DEFAULT 'FENDER',
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CostCentre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "userId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "licence" TEXT NOT NULL DEFAULT '',
    "cpcExpiry" TIMESTAMP(3),
    "depot" TEXT NOT NULL DEFAULT 'Scunthorpe',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "BugReport" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "page" TEXT NOT NULL DEFAULT '',
    "company" "Company",
    "userName" TEXT NOT NULL DEFAULT '',
    "userEmail" TEXT NOT NULL DEFAULT '',
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL DEFAULT '',
    "companies" "Company"[] DEFAULT ARRAY[]::"Company"[],
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT NOT NULL DEFAULT '',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCertificate" (
    "id" TEXT NOT NULL,
    "company" "Company" NOT NULL DEFAULT 'FENDER',
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Processing',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolidayRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "workingDays" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" "HolidayStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decisionNote" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "HolidayRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolidayAdjustment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "HolidayAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedCastNumber" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "castNumber" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "matchedBatchId" TEXT,

    CONSTRAINT "ExtractedCastNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HseDocument" (
    "id" TEXT NOT NULL,
    "company" "Company",
    "category" "HseDocumentCategory" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "HseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingModule" (
    "id" TEXT NOT NULL,
    "company" "Company",
    "category" "TrainingCategory" NOT NULL,
    "machineName" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "content" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTrainingAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTrainingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE INDEX "Customer_company_idx" ON "Customer"("company");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE INDEX "Product_company_idx" ON "Product"("company");

-- CreateIndex
CREATE INDEX "Price_productId_minQty_idx" ON "Price"("productId", "minQty");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Supplier_company_idx" ON "Supplier"("company");

-- CreateIndex
CREATE INDEX "Batch_productId_receivedAt_idx" ON "Batch"("productId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_heatNumber_productId_key" ON "Batch"("heatNumber", "productId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_at_idx" ON "StockMovement"("productId", "at");

-- CreateIndex
CREATE INDEX "BarCount_company_createdAt_idx" ON "BarCount"("company", "createdAt");

-- CreateIndex
CREATE INDEX "BarCount_orderId_idx" ON "BarCount"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE INDEX "Order_stage_deliveryDate_idx" ON "Order"("stage", "deliveryDate");

-- CreateIndex
CREATE INDEX "Order_company_idx" ON "Order"("company");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_number_key" ON "PurchaseOrder"("number");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_expectedDate_idx" ON "PurchaseOrder"("status", "expectedDate");

-- CreateIndex
CREATE INDEX "PurchaseOrder_company_idx" ON "PurchaseOrder"("company");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_company_idx" ON "ChecklistTemplate"("company");

-- CreateIndex
CREATE INDEX "ProductionJob_userId_finishedAt_idx" ON "ProductionJob"("userId", "finishedAt");

-- CreateIndex
CREATE INDEX "ProductionJob_company_idx" ON "ProductionJob"("company");

-- CreateIndex
CREATE INDEX "ProductionJobRow_jobId_idx" ON "ProductionJobRow"("jobId");

-- CreateIndex
CREATE INDEX "OtherWorkTask_company_status_idx" ON "OtherWorkTask"("company", "status");

-- CreateIndex
CREATE INDEX "Certificate_expiresOn_idx" ON "Certificate"("expiresOn");

-- CreateIndex
CREATE INDEX "Certificate_company_idx" ON "Certificate"("company");

-- CreateIndex
CREATE UNIQUE INDEX "Ncr_ref_key" ON "Ncr"("ref");

-- CreateIndex
CREATE INDEX "Ncr_company_idx" ON "Ncr"("company");

-- CreateIndex
CREATE UNIQUE INDEX "AuditAction_ref_key" ON "AuditAction"("ref");

-- CreateIndex
CREATE INDEX "AuditAction_company_idx" ON "AuditAction"("company");

-- CreateIndex
CREATE UNIQUE INDEX "QuarterlyReturn_period_company_key" ON "QuarterlyReturn"("period", "company");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_ref_key" ON "Asset"("ref");

-- CreateIndex
CREATE INDEX "FuelEntry_assetId_idx" ON "FuelEntry"("assetId");

-- CreateIndex
CREATE INDEX "FuelEntry_loggedAt_idx" ON "FuelEntry"("loggedAt");

-- CreateIndex
CREATE INDEX "AssetIssue_assetId_idx" ON "AssetIssue"("assetId");

-- CreateIndex
CREATE INDEX "AssetIssue_resolved_idx" ON "AssetIssue"("resolved");

-- CreateIndex
CREATE INDEX "AssetChecklistItem_assetId_idx" ON "AssetChecklistItem"("assetId");

-- CreateIndex
CREATE INDEX "AssetCheck_assetId_performedAt_idx" ON "AssetCheck"("assetId", "performedAt");

-- CreateIndex
CREATE INDEX "AssetCheckItem_resolved_idx" ON "AssetCheckItem"("resolved");

-- CreateIndex
CREATE INDEX "PlanningEvent_startsAt_idx" ON "PlanningEvent"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Town_name_key" ON "Town"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Location_name_key" ON "Location"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CostCentre_company_name_key" ON "CostCentre"("company", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");

-- CreateIndex
CREATE INDEX "AccessRequest_status_idx" ON "AccessRequest"("status");

-- CreateIndex
CREATE INDEX "TestCertificate_company_idx" ON "TestCertificate"("company");

-- CreateIndex
CREATE INDEX "HolidayRequest_startDate_endDate_idx" ON "HolidayRequest"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "HolidayRequest_userId_idx" ON "HolidayRequest"("userId");

-- CreateIndex
CREATE INDEX "HolidayAdjustment_userId_year_idx" ON "HolidayAdjustment"("userId", "year");

-- CreateIndex
CREATE INDEX "ExtractedCastNumber_castNumber_idx" ON "ExtractedCastNumber"("castNumber");

-- CreateIndex
CREATE INDEX "ActivityLog_entity_entityId_idx" ON "ActivityLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "HseDocument_company_idx" ON "HseDocument"("company");

-- CreateIndex
CREATE INDEX "HseDocument_category_idx" ON "HseDocument"("category");

-- CreateIndex
CREATE INDEX "TrainingModule_company_idx" ON "TrainingModule"("company");

-- CreateIndex
CREATE INDEX "TrainingModule_category_active_idx" ON "TrainingModule"("category", "active");

-- CreateIndex
CREATE INDEX "TrainingCompletion_moduleId_idx" ON "TrainingCompletion"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingCompletion_userId_moduleId_key" ON "TrainingCompletion"("userId", "moduleId");

-- CreateIndex
CREATE INDEX "UserTrainingAssignment_moduleId_idx" ON "UserTrainingAssignment"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTrainingAssignment_userId_moduleId_key" ON "UserTrainingAssignment"("userId", "moduleId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_accountManagerId_fkey" FOREIGN KEY ("accountManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Price" ADD CONSTRAINT "Price_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarCount" ADD CONSTRAINT "BarCount_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarCount" ADD CONSTRAINT "BarCount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_costCentreId_fkey" FOREIGN KEY ("costCentreId") REFERENCES "CostCentre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarMark" ADD CONSTRAINT "BarMark_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionEvent" ADD CONSTRAINT "ProductionEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionEvent" ADD CONSTRAINT "ProductionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionEvent" ADD CONSTRAINT "ProductionEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcCheck" ADD CONSTRAINT "QcCheck_barMarkId_fkey" FOREIGN KEY ("barMarkId") REFERENCES "BarMark"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcCheck" ADD CONSTRAINT "QcCheck_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJobRow" ADD CONSTRAINT "ProductionJobRow_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ProductionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtherWorkTask" ADD CONSTRAINT "OtherWorkTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtherWorkTask" ADD CONSTRAINT "OtherWorkTask_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ncr" ADD CONSTRAINT "Ncr_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ncr" ADD CONSTRAINT "Ncr_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ncr" ADD CONSTRAINT "Ncr_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ncr" ADD CONSTRAINT "Ncr_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ncr" ADD CONSTRAINT "Ncr_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelEntry" ADD CONSTRAINT "FuelEntry_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelEntry" ADD CONSTRAINT "FuelEntry_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetIssue" ADD CONSTRAINT "AssetIssue_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetIssue" ADD CONSTRAINT "AssetIssue_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetIssue" ADD CONSTRAINT "AssetIssue_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetChecklistItem" ADD CONSTRAINT "AssetChecklistItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCheck" ADD CONSTRAINT "AssetCheck_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCheck" ADD CONSTRAINT "AssetCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCheckItem" ADD CONSTRAINT "AssetCheckItem_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "AssetCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetCheckItem" ADD CONSTRAINT "AssetCheckItem_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetNote" ADD CONSTRAINT "AssetNote_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetNote" ADD CONSTRAINT "AssetNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningEvent" ADD CONSTRAINT "PlanningEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningEvent" ADD CONSTRAINT "PlanningEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCertificate" ADD CONSTRAINT "TestCertificate_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayRequest" ADD CONSTRAINT "HolidayRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayRequest" ADD CONSTRAINT "HolidayRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayAdjustment" ADD CONSTRAINT "HolidayAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayAdjustment" ADD CONSTRAINT "HolidayAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedCastNumber" ADD CONSTRAINT "ExtractedCastNumber_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "TestCertificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedCastNumber" ADD CONSTRAINT "ExtractedCastNumber_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedCastNumber" ADD CONSTRAINT "ExtractedCastNumber_matchedBatchId_fkey" FOREIGN KEY ("matchedBatchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HseDocument" ADD CONSTRAINT "HseDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingModule" ADD CONSTRAINT "TrainingModule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCompletion" ADD CONSTRAINT "TrainingCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCompletion" ADD CONSTRAINT "TrainingCompletion_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "TrainingModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrainingAssignment" ADD CONSTRAINT "UserTrainingAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrainingAssignment" ADD CONSTRAINT "UserTrainingAssignment_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "TrainingModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrainingAssignment" ADD CONSTRAINT "UserTrainingAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

