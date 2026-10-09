-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ACCOUNTS_ADMIN';

-- CreateTable
CREATE TABLE "RolePermissionSet" (
    "role" "Role" NOT NULL,
    "permissions" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "RolePermissionSet_pkey" PRIMARY KEY ("role")
);

