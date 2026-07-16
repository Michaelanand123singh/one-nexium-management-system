/**
 * Seeds Nexium OS from onenexium-phase1-1-seed.json (Phase 1 engine build plan).
 * Uses standard phase names "Phase 1", "Phase 2", ... to match lib/constants, schema, and settings.
 * Wipes org-scoped product data for the target org, then inserts milestones, epics,
 * roadmap items, sprints, tasks, backlog (Phase 2 deferrals), OKRs, and documents.
 *
 * Run: npx tsx prisma/seed-phase1-1.ts
 * Env: DATABASE_URL, org slug ONENEXIUM_ORG_SLUG (default: onenexium)
 */
import { readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Standard phase label for roadmap/epic/OKR — matches PHASES in lib/constants and settings regex (Phase N). */
const PHASE = "Phase 1";
const JSON_FILE = "onenexium-phase1-1-seed.json";

/** Standard org phases list (Phase 1..6) — same as schema default and constants. */
const STANDARD_PHASES = ["Phase 1", "Phase 2", "Phase 3", "Phase 4", "Phase 5", "Phase 6"];

type GoalJson = {
  id: string;
  number: number;
  title: string;
  description: string;
  tasks: string[];
  acceptance_criteria?: string[];
  [key: string]: unknown;
};

type SprintJson = {
  id: string;
  number: number;
  label: string;
  duration: string;
  focus: string;
  tasks?: string[];
  goals_completed?: string[];
  weeks?: string;
};

type SeedJson = {
  project: Record<string, unknown>;
  goals: GoalJson[];
  sprints: SprintJson[];
  acceptance_criteria_master: { area: string; criterion: string }[];
  phase_1_2_backlog: { item: string; reason: string }[];
  phase_definition?: unknown;
  the_one_test?: unknown;
  phase_boundary?: unknown;
  operating_rules?: unknown;
  phase_completion_definition?: unknown;
  sprint_completion_definition?: unknown;
  closing_statement?: string;
};

/** Goal number → sprint index in JSON `sprints` array (0 = Sprint Zero … 6 = Sprint 6) */
const GOAL_TO_SPRINT: Record<number, number> = {
  1: 0,
  2: 0,
  3: 1,
  4: 1,
  5: 1,
  6: 2,
  7: 2,
  8: 3,
  9: 3,
  10: 4,
  11: 4,
  12: 5,
  13: 5,
  14: 6,
};

function mdSection(title: string, body: unknown): string {
  return `## ${title}\n\n\`\`\`json\n${JSON.stringify(body, null, 2)}\n\`\`\`\n\n`;
}

function goalBody(g: GoalJson): string {
  const parts = [g.description];
  if (g.tasks?.length) {
    parts.push("\n### Tasks\n" + g.tasks.map((t, i) => `${i + 1}. ${t}`).join("\n"));
  }
  if (g.acceptance_criteria?.length) {
    parts.push(
      "\n### Acceptance criteria\n" + g.acceptance_criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")
    );
  }
  return parts.join("\n");
}

async function cleanOrganisationData(orgId: string) {
  console.log("  Removing existing org data…");
  await prisma.customerOnboardingProgress.deleteMany({
    where: { customer: { organisationId: orgId } },
  });
  await prisma.onboardingMilestone.deleteMany({ where: { organisationId: orgId } });
  await prisma.npsResponse.deleteMany({ where: { customer: { organisationId: orgId } } });
  await prisma.supportTicket.deleteMany({ where: { organisationId: orgId } });
  await prisma.customerFeedback.deleteMany({ where: { organisationId: orgId } });
  await prisma.featureRequest.deleteMany({ where: { organisationId: orgId } });
  await prisma.commission.deleteMany({ where: { partner: { organisationId: orgId } } });
  await prisma.referral.deleteMany({ where: { partner: { organisationId: orgId } } });
  await prisma.partner.deleteMany({ where: { organisationId: orgId } });
  await prisma.campaign.deleteMany({ where: { organisationId: orgId } });
  await prisma.documentComment.deleteMany({ where: { document: { organisationId: orgId } } });
  await prisma.documentVersion.deleteMany({ where: { document: { organisationId: orgId } } });
  await prisma.document.deleteMany({ where: { organisationId: orgId } });
  await prisma.notification.deleteMany({ where: { organisationId: orgId } });
  await prisma.activityLog.deleteMany({ where: { organisationId: orgId } });
  await prisma.okrCheckin.deleteMany({ where: { okr: { organisationId: orgId } } });
  await prisma.keyResult.deleteMany({ where: { okr: { organisationId: orgId } } });
  for (let i = 0; i < 25; i++) {
    const r = await prisma.okr.deleteMany({
      where: {
        organisationId: orgId,
        NOT: { childOkrs: { some: {} } },
      },
    });
    if (r.count === 0) break;
  }
  await prisma.okr.deleteMany({ where: { organisationId: orgId } });
  await prisma.bugAttachment.deleteMany({ where: { bug: { organisationId: orgId } } });
  await prisma.comment.deleteMany({
    where: {
      OR: [{ task: { organisationId: orgId } }, { bug: { organisationId: orgId } }],
    },
  });
  await prisma.bug.deleteMany({ where: { organisationId: orgId } });
  await prisma.taskHour.deleteMany({ where: { task: { organisationId: orgId } } });
  await prisma.subtask.deleteMany({ where: { task: { organisationId: orgId } } });
  await prisma.task.deleteMany({ where: { organisationId: orgId } });
  await prisma.backlogItem.deleteMany({ where: { organisationId: orgId } });
  await prisma.roadmapItemHistory.deleteMany({
    where: { roadmapItem: { organisationId: orgId } },
  });
  await prisma.roadmapItem.deleteMany({ where: { organisationId: orgId } });
  await prisma.sprint.deleteMany({ where: { organisationId: orgId } });
  await prisma.epic.deleteMany({ where: { organisationId: orgId } });
  await prisma.milestone.deleteMany({ where: { organisationId: orgId } });
  await prisma.asset.deleteMany({ where: { organisationId: orgId } });
  await prisma.gtmEvent.deleteMany({ where: { organisationId: orgId } });
  await prisma.customer.deleteMany({ where: { organisationId: orgId } });
  await prisma.mailMessage.deleteMany({ where: { organisationId: orgId } });
  await prisma.mailThread.deleteMany({ where: { organisationId: orgId } });
  await prisma.mailAccount.deleteMany({ where: { organisationId: orgId } });
  console.log("  Clean complete.");
}

async function main() {
  const slug = process.env.ONENEXIUM_ORG_SLUG || "onenexium";
  const jsonPath = path.join(process.cwd(), JSON_FILE);
  const raw = readFileSync(jsonPath, "utf-8");
  const data = JSON.parse(raw) as SeedJson;

  console.log(`Phase 1 seed — ${data.project?.title || PHASE}\n`);

  let org = await prisma.organisation.findUnique({ where: { slug } });
  if (!org) {
    org = await prisma.organisation.create({
      data: {
        name: "OneNexium",
        slug,
        phases: JSON.stringify(STANDARD_PHASES),
      },
    });
    console.log(`Created organisation: ${slug}`);
  } else {
    await prisma.organisation.update({
      where: { id: org.id },
      data: { phases: JSON.stringify(STANDARD_PHASES) },
    });
  }
  const orgId = org.id;

  const admin = await prisma.user.findFirst({
    where: {
      memberships: { some: { organisationId: orgId, role: "SUPER_ADMIN" } },
    },
  });
  const anyMember = await prisma.organisationMember.findFirst({
    where: { organisationId: orgId },
    include: { user: true },
  });
  const ownerId = admin?.id ?? anyMember?.userId;
  if (!ownerId) {
    console.error(
      "No user with membership in this org. Run prisma/seed.ts first to create users, or add a member."
    );
    process.exit(1);
  }

  await cleanOrganisationData(orgId);

  const base = new Date();
  base.setUTCDate(base.getUTCDate() - 70);

  const milestonePhase = await prisma.milestone.create({
    data: {
      organisationId: orgId,
      name: `${PHASE} — Complete`,
      targetDate: new Date(base.getTime() + 84 * 86400000),
      description: (data.project as { subtitle?: string })?.subtitle ?? "Engine first; quality in Phase 2",
    },
  });

  const sprintRecords: { id: string; idx: number }[] = [];
  let cursor = new Date(base);
  for (let i = 0; i < data.sprints.length; i++) {
    const s = data.sprints[i];
    const days = i === 0 ? 10 : 14;
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setUTCDate(end.getUTCDate() + days);
    const status = i === 0 ? "COMPLETED" : i === 1 ? "ACTIVE" : "PLANNED";
    const rec = await prisma.sprint.create({
      data: {
        organisationId: orgId,
        name: `${s.label} — ${s.focus}`,
        goal: s.tasks?.join("\n") || s.focus,
        startDate: start,
        endDate: end,
        status,
      },
    });
    sprintRecords.push({ id: rec.id, idx: i });
    cursor = new Date(end);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const epicByGoalNum = new Map<number, string>();

  for (const g of data.goals) {
    const epic = await prisma.epic.create({
      data: {
        organisationId: orgId,
        name: `G${g.number}: ${g.title}`,
        goal: g.description,
        ownerId,
        targetPhase: PHASE,
        status: "ACTIVE",
      },
    });
    epicByGoalNum.set(g.number, epic.id);
  }

  const roadmapStatus = (n: number): "PLANNED" | "IN_PROGRESS" | "SHIPPED" => {
    if (n <= 2) return "SHIPPED";
    if (n <= 7) return "IN_PROGRESS";
    return "PLANNED";
  };

  const roadmapByGoal = new Map<number, string>();

  for (const g of data.goals) {
    const item = await prisma.roadmapItem.create({
      data: {
        organisationId: orgId,
        title: g.title,
        description: goalBody(g),
        status: roadmapStatus(g.number),
        priority: g.number <= 3 ? "CRITICAL" : g.number <= 8 ? "HIGH" : "MEDIUM",
        assignedTeam: "Engineering",
        targetPhase: PHASE,
        epicId: epicByGoalNum.get(g.number)!,
        milestoneId: milestonePhase.id,
        isPublic: false,
      },
    });
    roadmapByGoal.set(g.number, item.id);
  }

  let taskCount = 0;
  for (const g of data.goals) {
    const spIdx = GOAL_TO_SPRINT[g.number] ?? 1;
    const sprintId = sprintRecords.find((x) => x.idx === spIdx)?.id ?? sprintRecords[1].id;
    const epicId = epicByGoalNum.get(g.number)!;
    const roadmapItemId = roadmapByGoal.get(g.number)!;
    const sprintDone = spIdx === 0;
    for (let ti = 0; ti < (g.tasks || []).length; ti++) {
      const t = g.tasks[ti];
      const status = sprintDone ? "DONE" : spIdx === 1 ? (ti < 4 ? "IN_PROGRESS" : "TO_DO") : "BACKLOG";
      await prisma.task.create({
        data: {
          organisationId: orgId,
          sprintId,
          epicId,
          roadmapItemId,
          title: t.length > 180 ? t.slice(0, 177) + "…" : t,
          description: `Goal ${g.number} · ${g.id}`,
          type: "FEATURE",
          status,
          priority: g.number <= 3 ? "CRITICAL" : "MEDIUM",
          storyPoints: Math.min(8, 2 + (ti % 4)),
          assigneeId: ownerId,
          reporterId: ownerId,
        },
      });
      taskCount++;
    }
  }

  const backlogEpic = await prisma.epic.create({
    data: {
      organisationId: orgId,
      name: "Phase 2 — Polish & scale (deferred from Phase 1)",
      goal: "Items explicitly deferred until after Phase 1 engine is complete.",
      ownerId,
      targetPhase: "Phase 2",
      status: "ACTIVE",
    },
  });

  let bi = 90;
  for (const row of data.phase_1_2_backlog || []) {
    await prisma.backlogItem.create({
      data: {
        organisationId: orgId,
        title: row.item,
        description: row.reason,
        type: "FEATURE",
        source: "INTERNAL",
        priorityScore: bi,
        status: "NEW",
        epicId: backlogEpic.id,
        effortEstimate: "TBD",
      },
    });
    bi -= 2;
  }

  const masterLines = (data.acceptance_criteria_master || [])
    .map((x, i) => `${i + 1}. **${x.area}**: ${x.criterion}`)
    .join("\n");

  await prisma.okr.create({
    data: {
      organisationId: orgId,
      ownerId,
      objective: `${PHASE} — ${(data.project as { title?: string }).title || "Complete working platform engine"}`,
      period: PHASE,
      level: "COMPANY",
      keyResults: {
        create: [
          {
            metricName: "Goals with acceptance criteria met",
            currentValue: 2,
            targetValue: 14,
            unit: "goals",
            progress: 14,
            confidence: "AT_RISK",
            ownerId,
          },
          {
            metricName: "Master acceptance criteria (Section 04)",
            currentValue: 0,
            targetValue: 30,
            unit: "criteria",
            progress: 0,
            confidence: "ON_TRACK",
            ownerId,
          },
          {
            metricName: "12-step user journey (no developer help)",
            currentValue: 0,
            targetValue: 12,
            unit: "steps",
            progress: 0,
            confidence: "ON_TRACK",
            ownerId,
          },
        ],
      },
    },
  });

  const docBodies: { title: string; content: string; type: "PRODUCT_SPEC" | "MEETING_NOTES" | "RUNBOOK" }[] = [
    {
      title: `${PHASE} — Project summary`,
      content:
        mdSection("project", data.project) +
        mdSection("phase_definition", data.phase_definition) +
        mdSection("the_one_test", data.the_one_test),
      type: "PRODUCT_SPEC",
    },
    {
      title: `${PHASE} — Phase boundary (Phase 1 vs Phase 2)`,
      content: mdSection("phase_boundary", data.phase_boundary),
      type: "PRODUCT_SPEC",
    },
    {
      title: `${PHASE} — Acceptance criteria master (30 items)`,
      content: `# Master acceptance criteria\n\n${masterLines}\n`,
      type: "RUNBOOK",
    },
    {
      title: `${PHASE} — Operating rules`,
      content:
        (data.operating_rules || [])
          .map((r: { number: number; rule: string; description: string }) => `### ${r.number}. ${r.rule}\n${r.description}`)
          .join("\n\n") +
        "\n\n" +
        mdSection("sprint_completion", data.sprint_completion_definition) +
        mdSection("phase_completion", data.phase_completion_definition),
      type: "MEETING_NOTES",
    },
    {
      title: `${PHASE} — Sprint plan (JSON)`,
      content: mdSection("sprints", data.sprints),
      type: "MEETING_NOTES",
    },
  ];

  if (data.closing_statement) {
    docBodies.push({
      title: `${PHASE} — Closing statement`,
      content: data.closing_statement,
      type: "MEETING_NOTES",
    });
  }

  for (const d of docBodies) {
    await prisma.document.create({
      data: {
        organisationId: orgId,
        title: d.title,
        content: d.content,
        type: d.type,
        sourceType: "library",
      },
    });
  }

  console.log("\n=== Phase 1 seed complete ===");
  console.log(`Organisation: ${slug} (${orgId})`);
  console.log(`Phases: ${STANDARD_PHASES.join(", ")}`);
  console.log(`Milestones: 1`);
  console.log(`Sprints: ${data.sprints.length}`);
  console.log(`Epics: ${data.goals.length + 1} (14 goals + Phase 2 backlog epic)`);
  console.log(`Roadmap items: ${data.goals.length} (targetPhase: ${PHASE})`);
  console.log(`Tasks: ${taskCount}`);
  console.log(`Backlog items: ${data.phase_1_2_backlog?.length ?? 0}`);
  console.log(`OKRs: 1 (company, period: ${PHASE})`);
  console.log(`Documents: ${docBodies.length}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
