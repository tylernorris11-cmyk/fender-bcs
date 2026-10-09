-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "boardColour" "DeliveryColour",
ADD COLUMN     "boardPostcode" TEXT NOT NULL DEFAULT '';

