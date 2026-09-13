-- AlterTable
ALTER TABLE "ServiceJob" ADD COLUMN     "attachmentFileName" TEXT,
ADD COLUMN     "attachmentMimeType" TEXT,
ADD COLUMN     "attachmentSize" INTEGER,
ADD COLUMN     "attachmentStoredName" TEXT,
ADD COLUMN     "attachmentUploadedAt" TIMESTAMP(3);
