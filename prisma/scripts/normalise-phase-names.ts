/**
 * One-time data fix: normalise "Phase 1.1" → "Phase 1" and "Phase 1.2" → "Phase 2"
 * in RoadmapItem, Epic, Okr, and Organisation.phases so roadmap/phase dropdown work correctly.
 * Run: npx tsx prisma/scripts/normalise-phase-names.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STANDARD_PHASES = ["Phase 1", "Phase 2", "Phase 3", "Phase 4", "Phase 5", "Phase 6"];

async function main() {
  console.log("Normalising phase names (Phase 1.1 → Phase 1, Phase 1.2 → Phase 2)...\n");

  const r1 = await prisma.roadmapItem.updateMany({
    where: { targetPhase: "Phase 1.1" },
    data: { targetPhase: "Phase 1" },
  });
  const r2 = await prisma.roadmapItem.updateMany({
    where: { targetPhase: "Phase 1.2" },
    data: { targetPhase: "Phase 2" },
  });

  const e1 = await prisma.epic.updateMany({
    where: { targetPhase: "Phase 1.1" },
    data: { targetPhase: "Phase 1" },
  });
  const e2 = await prisma.epic.updateMany({
    where: { targetPhase: "Phase 1.2" },
    data: { targetPhase: "Phase 2" },
  });

  const o1 = await prisma.okr.updateMany({
    where: { period: "Phase 1.1" },
    data: { period: "Phase 1" },
  });
  const o2 = await prisma.okr.updateMany({
    where: { period: "Phase 1.2" },
    data: { period: "Phase 2" },
  });

  const orgs = await prisma.organisation.findMany({
    where: {},
    select: { id: true, phases: true },
  });
  let orgsUpdated = 0;
  for (const org of orgs) {
    const phases = org.phases as unknown;
    if (!Array.isArray(phases)) continue;
    const hasNonStandard = phases.some(
      (p: unknown) => p === "Phase 1.1" || p === "Phase 1.2" || (typeof p === "string" && !STANDARD_PHASES.includes(p))
    );
    if (!hasNonStandard) continue;
    const normalised = (phases as string[]).map((p) => {
      if (p === "Phase 1.1") return "Phase 1";
      if (p === "Phase 1.2") return "Phase 2";
      return p;
    });
    const unique = [...new Set(normalised)];
    await prisma.organisation.update({
      where: { id: org.id },
      data: { phases: unique },
    });
    orgsUpdated++;
  }

  console.log(`RoadmapItem: ${r1.count} → Phase 1, ${r2.count} → Phase 2`);
  console.log(`Epic:        ${e1.count} → Phase 1, ${e2.count} → Phase 2`);
  console.log(`Okr:         ${o1.count} → Phase 1, ${o2.count} → Phase 2`);
  console.log(`Organisation phases: ${orgsUpdated} updated to standard list`);
  console.log("\nDone.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
