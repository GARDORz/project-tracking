-- A job can have multiple attachments now, instead of a single set of columns
-- directly on ServiceJob. Create the new table and backfill any existing
-- single attachment into it before dropping the old columns.
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "jobNo" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_jobNo_fkey" FOREIGN KEY ("jobNo") REFERENCES "ServiceJob"("jobNo") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Attachment" ("id", "jobNo", "fileName", "storedName", "mimeType", "size", "uploadedAt")
SELECT gen_random_uuid(), "jobNo", "attachmentFileName", "attachmentStoredName", "attachmentMimeType", "attachmentSize", COALESCE("attachmentUploadedAt", CURRENT_TIMESTAMP)
FROM "ServiceJob"
WHERE "attachmentFileName" IS NOT NULL;

ALTER TABLE "ServiceJob" DROP COLUMN "attachmentFileName";
ALTER TABLE "ServiceJob" DROP COLUMN "attachmentStoredName";
ALTER TABLE "ServiceJob" DROP COLUMN "attachmentMimeType";
ALTER TABLE "ServiceJob" DROP COLUMN "attachmentSize";
ALTER TABLE "ServiceJob" DROP COLUMN "attachmentUploadedAt";
