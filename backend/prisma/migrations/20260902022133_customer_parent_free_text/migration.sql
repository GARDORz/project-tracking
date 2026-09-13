-- "ในเครือของ" changes from a link to another Customer row into free text.
-- Add the new column and backfill it from the parent's name before dropping
-- the old relation, so existing links aren't silently lost.
ALTER TABLE "Customer" ADD COLUMN "parentName" TEXT;

UPDATE "Customer" c
SET "parentName" = p."name"
FROM "Customer" p
WHERE c."parentId" = p."id";

ALTER TABLE "Customer" DROP CONSTRAINT "Customer_parentId_fkey";

ALTER TABLE "Customer" DROP COLUMN "parentId";
