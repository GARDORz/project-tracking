-- AlterTable: add shareToken as nullable first so existing rows can be backfilled
-- before the NOT NULL + UNIQUE constraints are applied (Prisma's normal `migrate dev`
-- can't do this in one non-interactive step when the table already has rows).
ALTER TABLE "ServiceJob" ADD COLUMN "shareToken" TEXT;

-- Backfill existing rows with a random, unguessable token.
UPDATE "ServiceJob" SET "shareToken" = gen_random_uuid()::text WHERE "shareToken" IS NULL;

-- AlterTable
ALTER TABLE "ServiceJob" ALTER COLUMN "shareToken" SET NOT NULL;

-- CreateIndex
ALTER TABLE "ServiceJob" ADD CONSTRAINT "ServiceJob_shareToken_key" UNIQUE ("shareToken");
