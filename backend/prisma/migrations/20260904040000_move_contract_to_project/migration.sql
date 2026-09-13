-- Move contract tracking from Customer to Project: a customer can run several
-- projects, each under its own separate contract, so the fields belong at the
-- project level instead. Existing contract data on Customer is dropped
-- (confirmed test data, not yet in production) rather than migrated, since
-- there is no reliable way to guess which of a customer's projects (if any)
-- an existing contract number/date pair should move to.

-- AlterTable: Project gains the contract fields
ALTER TABLE "Project" ADD COLUMN "contractNumber" TEXT;
ALTER TABLE "Project" ADD COLUMN "contractStartDate" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "contractEndDate" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "contractNotifyMonths" INTEGER NOT NULL DEFAULT 1;

-- AlterTable: Customer loses the contract fields
ALTER TABLE "Customer" DROP COLUMN "contractNumber";
ALTER TABLE "Customer" DROP COLUMN "contractStartDate";
ALTER TABLE "Customer" DROP COLUMN "contractEndDate";
ALTER TABLE "Customer" DROP COLUMN "contractNotifyMonths";
