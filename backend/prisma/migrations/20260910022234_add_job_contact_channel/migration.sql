-- CreateEnum
CREATE TYPE "ContactChannel" AS ENUM ('PHONE', 'EMAIL', 'LINE');

-- AlterTable
ALTER TABLE "ServiceJob" ADD COLUMN     "contactChannel" "ContactChannel";
