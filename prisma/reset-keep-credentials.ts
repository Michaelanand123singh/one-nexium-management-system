/**
 * Reset database: delete all operational data EXCEPT User, Organisation, OrganisationMember.
 * Also deletes Session so everyone is logged out.
 *
 * Safe for production-ish resets: keeps login accounts, org settings, roles, and phases.
 *
 * Run: npm run db:clean
 *      npx tsx prisma/reset-keep-credentials.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning database (keeping User, Organisation, OrganisationMember)...\n");

  // Order matters: children before parents (FK constraints).
  const steps: { label: string; run: () => Promise<{ count: number }> }[] = [
    { label: "Customer onboarding progress", run: () => prisma.customerOnboardingProgress.deleteMany() },
    { label: "Onboarding milestones", run: () => prisma.onboardingMilestone.deleteMany() },
    { label: "NPS responses", run: () => prisma.npsResponse.deleteMany() },
    { label: "Support tickets", run: () => prisma.supportTicket.deleteMany() },
    { label: "Customer feedback", run: () => prisma.customerFeedback.deleteMany() },
    { label: "Feature requests", run: () => prisma.featureRequest.deleteMany() },
    { label: "Referrals", run: () => prisma.referral.deleteMany() },
    { label: "Commissions", run: () => prisma.commission.deleteMany() },
    { label: "Document comments", run: () => prisma.documentComment.deleteMany() },
    { label: "Document versions", run: () => prisma.documentVersion.deleteMany() },
    { label: "Documents", run: () => prisma.document.deleteMany() },
    { label: "Notifications", run: () => prisma.notification.deleteMany() },
    { label: "Activity logs", run: () => prisma.activityLog.deleteMany() },
    { label: "OKR check-ins", run: () => prisma.okrCheckin.deleteMany() },
    { label: "Key results", run: () => prisma.keyResult.deleteMany() },
    { label: "OKRs", run: () => prisma.okr.deleteMany() },
    { label: "Bug attachments", run: () => prisma.bugAttachment.deleteMany() },
    { label: "Bugs", run: () => prisma.bug.deleteMany() },
    { label: "Comments", run: () => prisma.comment.deleteMany() },
    { label: "Planning attachments", run: () => prisma.planningCardAttachment.deleteMany() },
    { label: "Planning cards", run: () => prisma.planningCard.deleteMany() },
    { label: "Planning buckets", run: () => prisma.planningBucket.deleteMany() },
    { label: "Task hours", run: () => prisma.taskHour.deleteMany() },
    { label: "Subtasks", run: () => prisma.subtask.deleteMany() },
    { label: "Tasks", run: () => prisma.task.deleteMany() },
    { label: "Backlog items", run: () => prisma.backlogItem.deleteMany() },
    { label: "Roadmap item history", run: () => prisma.roadmapItemHistory.deleteMany() },
    { label: "Roadmap items", run: () => prisma.roadmapItem.deleteMany() },
    { label: "Sprints", run: () => prisma.sprint.deleteMany() },
    { label: "Epics", run: () => prisma.epic.deleteMany() },
    { label: "Milestones", run: () => prisma.milestone.deleteMany() },
    { label: "GTM assets", run: () => prisma.asset.deleteMany() },
    { label: "GTM events", run: () => prisma.gtmEvent.deleteMany() },
    { label: "Partners", run: () => prisma.partner.deleteMany() },
    { label: "Campaigns", run: () => prisma.campaign.deleteMany() },
    { label: "Customers", run: () => prisma.customer.deleteMany() },
    { label: "Mail messages", run: () => prisma.mailMessage.deleteMany() },
    { label: "Mail threads", run: () => prisma.mailThread.deleteMany() },
    { label: "Mail accounts", run: () => prisma.mailAccount.deleteMany() },
    { label: "HR onboarding documents", run: () => prisma.onboardingDocument.deleteMany() },
    { label: "HR onboarding records", run: () => prisma.onboarding.deleteMany() },
    { label: "Employees", run: () => prisma.employee.deleteMany() },
    { label: "Workstation samples", run: () => prisma.workstationActivitySample.deleteMany() },
    { label: "Workstation devices", run: () => prisma.workstationDevice.deleteMany() },
    { label: "Sessions", run: () => prisma.session.deleteMany() },
  ];

  for (const step of steps) {
    const { count } = await step.run();
    if (count > 0) {
      console.log(`  ✓ ${step.label}: ${count} removed`);
    }
  }

  const [users, orgs, members] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.organisation.count(),
    prisma.organisationMember.count({ where: { status: "ACTIVE" } }),
  ]);

  console.log("\nDone.");
  console.log(`  Kept: ${users} users, ${orgs} organisation(s), ${members} active membership(s).`);
  console.log("  All module data and sessions cleared. Users must log in again.\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
