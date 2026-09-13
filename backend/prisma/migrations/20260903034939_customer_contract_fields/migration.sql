-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "contractEndDate" TIMESTAMP(3),
ADD COLUMN     "contractNotifyMonths" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "contractNumber" TEXT,
ADD COLUMN     "contractStartDate" TIMESTAMP(3);
