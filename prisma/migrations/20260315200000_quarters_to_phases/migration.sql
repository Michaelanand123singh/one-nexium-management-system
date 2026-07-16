-- Rename Organisation.quarters to phases and set default phase list
ALTER TABLE "Organisation" RENAME COLUMN "quarters" TO "phases";
ALTER TABLE "Organisation" ALTER COLUMN "phases" SET DEFAULT '["Phase 1","Phase 2","Phase 3","Phase 4","Phase 5","Phase 6"]'::jsonb;

-- Migrate existing Organisation phases: replace quarter strings in JSON array with phase names (Phase 1..6)
UPDATE "Organisation"
SET "phases" = '["Phase 1","Phase 2","Phase 3","Phase 4","Phase 5","Phase 6"]'::jsonb
WHERE "phases" IS NOT NULL;

-- Rename Epic.targetQuarter to targetPhase
ALTER TABLE "Epic" RENAME COLUMN "targetQuarter" TO "targetPhase";

-- Migrate Epic.targetPhase: map quarter labels to phase labels
UPDATE "Epic" SET "targetPhase" = CASE "targetPhase"
  WHEN 'Q1 2025' THEN 'Phase 1' WHEN 'Q2 2025' THEN 'Phase 2' WHEN 'Q3 2025' THEN 'Phase 3' WHEN 'Q4 2025' THEN 'Phase 4'
  WHEN 'Q1 2026' THEN 'Phase 5' WHEN 'Q2 2026' THEN 'Phase 6' WHEN 'Q3 2026' THEN 'Phase 7' WHEN 'Q4 2026' THEN 'Phase 8'
  ELSE "targetPhase" END
WHERE "targetPhase" IS NOT NULL;

-- Rename RoadmapItem.targetQuarter to targetPhase
ALTER TABLE "RoadmapItem" RENAME COLUMN "targetQuarter" TO "targetPhase";

-- Drop old index and create new one on RoadmapItem
DROP INDEX IF EXISTS "RoadmapItem_status_targetQuarter_idx";
CREATE INDEX "RoadmapItem_status_targetPhase_idx" ON "RoadmapItem"("status", "targetPhase");

-- Migrate RoadmapItem.targetPhase: map quarter labels to phase labels
UPDATE "RoadmapItem" SET "targetPhase" = CASE "targetPhase"
  WHEN 'Q1 2025' THEN 'Phase 1' WHEN 'Q2 2025' THEN 'Phase 2' WHEN 'Q3 2025' THEN 'Phase 3' WHEN 'Q4 2025' THEN 'Phase 4'
  WHEN 'Q1 2026' THEN 'Phase 5' WHEN 'Q2 2026' THEN 'Phase 6' WHEN 'Q3 2026' THEN 'Phase 7' WHEN 'Q4 2026' THEN 'Phase 8'
  ELSE "targetPhase" END
WHERE "targetPhase" IS NOT NULL;

-- Migrate Okr.period: quarter labels to phase labels (OKRs use same stages)
UPDATE "Okr" SET "period" = CASE "period"
  WHEN 'Q1 2025' THEN 'Phase 1' WHEN 'Q2 2025' THEN 'Phase 2' WHEN 'Q3 2025' THEN 'Phase 3' WHEN 'Q4 2025' THEN 'Phase 4'
  WHEN 'Q1 2026' THEN 'Phase 5' WHEN 'Q2 2026' THEN 'Phase 6' WHEN 'Q3 2026' THEN 'Phase 7' WHEN 'Q4 2026' THEN 'Phase 8'
  ELSE "period" END;
