-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('HARDWARE', 'SOFTWARE', 'PROFESSIONAL_SERVICE', 'OTHER');

-- AlterTable
ALTER TABLE "ServiceJob" ADD COLUMN     "serviceCategory" "ServiceCategory",
ADD COLUMN     "serviceCategoryOther" TEXT;
