-- CreateTable
CREATE TABLE "ProjectSla" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slaResolutionDays" INTEGER NOT NULL DEFAULT 0,
    "slaResolutionHours" INTEGER NOT NULL DEFAULT 0,
    "slaResponseHours" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectSla_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProjectSla" ADD CONSTRAINT "ProjectSla_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: every project that had a non-zero SLA under the old
-- single-SLA-per-project columns gets one ProjectSla row carrying those values
-- over, so existing data isn't lost when those columns are dropped below.
INSERT INTO "ProjectSla" ("id", "projectId", "slaResolutionDays", "slaResolutionHours", "slaResponseHours", "isActive", "createdAt")
SELECT gen_random_uuid()::text, "id", "slaResolutionDays", "slaResolutionHours", "slaResponseHours", true, CURRENT_TIMESTAMP
FROM "Project"
WHERE "slaResolutionDays" > 0 OR "slaResolutionHours" > 0 OR "slaResponseHours" > 0;

-- AlterTable
ALTER TABLE "ServiceJob" ADD COLUMN "slaId" TEXT;

-- Data migration: every existing job under a project that got a migrated SLA
-- row above now points at it, preserving what Reports/JobDetails already showed.
UPDATE "ServiceJob" sj
SET "slaId" = ps."id"
FROM "ProjectSla" ps
WHERE sj."projectId" = ps."projectId";

-- AddForeignKey
ALTER TABLE "ServiceJob" ADD CONSTRAINT "ServiceJob_slaId_fkey" FOREIGN KEY ("slaId") REFERENCES "ProjectSla"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "slaResolutionDays",
DROP COLUMN "slaResolutionHours",
DROP COLUMN "slaResponseHours";
