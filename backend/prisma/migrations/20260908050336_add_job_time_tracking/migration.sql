-- AlterTable
ALTER TABLE "ServiceJob" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "currentSegmentStartedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "workedSeconds" INTEGER NOT NULL DEFAULT 0;
