-- CreateEnum
CREATE TYPE "PlanningCardStatus" AS ENUM ('OPEN', 'DONE');

-- CreateTable
CREATE TABLE "PlanningBucket" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PlanningBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningCard" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bucketId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "plannedDate" TIMESTAMP(3),
    "status" "PlanningCardStatus" NOT NULL DEFAULT 'OPEN',
    "taskId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PlanningCard_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PlanningBucket" ADD CONSTRAINT "PlanningBucket_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlanningBucket" ADD CONSTRAINT "PlanningBucket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlanningCard" ADD CONSTRAINT "PlanningCard_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlanningCard" ADD CONSTRAINT "PlanningCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlanningCard" ADD CONSTRAINT "PlanningCard_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "PlanningBucket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlanningCard" ADD CONSTRAINT "PlanningCard_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "PlanningBucket_organisationId_userId_idx" ON "PlanningBucket"("organisationId", "userId");

CREATE INDEX "PlanningCard_organisationId_userId_idx" ON "PlanningCard"("organisationId", "userId");

CREATE INDEX "PlanningCard_bucketId_idx" ON "PlanningCard"("bucketId");

CREATE INDEX "PlanningCard_plannedDate_idx" ON "PlanningCard"("plannedDate");

CREATE INDEX "PlanningCard_userId_status_idx" ON "PlanningCard"("userId", "status");
