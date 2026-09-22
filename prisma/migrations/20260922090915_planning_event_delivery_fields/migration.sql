-- CreateEnum
CREATE TYPE "DeliveryColour" AS ENUM ('BLUE', 'RED', 'BLACK', 'GREEN');

-- AlterTable
ALTER TABLE "PlanningEvent" ADD COLUMN     "colour" "DeliveryColour" NOT NULL DEFAULT 'BLUE',
ADD COLUMN     "driverId" TEXT,
ADD COLUMN     "weightKg" DECIMAL(12,3);

-- AddForeignKey
ALTER TABLE "PlanningEvent" ADD CONSTRAINT "PlanningEvent_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
