-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "serviceDueMileage" INTEGER;

-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "mileageAt" INTEGER,
ADD COLUMN     "nextDueMileage" INTEGER;
