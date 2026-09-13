-- DropForeignKey
ALTER TABLE "ServiceJob" DROP CONSTRAINT "ServiceJob_projectId_fkey";

-- AddForeignKey
ALTER TABLE "ServiceJob" ADD CONSTRAINT "ServiceJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
