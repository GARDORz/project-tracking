-- CreateTable
CREATE TABLE "ServiceJobAssignee" (
    "jobNo" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ServiceJobAssignee_pkey" PRIMARY KEY ("jobNo","userId")
);

-- Backfill: carry over the existing single assigneeId into the new join table.
INSERT INTO "ServiceJobAssignee" ("jobNo", "userId")
SELECT "jobNo", "assigneeId" FROM "ServiceJob" WHERE "assigneeId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "ServiceJob" DROP CONSTRAINT "ServiceJob_assigneeId_fkey";

-- AlterTable
ALTER TABLE "ServiceJob" DROP COLUMN "assigneeId";

-- AddForeignKey
ALTER TABLE "ServiceJobAssignee" ADD CONSTRAINT "ServiceJobAssignee_jobNo_fkey" FOREIGN KEY ("jobNo") REFERENCES "ServiceJob"("jobNo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceJobAssignee" ADD CONSTRAINT "ServiceJobAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
