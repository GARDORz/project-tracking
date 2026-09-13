-- Priority was never used in practice; dropping it along with its enum type.
ALTER TABLE "ServiceJob" DROP COLUMN "priority";

DROP TYPE "ServicePriority";
