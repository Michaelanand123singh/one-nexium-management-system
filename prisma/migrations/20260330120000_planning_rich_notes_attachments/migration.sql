-- AlterTable
ALTER TABLE "PlanningCard" ADD COLUMN "notesJson" JSONB;

-- Backfill TipTap-shaped JSON from legacy plain-text description
UPDATE "PlanningCard"
SET "notesJson" = jsonb_build_object(
  'type', 'doc',
  'content', jsonb_build_array(
    jsonb_build_object(
      'type', 'paragraph',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', "description")
      )
    )
  )
)
WHERE "description" IS NOT NULL AND TRIM("description") <> '';

-- CreateTable
CREATE TABLE "PlanningCardAttachment" (
    "id" TEXT NOT NULL,
    "planningCardId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningCardAttachment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PlanningCardAttachment" ADD CONSTRAINT "PlanningCardAttachment_planningCardId_fkey" FOREIGN KEY ("planningCardId") REFERENCES "PlanningCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlanningCardAttachment" ADD CONSTRAINT "PlanningCardAttachment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "PlanningCardAttachment_planningCardId_idx" ON "PlanningCardAttachment"("planningCardId");

CREATE INDEX "PlanningCardAttachment_organisationId_idx" ON "PlanningCardAttachment"("organisationId");
