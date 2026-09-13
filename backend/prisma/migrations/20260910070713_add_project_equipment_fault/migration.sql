-- CreateTable
CREATE TABLE "ProjectEquipmentFault" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serialNo" TEXT,
    "description" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectEquipmentFault_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProjectEquipmentFault" ADD CONSTRAINT "ProjectEquipmentFault_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
