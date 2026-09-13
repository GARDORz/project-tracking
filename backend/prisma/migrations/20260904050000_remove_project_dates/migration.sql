-- Removes the plain project-timeline fields (startDate/endDate) — separate from
-- and not to be confused with the contract dates (contractStartDate/contractEndDate),
-- which stay. Drops existing test data on 3 projects along with the columns.

ALTER TABLE "Project" DROP COLUMN "startDate";
ALTER TABLE "Project" DROP COLUMN "endDate";
