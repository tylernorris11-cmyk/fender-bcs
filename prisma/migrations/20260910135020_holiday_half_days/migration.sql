-- CreateEnum
CREATE TYPE "HolidayHalf" AS ENUM ('AM', 'PM');

-- AlterTable
ALTER TABLE "HolidayRequest" ADD COLUMN     "half" "HolidayHalf",
ALTER COLUMN "workingDays" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "unpaidDays" SET DEFAULT 0,
ALTER COLUMN "unpaidDays" SET DATA TYPE DOUBLE PRECISION;
