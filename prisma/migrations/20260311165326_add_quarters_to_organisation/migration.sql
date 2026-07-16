-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "quarters" JSONB NOT NULL DEFAULT '["Q1 2025","Q2 2025","Q3 2025","Q4 2025","Q1 2026","Q2 2026"]';
