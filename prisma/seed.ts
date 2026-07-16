import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding OneNexium Sprint Zero data...\n");

  // Clean existing data in correct order (respects FK constraints)
  console.log("  Cleaning existing data...");
  await prisma.customerOnboardingProgress.deleteMany();
  await prisma.onboardingMilestone.deleteMany();
  await prisma.npsResponse.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.customerFeedback.deleteMany();
  await prisma.featureRequest.deleteMany();
  await prisma.referral.deleteMany();
  await prisma.commission.deleteMany();
  await prisma.documentComment.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.document.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.okrCheckin.deleteMany();
  await prisma.keyResult.deleteMany();
  await prisma.okr.deleteMany();
  await prisma.bugAttachment.deleteMany();
  await prisma.bug.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.taskHour.deleteMany();
  await prisma.subtask.deleteMany();
  await prisma.task.deleteMany();
  await prisma.backlogItem.deleteMany();
  await prisma.roadmapItemHistory.deleteMany();
  await prisma.roadmapItem.deleteMany();
  await prisma.sprint.deleteMany();
  await prisma.epic.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.gtmEvent.deleteMany();
  await prisma.partner.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.mailMessage.deleteMany();
  await prisma.mailThread.deleteMany();
  await prisma.mailAccount.deleteMany();
  await prisma.workstationActivitySample.deleteMany();
  await prisma.workstationDevice.deleteMany();
  await prisma.organisationMember.deleteMany();
  await prisma.session.deleteMany();
  console.log("  Cleaned!");

  // ─── Organisation ──────────────────────────────────────────────
  const org = await prisma.organisation.upsert({
    where: { slug: "onenexium" },
    create: {
      name: "OneNexium",
      slug: "onenexium",
      phases: JSON.stringify([
        "Phase 1", "Phase 2", "Phase 3", "Phase 4",
        "Phase 5", "Phase 6", "Phase 7", "Phase 8",
      ]),
    },
    update: {
      phases: JSON.stringify([
        "Phase 1", "Phase 2", "Phase 3", "Phase 4",
        "Phase 5", "Phase 6", "Phase 7", "Phase 8",
      ]),
    },
  });
  const orgId = org.id;

  // ─── Users (admin keeps admin123; others use name/email prefix + 123) ───
  const hash = (pwd: string) => bcrypt.hash(pwd, 12);
  const [
    adminHash,
    eng1Hash,
    eng2Hash,
    pmHash,
    gtmHash,
    csmHash,
    engleadHash,
    devHash,
  ] = await Promise.all([
    hash("admin123"),
    hash("engineer1123"),
    hash("engineer2123"),
    hash("pm123"),
    hash("gtm123"),
    hash("csm123"),
    hash("englead123"),
    hash("dev123"),
  ]);

  const users = {
    admin: await prisma.user.upsert({
      where: { email: "admin@onenexium.com" },
      create: { email: "admin@onenexium.com", name: "Anand (Founder)", passwordHash: adminHash },
      update: { name: "Anand (Founder)", passwordHash: adminHash },
    }),
    eng1: await prisma.user.upsert({
      where: { email: "engineer1@onenexium.com" },
      create: { email: "engineer1@onenexium.com", name: "Engineer 1 — Infra Lead", passwordHash: eng1Hash },
      update: { name: "Engineer 1 — Infra Lead", passwordHash: eng1Hash },
    }),
    eng2: await prisma.user.upsert({
      where: { email: "engineer2@onenexium.com" },
      create: { email: "engineer2@onenexium.com", name: "Engineer 2 — Frontend Lead", passwordHash: eng2Hash },
      update: { name: "Engineer 2 — Frontend Lead", passwordHash: eng2Hash },
    }),
    pm: await prisma.user.upsert({
      where: { email: "pm@onenexium.com" },
      create: { email: "pm@onenexium.com", name: "Product Manager", passwordHash: pmHash },
      update: { name: "Product Manager", passwordHash: pmHash },
    }),
    gtm: await prisma.user.upsert({
      where: { email: "gtm@onenexium.com" },
      create: { email: "gtm@onenexium.com", name: "GTM Manager", passwordHash: gtmHash },
      update: { name: "GTM Manager", passwordHash: gtmHash },
    }),
    csm: await prisma.user.upsert({
      where: { email: "csm@onenexium.com" },
      create: { email: "csm@onenexium.com", name: "Customer Success Manager", passwordHash: csmHash },
      update: { name: "Customer Success Manager", passwordHash: csmHash },
    }),
    englead: await prisma.user.upsert({
      where: { email: "englead@onenexium.com" },
      create: { email: "englead@onenexium.com", name: "Engineering Lead", passwordHash: engleadHash },
      update: { name: "Engineering Lead", passwordHash: engleadHash },
    }),
    dev: await prisma.user.upsert({
      where: { email: "dev@onenexium.com" },
      create: { email: "dev@onenexium.com", name: "Developer", passwordHash: devHash },
      update: { name: "Developer", passwordHash: devHash },
    }),
  };

  const memberData: { userId: string; role: "SUPER_ADMIN" | "ENGINEERING_LEAD" | "DEVELOPER" | "PRODUCT_MANAGER" | "GTM_MANAGER" | "CUSTOMER_SUCCESS"; dept: "LEADERSHIP" | "ENGINEERING" | "PRODUCT" | "GTM" | "CUSTOMER_SUCCESS" }[] = [
    { userId: users.admin.id, role: "SUPER_ADMIN", dept: "LEADERSHIP" },
    { userId: users.eng1.id, role: "ENGINEERING_LEAD", dept: "ENGINEERING" },
    { userId: users.eng2.id, role: "DEVELOPER", dept: "ENGINEERING" },
    { userId: users.pm.id, role: "PRODUCT_MANAGER", dept: "PRODUCT" },
    { userId: users.gtm.id, role: "GTM_MANAGER", dept: "GTM" },
    { userId: users.csm.id, role: "CUSTOMER_SUCCESS", dept: "CUSTOMER_SUCCESS" },
    { userId: users.englead.id, role: "ENGINEERING_LEAD", dept: "ENGINEERING" },
    { userId: users.dev.id, role: "DEVELOPER", dept: "ENGINEERING" },
  ];

  for (const m of memberData) {
    await prisma.organisationMember.upsert({
      where: { organisationId_userId: { organisationId: orgId, userId: m.userId } },
      create: { organisationId: orgId, userId: m.userId, role: m.role, department: m.dept },
      update: { role: m.role, department: m.dept },
    });
  }
  console.log("  Users & memberships created");

  // ─── Milestones ────────────────────────────────────────────────
  const milestones = await Promise.all([
    prisma.milestone.create({ data: { organisationId: orgId, name: "Sprint Zero Complete", targetDate: new Date("2026-03-13"), description: "Full-stack AI web app builder — working, beautiful, shown to real users" } }),
    prisma.milestone.create({ data: { organisationId: orgId, name: "Sprint 1 Launch — First 20 Paying Users", targetDate: new Date("2026-03-27"), description: "Visual editor, billing, quality 95%, coaching templates" } }),
    prisma.milestone.create({ data: { organisationId: orgId, name: "Public Beta — Coaching Vertical", targetDate: new Date("2026-06-01"), description: "Public beta launch, coaching vertical focus, first $10k MRR" } }),
    prisma.milestone.create({ data: { organisationId: orgId, name: "Series A Ready", targetDate: new Date("2027-03-01"), description: "1,000 users, $100k MRR" } }),
  ]);
  console.log("  Milestones created");

  // ─── Epics ─────────────────────────────────────────────────────
  const epics = {
    infra: await prisma.epic.create({ data: { organisationId: orgId, name: "Infrastructure & DevOps", goal: "EC2 instances, Docker, Traefik, SSL, wildcard DNS — production-ready infra", ownerId: users.eng1.id, targetPhase: "Phase 5", status: "ACTIVE" } }),
    auth: await prisma.epic.create({ data: { organisationId: orgId, name: "Authentication & Security", goal: "NextAuth v5 with Google + email, JWT sessions, RBAC, middleware protection", ownerId: users.eng2.id, targetPhase: "Phase 5", status: "ACTIVE" } }),
    onboarding: await prisma.epic.create({ data: { organisationId: orgId, name: "Onboarding Experience", goal: "4-step wizard: business type, name, branding, first project — seamless first-run", ownerId: users.eng2.id, targetPhase: "Phase 5", status: "ACTIVE" } }),
    codegen: await prisma.epic.create({ data: { organisationId: orgId, name: "AI Code Generation Engine", goal: "MCP tools for codegen, multi-page generation, backend generation, system prompt engineering", ownerId: users.eng1.id, targetPhase: "Phase 5", status: "ACTIVE" } }),
    buildDeploy: await prisma.epic.create({ data: { organisationId: orgId, name: "Build & Deploy Pipeline", goal: "Docker build, self-healing retry loop, deploy to Runtime EC2, Traefik routing, live preview", ownerId: users.eng1.id, targetPhase: "Phase 5", status: "ACTIVE" } }),
    domains: await prisma.epic.create({ data: { organisationId: orgId, name: "Custom Domains & SSL", goal: "User enters domain, DNS instructions, polling verification, Let's Encrypt SSL, Traefik routing", ownerId: users.eng1.id, targetPhase: "Phase 5", status: "ACTIVE" } }),
    platformUI: await prisma.epic.create({ data: { organisationId: orgId, name: "Platform UI/UX", goal: "Beautiful dark-mode sidebar layout, chat interface, responsive design, shadcn/ui design system", ownerId: users.eng2.id, targetPhase: "Phase 5", status: "ACTIVE" } }),
    quality: await prisma.epic.create({ data: { organisationId: orgId, name: "Quality & Testing", goal: "80%+ build success rate, 20-prompt test suite, mobile responsiveness, integration testing", ownerId: users.admin.id, targetPhase: "Phase 5", status: "ACTIVE" } }),
    billing: await prisma.epic.create({ data: { organisationId: orgId, name: "Billing & Monetization", goal: "Stripe integration — Free/Pro/Business plans, revenue from day one", ownerId: users.pm.id, targetPhase: "Phase 6", status: "ACTIVE" } }),
    visualEditor: await prisma.epic.create({ data: { organisationId: orgId, name: "Visual Overlay Editor", goal: "Click-to-edit any component in generated sites without re-prompting", ownerId: users.eng2.id, targetPhase: "Phase 6", status: "ACTIVE" } }),
  };
  console.log("  Epics created");

  // ─── Sprints ───────────────────────────────────────────────────
  const sprints = {
    phase1: await prisma.sprint.create({ data: { organisationId: orgId, name: "Sprint Zero — Phase 1: Infra + Auth + Onboarding", goal: "EC2 up, Docker+Traefik running, NextAuth scaffold, 4-step onboarding working", startDate: new Date("2026-03-02"), endDate: new Date("2026-03-03"), status: "COMPLETED" } }),
    phase2: await prisma.sprint.create({ data: { organisationId: orgId, name: "Sprint Zero — Phase 2: MCP Tools + Chat UI", goal: "All 11 MCP tools built, chat interface live, Claude integration, end-to-end generation", startDate: new Date("2026-03-04"), endDate: new Date("2026-03-05"), status: "COMPLETED" } }),
    phase3: await prisma.sprint.create({ data: { organisationId: orgId, name: "Sprint Zero — Phase 3: Multi-Page + Backend + Domains", goal: "5-page site generation, Drizzle+API backend gen, custom domain flow, RBAC UI", startDate: new Date("2026-03-06"), endDate: new Date("2026-03-09"), status: "COMPLETED" } }),
    phase4: await prisma.sprint.create({ data: { organisationId: orgId, name: "Sprint Zero — Phase 4: Quality + Polish + Stability", goal: "UI polish pass, 20-prompt test, settings pages, notifications, integration testing", startDate: new Date("2026-03-10"), endDate: new Date("2026-03-11"), status: "ACTIVE" } }),
    phase5: await prisma.sprint.create({ data: { organisationId: orgId, name: "Sprint Zero — Phase 5: Harden + Demo Day", goal: "Bug fix sprint, 25-prompt test, demo prep, documentation, external demo with 3 people", startDate: new Date("2026-03-12"), endDate: new Date("2026-03-13"), status: "PLANNED" } }),
    sprint1: await prisma.sprint.create({ data: { organisationId: orgId, name: "Sprint 1 — Visual Editor + Billing + Quality v4", goal: "Visual overlay editor, Stripe billing, 95% build success, coaching templates, WebSocket build status", startDate: new Date("2026-03-16"), endDate: new Date("2026-03-27"), status: "PLANNED" } }),
  };
  console.log("  Sprints created");

  // ─── Roadmap Items ─────────────────────────────────────────────
  const roadmap = {
    auth: await prisma.roadmapItem.create({ data: { organisationId: orgId, title: "Authentication — NextAuth v5 + RBAC", description: "Google OAuth + email magic link, JWT session with role, middleware for route protection, admin/member/viewer guards", status: "SHIPPED", priority: "CRITICAL", assignedTeam: "Engineering", targetPhase: "Phase 5", epicId: epics.auth.id, milestoneId: milestones[0].id } }),
    onboarding: await prisma.roadmapItem.create({ data: { organisationId: orgId, title: "4-Step Onboarding Wizard", description: "Business type → Name+Description → Branding (colour, logo, font) → First project setup. Workspace record in DB on complete.", status: "SHIPPED", priority: "HIGH", assignedTeam: "Engineering", targetPhase: "Phase 5", epicId: epics.onboarding.id, milestoneId: milestones[0].id } }),
    platformLayout: await prisma.roadmapItem.create({ data: { organisationId: orgId, title: "Platform Shell — Beautiful Sidebar + Responsive", description: "Left sidebar 240px collapsible, dark/light theme, mobile hamburger drawer, top bar with user avatar. Tailwind + shadcn/ui.", status: "SHIPPED", priority: "HIGH", assignedTeam: "Engineering", targetPhase: "Phase 5", epicId: epics.platformUI.id, milestoneId: milestones[0].id } }),
    mcpTools: await prisma.roadmapItem.create({ data: { organisationId: orgId, title: "MCP Server — All 15 Tools (codegen, build, infra, deploy)", description: "FastMCP + FastAPI with 5 namespaces. codegen: write/read/list/apply_diff. build: trigger/errors/preview+self-healing. infra: provision/s3/secrets. deploy: docker/container/traefik/custom-domain.", status: "SHIPPED", priority: "CRITICAL", assignedTeam: "Engineering", targetPhase: "Phase 5", epicId: epics.codegen.id, milestoneId: milestones[0].id } }),
    chatUI: await prisma.roadmapItem.create({ data: { organisationId: orgId, title: "Chat Interface + Claude Integration + Live Preview", description: "2-column layout: chat (40%) + iframe preview (60%). Streaming SSE, tool status chips, conversation persistence. Split pane on desktop, stacked on mobile.", status: "SHIPPED", priority: "CRITICAL", assignedTeam: "Engineering", targetPhase: "Phase 5", epicId: epics.platformUI.id, milestoneId: milestones[0].id } }),
    multiPage: await prisma.roadmapItem.create({ data: { organisationId: orgId, title: "Multi-Page Site Generation (5 pages)", description: "layout.tsx → page.tsx → about → services → contact + Navbar + Footer. Mobile-responsive, brand colour CSS vars. 4/5 success target.", status: "IN_PROGRESS", priority: "CRITICAL", assignedTeam: "Engineering", targetPhase: "Phase 5", epicId: epics.codegen.id, milestoneId: milestones[0].id } }),
    backendGen: await prisma.roadmapItem.create({ data: { organisationId: orgId, title: "Backend Code Generation (Drizzle + API Routes)", description: "Detect forms in frontend → generate Drizzle schema + API routes. Contact, newsletter, booking. Zod validation, proper HTTP status codes.", status: "IN_PROGRESS", priority: "HIGH", assignedTeam: "Engineering", targetPhase: "Phase 5", epicId: epics.codegen.id, milestoneId: milestones[0].id } }),
    selfHealing: await prisma.roadmapItem.create({ data: { organisationId: orgId, title: "Self-Healing Build Retry Loop", description: "3-attempt retry: trigger build → on failure, feed TS errors to Claude → auto-fix → rebuild. Chat UI shows attempt status. Fallback to previous version.", status: "SHIPPED", priority: "HIGH", assignedTeam: "Engineering", targetPhase: "Phase 5", epicId: epics.buildDeploy.id, milestoneId: milestones[0].id } }),
    customDomain: await prisma.roadmapItem.create({ data: { organisationId: orgId, title: "Custom Domain Connection + SSL", description: "User enters domain → DNS instructions per registrar → 60s polling → on verified: Traefik route + Let's Encrypt cert → email confirmation.", status: "IN_PROGRESS", priority: "HIGH", assignedTeam: "Engineering", targetPhase: "Phase 5", epicId: epics.domains.id, milestoneId: milestones[0].id } }),
    uiPolish: await prisma.roadmapItem.create({ data: { organisationId: orgId, title: "Platform-wide UI Polish + Mobile Responsiveness", description: "Consistent spacing, hover states, loading skeletons, empty states, 404/error pages. Tested at 375px, 768px, 1280px.", status: "IN_PROGRESS", priority: "MEDIUM", assignedTeam: "Engineering", targetPhase: "Phase 5", epicId: epics.platformUI.id, milestoneId: milestones[0].id } }),
    visualEditor: await prisma.roadmapItem.create({ data: { organisationId: orgId, title: "Visual Overlay Editor — Click-to-Edit Components", description: "Users refine generated sites without re-prompting. Click any component → edit in place. Sprint 1 P0 priority.", status: "PLANNED", priority: "CRITICAL", assignedTeam: "Engineering", targetPhase: "Phase 6", epicId: epics.visualEditor.id, milestoneId: milestones[1].id } }),
    billing: await prisma.roadmapItem.create({ data: { organisationId: orgId, title: "Billing — Stripe Free/Pro/Business Plans", description: "Revenue from day one. Gate features behind plan limits. Stripe integration for recurring billing.", status: "PLANNED", priority: "CRITICAL", assignedTeam: "Engineering", targetPhase: "Phase 6", epicId: epics.billing.id, milestoneId: milestones[1].id } }),
    qualityV4: await prisma.roadmapItem.create({ data: { organisationId: orgId, title: "Generation Quality v4 — 95% Build Success", description: "Train system prompt on Sprint Zero data. Build success: 85% → 95%. Average quality: 3.5 → 4.2/5.", status: "PLANNED", priority: "CRITICAL", assignedTeam: "Engineering", targetPhase: "Phase 6", epicId: epics.quality.id, milestoneId: milestones[1].id } }),
    websocket: await prisma.roadmapItem.create({ data: { organisationId: orgId, title: "Real-time Build Status via WebSocket", description: "Replace 30s polling with WebSocket for instant build feedback during generation.", status: "PLANNED", priority: "HIGH", assignedTeam: "Engineering", targetPhase: "Phase 6", epicId: epics.buildDeploy.id, milestoneId: milestones[1].id } }),
    templates: await prisma.roadmapItem.create({ data: { organisationId: orgId, title: "Coaching Vertical Templates — 5 Pre-built Starting Points", description: "Reduce time-to-first-site from 3 min to 45 seconds for coaches, consultants, fitness, therapy, course creators.", status: "PLANNED", priority: "HIGH", assignedTeam: "Product", targetPhase: "Phase 6", epicId: epics.codegen.id, milestoneId: milestones[1].id } }),
    stripeGen: await prisma.roadmapItem.create({ data: { organisationId: orgId, title: "Stripe Payment Generation in User Apps", description: "Generate Stripe Checkout in user-built apps — key feature for coaches selling services.", status: "PLANNED", priority: "HIGH", assignedTeam: "Engineering", targetPhase: "Phase 6", epicId: epics.codegen.id, milestoneId: milestones[1].id } }),
    performance: await prisma.roadmapItem.create({ data: { organisationId: orgId, title: "Performance — Generation Time 3 min → 90 seconds", description: "Semantic caching + parallel file writes + faster Docker build sandbox.", status: "PLANNED", priority: "MEDIUM", assignedTeam: "Engineering", targetPhase: "Phase 6", epicId: epics.buildDeploy.id, milestoneId: milestones[1].id } }),
    seo: await prisma.roadmapItem.create({ data: { organisationId: orgId, title: "SEO Auto-Config — Meta Tags, Sitemap, OG Images", description: "Every generated site is search-engine ready out of the box.", status: "PLANNED", priority: "MEDIUM", assignedTeam: "Engineering", targetPhase: "Phase 6", epicId: epics.codegen.id } }),
    agencyWhiteLabel: await prisma.roadmapItem.create({ data: { organisationId: orgId, title: "White-Label Agency Platform", description: "Agencies can white-label OneNexium for their clients. Custom branding, sub-accounts.", status: "PLANNED", priority: "LOW", assignedTeam: "Product", targetPhase: "Phase 8", epicId: epics.billing.id, milestoneId: milestones[2].id } }),
  };
  console.log("  Roadmap items created");

  // ─── Tasks ─────────────────────────────────────────────────────
  // Day 1 Tasks
  const tasks = await Promise.all([
    // === DAY 1: Infrastructure + Traefik + Auth ===
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase1.id, epicId: epics.infra.id, roadmapItemId: roadmap.auth.id, title: "T1.1 — AWS Infrastructure Setup", description: "Launch Platform EC2 (t3.large) and Runtime EC2 (t3.xlarge). SSH both, install git/nvm/Python/Docker. Create Security Groups (platform-sg, runtime-sg, rds-sg). Confirm RDS reachable, create ECR repo.", type: "FEATURE", status: "DONE", priority: "CRITICAL", storyPoints: 5, assigneeId: users.eng1.id, reporterId: users.admin.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase1.id, epicId: epics.infra.id, title: "T1.2 — Docker + Traefik on Runtime EC2", description: "Install Docker Engine. Create docker network onenexium-runtime. Write traefik.yml (entrypoints, Let's Encrypt httpChallenge). Write docker-compose.yml for Traefik. HTTP→HTTPS redirect. Wildcard DNS: *.sites.onenexium.com → Runtime EC2.", type: "FEATURE", status: "DONE", priority: "CRITICAL", storyPoints: 5, assigneeId: users.eng1.id, reporterId: users.admin.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase1.id, epicId: epics.infra.id, roadmapItemId: roadmap.platformLayout.id, title: "T1.3 — Next.js Platform Project Setup", description: "pnpm create next-app@latest with TypeScript, Tailwind, App Router. Install drizzle-orm, next-auth, @anthropic-ai/sdk, shadcn/ui. Push to GitHub. Set up GitHub Actions CI/CD.", type: "FEATURE", status: "DONE", priority: "HIGH", storyPoints: 3, assigneeId: users.eng2.id, reporterId: users.admin.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase1.id, epicId: epics.auth.id, roadmapItemId: roadmap.auth.id, title: "T1.4 — NextAuth + Drizzle Auth Schema", description: "Implement NextAuth v5 (Auth.js) with Google OAuth + email magic link. JWT session with user.id and user.role. Drizzle auth tables (users, accounts, sessions, verification_tokens). Role column: admin/member/viewer. Middleware protects /app/* routes.", type: "FEATURE", status: "DONE", priority: "CRITICAL", storyPoints: 8, assigneeId: users.eng2.id, reporterId: users.admin.id } }),

    // === DAY 2: Onboarding + Layout + MCP Foundation ===
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase1.id, epicId: epics.onboarding.id, roadmapItemId: roadmap.onboarding.id, title: "T2.1 — 4-Step Onboarding Flow", description: "Step 1: Business Type (cards: Coaching/Consulting/Agency/Freelance/Other). Step 2: Business Name + Description. Step 3: Branding (colour picker, logo upload, font). Step 4: First project pre-fill. On complete: create workspace, mark onboarded=true.", type: "FEATURE", status: "DONE", priority: "HIGH", storyPoints: 8, assigneeId: users.eng2.id, reporterId: users.admin.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase1.id, epicId: epics.platformUI.id, roadmapItemId: roadmap.platformLayout.id, title: "T2.2 — Platform Shell Layout — Sidebar + Responsive", description: "Left sidebar 240px, collapsible to 60px icon-only. Sidebar items: Dashboard, Projects, Domains, Settings. Top bar: workspace name + user avatar. Mobile: hamburger → slide-over sheet. Tablet: icon-only sidebar.", type: "FEATURE", status: "DONE", priority: "HIGH", storyPoints: 8, assigneeId: users.eng2.id, reporterId: users.admin.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase1.id, epicId: epics.codegen.id, roadmapItemId: roadmap.mcpTools.id, title: "T2.3 — MCP Server — FastMCP Foundation", description: "FastMCP + FastAPI server with 5 route namespaces: /workspace, /codegen, /build, /infra, /deploy. JWT auth middleware. Structured logging. Health check per namespace. Run at mcp.onenexium.com with Caddy HTTPS.", type: "FEATURE", status: "DONE", priority: "CRITICAL", storyPoints: 8, assigneeId: users.eng1.id, reporterId: users.admin.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase1.id, epicId: epics.codegen.id, title: "T2.4 — Base Next.js Template for Generated Apps", description: "Minimal Next.js 14 App Router template: TypeScript strict, Tailwind, shadcn/ui, Drizzle ORM, CSS variables for theming. Dockerfile included. Must build clean.", type: "FEATURE", status: "DONE", priority: "HIGH", storyPoints: 3, assigneeId: users.eng1.id, reporterId: users.admin.id } }),

    // === DAY 3: All MCP Tools ===
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase2.id, epicId: epics.codegen.id, roadmapItemId: roadmap.mcpTools.id, title: "T3.1 — MCP /codegen — 4 Tools", description: "write_file(project_id, file_path, content), read_file(project_id, file_path), list_files(project_id), apply_diff(project_id, file_path, old_str, new_str). Each validates project_id, handles FileNotFoundError.", type: "FEATURE", status: "DONE", priority: "CRITICAL", storyPoints: 5, assigneeId: users.eng1.id, reporterId: users.admin.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase2.id, epicId: epics.buildDeploy.id, roadmapItemId: roadmap.selfHealing.id, title: "T3.2 — MCP /build — 3 Tools + Self-Healing", description: "trigger_build(project_id) — Docker sandbox build. get_build_errors(job_id) — structured error log. get_preview_url(project_id). Self-healing: buildWithHealing() retries 3x, feeds TS errors to Claude API.", type: "FEATURE", status: "DONE", priority: "CRITICAL", storyPoints: 8, assigneeId: users.eng1.id, reporterId: users.admin.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase2.id, epicId: epics.infra.id, roadmapItemId: roadmap.mcpTools.id, title: "T3.3 — MCP /infra — 4 Tools", description: "provision_tenant_schema(tenant_id), create_s3_folder(tenant_id), store_secret(tenant_id, key, value), get_secret(tenant_id, key). Test schema creation + secret round-trip.", type: "FEATURE", status: "DONE", priority: "HIGH", storyPoints: 5, assigneeId: users.eng1.id, reporterId: users.admin.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase2.id, epicId: epics.buildDeploy.id, roadmapItemId: roadmap.mcpTools.id, title: "T3.4 — MCP /deploy — 4 Tools", description: "build_docker_image(project_id, image_tag), start_container(project_id, image_uri, subdomain, port), register_traefik_route(project_id, subdomain, port), register_custom_domain(project_id, domain). SSH via paramiko.", type: "FEATURE", status: "DONE", priority: "HIGH", storyPoints: 5, assigneeId: users.eng1.id, reporterId: users.admin.id } }),

    // === DAY 4: Chat UI + Claude Integration ===
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase2.id, epicId: epics.platformUI.id, roadmapItemId: roadmap.chatUI.id, title: "T4.1 — AI Generation API Route", description: "app/api/ai/generate/route.ts — load project context from Drizzle, assemble system prompt, call Claude with MCP servers array, stream response as SSE, parse tool_use events.", type: "FEATURE", status: "DONE", priority: "CRITICAL", storyPoints: 5, assigneeId: users.eng2.id, reporterId: users.admin.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase2.id, epicId: epics.platformUI.id, roadmapItemId: roadmap.chatUI.id, title: "T4.2 — Chat Interface — Full Build", description: "2-column layout: chat left 40% + iframe preview right 60%. User messages right/indigo, AI left/surface. Tool status chips. Auto-resize textarea. Mobile: stacked vertically.", type: "FEATURE", status: "DONE", priority: "CRITICAL", storyPoints: 8, assigneeId: users.eng2.id, reporterId: users.admin.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase2.id, epicId: epics.codegen.id, roadmapItemId: roadmap.multiPage.id, title: "T4.3 — System Prompt — Code Generation v1", description: "lib/ai/system-prompt.ts — Multi-page file list, backend generation rules, mobile-responsive requirement, shadcn/ui only, auto-deploy chain after build success.", type: "FEATURE", status: "DONE", priority: "HIGH", storyPoints: 5, assigneeId: users.eng1.id, reporterId: users.eng2.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase2.id, epicId: epics.platformUI.id, roadmapItemId: roadmap.chatUI.id, title: "T4.4 — Projects List + Create Project Flow", description: "Grid of project cards (name, status, subdomain). Empty state with CTA. Create project modal. Conversation history persistence (ai_conversations table as JSON).", type: "FEATURE", status: "DONE", priority: "HIGH", storyPoints: 5, assigneeId: users.eng2.id, reporterId: users.admin.id } }),

    // === DAY 5: Multi-Page + Backend Gen ===
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase3.id, epicId: epics.codegen.id, roadmapItemId: roadmap.multiPage.id, title: "T5.1 — Multi-Page System Prompt Iteration", description: "Test multi-page generation with 5 business prompts. Target: layout + 4 pages + Navbar + Footer. Fix common failures (missing layout, bad imports). Achieve 4/5 success.", type: "FEATURE", status: "DONE", priority: "CRITICAL", storyPoints: 8, assigneeId: users.eng1.id, reporterId: users.eng2.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase3.id, epicId: epics.codegen.id, roadmapItemId: roadmap.backendGen.id, title: "T5.2 — Backend Generation Phase — Detect + Generate", description: "Scan frontend for forms: contact → contacts table + API route. Newsletter → subscribers. Booking → bookings. Each with Zod validation, Drizzle insert, Resend email. Run migrations.", type: "FEATURE", status: "DONE", priority: "HIGH", storyPoints: 8, assigneeId: users.eng1.id, reporterId: users.eng2.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase3.id, epicId: epics.codegen.id, roadmapItemId: roadmap.multiPage.id, title: "T5.3 — Generated App UI Quality — System Prompt v2", description: "Few-shot examples: hero section, services grid, testimonials, contact layout. Brand colour enforcement. Proper padding (py-16 md:py-24). Run 5 tests, compare to Day 4.", type: "FEATURE", status: "DONE", priority: "HIGH", storyPoints: 5, assigneeId: users.eng2.id, reporterId: users.eng1.id } }),

    // === DAY 6: Custom Domain + RBAC + Team ===
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase3.id, epicId: epics.domains.id, roadmapItemId: roadmap.customDomain.id, title: "T6.1 — Custom Domain Connection Flow", description: "User enters domain → WHOIS/registrar detection → DNS instructions (CNAME to {tenant_id}.sites.onenexium.com). 60s polling with dns.resolve(). On verify: Traefik route + Let's Encrypt cert. Email confirmation.", type: "FEATURE", status: "IN_PROGRESS", priority: "HIGH", storyPoints: 8, assigneeId: users.eng1.id, reporterId: users.admin.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase3.id, epicId: epics.auth.id, roadmapItemId: roadmap.auth.id, title: "T6.2 — RBAC — Role-Based UI", description: "Admin: all projects, team management, billing, delete buttons. Member: own projects, create/edit, no team/billing. Viewer: read-only, disabled chat input, no create buttons. Role badge in sidebar.", type: "FEATURE", status: "IN_PROGRESS", priority: "HIGH", storyPoints: 5, assigneeId: users.eng2.id, reporterId: users.admin.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase3.id, epicId: epics.auth.id, title: "T6.3 — Team Invites — Basic Flow", description: "Team management page: list members (name, email, role, joined). Invite by email via Resend magic link. Accept invite → create user with member role. Drizzle: team_invites table.", type: "FEATURE", status: "IN_PROGRESS", priority: "MEDIUM", storyPoints: 5, assigneeId: users.eng2.id, reporterId: users.admin.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase3.id, epicId: epics.domains.id, roadmapItemId: roadmap.customDomain.id, title: "T6.4 — Domains Dashboard UI", description: "List all domains across all projects. Status badges: Pending (yellow), Verifying (blue), Verified (green), SSL Active (green+lock). DNS instructions modal. Mobile-responsive table → card view.", type: "FEATURE", status: "TO_DO", priority: "MEDIUM", storyPoints: 3, assigneeId: users.eng2.id, reporterId: users.admin.id } }),

    // === DAY 7: UI Polish + Testing ===
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase4.id, epicId: epics.platformUI.id, roadmapItemId: roadmap.uiPolish.id, title: "T7.1 — Platform-wide UI Polish Pass", description: "Consistent spacing (gap-4, p-6), hover states on all interactive elements, loading skeletons, empty states with illustrations, 404/error pages. Test at 375px, 768px, 1280px.", type: "TECH_DEBT", status: "IN_PROGRESS", priority: "HIGH", storyPoints: 8, assigneeId: users.eng2.id, reporterId: users.admin.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase4.id, epicId: epics.quality.id, roadmapItemId: roadmap.uiPolish.id, title: "T7.2 — Generated App Quality — 20-Prompt Test", description: "Run 20 diverse prompts (different industries/lengths). Record: pages generated, build pass/fail, quality 1-5, deploy success. Target: 80% build success, avg quality 3/5+. Fix top 5 failure patterns.", type: "RESEARCH", status: "TO_DO", priority: "CRITICAL", storyPoints: 8, assigneeId: users.eng1.id, reporterId: users.eng2.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase4.id, epicId: epics.buildDeploy.id, roadmapItemId: roadmap.selfHealing.id, title: "T7.3 — Self-Healing Loop Visual Feedback", description: "Chat UI: 'Build failed — fixing 3 TS errors automatically... (attempt 2/3)'. Collapsed expandable error list. 'Fixed and rebuilt ✓' on success. 'Try again' button on exhausted retries.", type: "FEATURE", status: "TO_DO", priority: "MEDIUM", storyPoints: 3, assigneeId: users.eng2.id, reporterId: users.eng1.id } }),

    // === DAY 8: Settings + Notifications + Integration ===
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase4.id, epicId: epics.platformUI.id, title: "T8.1 — Settings Pages — Workspace + Account", description: "Workspace: name, description, brand colour picker, logo upload, delete workspace (type-to-confirm). Account: display name, email, avatar, change password, sign out all sessions.", type: "FEATURE", status: "TO_DO", priority: "HIGH", storyPoints: 5, assigneeId: users.eng2.id, reporterId: users.admin.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase4.id, epicId: epics.platformUI.id, title: "T8.2 — In-App Notification System", description: "Bell icon with unread count, dropdown with last 10 notifications. Triggers: deploy success, domain verified, team joined, build failed. Polling GET /api/notifications every 30s.", type: "FEATURE", status: "TO_DO", priority: "MEDIUM", storyPoints: 5, assigneeId: users.eng2.id, reporterId: users.admin.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase4.id, epicId: epics.quality.id, title: "T8.3 — Full Integration Test — 5 Complete Journeys", description: "Sign up → Onboard → Create project → Generate → Deploy → Add backend → Connect domain → Invite team. Run 5 times from scratch. Fix High severity bugs immediately. Screenshot every screen.", type: "RESEARCH", status: "TO_DO", priority: "CRITICAL", storyPoints: 8, assigneeId: users.eng1.id, reporterId: users.eng2.id } }),

    // === DAY 9: Hardening + Demo Prep ===
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase5.id, epicId: epics.quality.id, title: "T9.1 — Bug Fix Sprint — All High Severity", description: "Work through BUGS.md. Write test-flow.sh for MCP tools. Load test: 5 simultaneous deployments. Check disk usage, RDS connections, SSL cert expiry.", type: "BUG", status: "TO_DO", priority: "CRITICAL", storyPoints: 8, assigneeId: users.eng1.id, reporterId: users.admin.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase5.id, epicId: epics.quality.id, title: "T9.2 — 25-Prompt Coaching Vertical Test", description: "25 prompts: life coaches, business coaches, fitness, therapists, course creators, consultants, freelancers, photographers, personal trainers. Target: 85% build, 90% deploy, avg 3.5/5 quality.", type: "RESEARCH", status: "TO_DO", priority: "HIGH", storyPoints: 5, assigneeId: users.eng2.id, reporterId: users.eng1.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase5.id, epicId: epics.quality.id, title: "T9.3 — Demo Script + Environment Prep", description: "Write DEMO.md (8-min script). Pre-create demo accounts. Pre-run demo prompt as backup. Prepare 3 bulletproof prompts. Write FAQ. Practice twice.", type: "RESEARCH", status: "TO_DO", priority: "HIGH", storyPoints: 3, assigneeId: users.admin.id, reporterId: users.eng1.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase5.id, epicId: epics.quality.id, title: "T9.4 — Documentation + README", description: "READMEs for both repos, WHAT_WORKS.md, KNOWN_ISSUES.md, SPRINT_1_BACKLOG.md. Clean commit history. Push everything to GitHub.", type: "TECH_DEBT", status: "TO_DO", priority: "MEDIUM", storyPoints: 3, assigneeId: users.eng2.id, reporterId: users.admin.id } }),

    // === DAY 10: Demo Day ===
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase5.id, epicId: epics.quality.id, title: "T10.1 — Morning System Check (1hr before demo)", description: "Verify all systems: Platform EC2, Runtime EC2, RDS, MCP server. Full demo prompt in incognito. Check disk space, active containers, SSL. Fallback: pre-generated screenshots.", type: "RESEARCH", status: "TO_DO", priority: "CRITICAL", storyPoints: 2, assigneeId: users.eng1.id, reporterId: users.admin.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase5.id, epicId: epics.quality.id, title: "T10.2 — The Demo — 3 External People", description: "Part 1 (4 min): Sign up → onboard → generate 5-page coaching site → live URL. Part 2 (2 min): Add contact form → backend generated. Part 3 (2 min): Connect domain. Let them try. Record reactions.", type: "RESEARCH", status: "TO_DO", priority: "CRITICAL", storyPoints: 5, assigneeId: users.admin.id, reporterId: users.eng1.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase5.id, epicId: epics.quality.id, title: "T10.3 — Sprint Zero Retrospective", description: "What did Claude Code save the most time on? What took longer? Hardest technical challenge? What would we do differently? Biggest Sprint 1 risk? Commit RETRO.md.", type: "RESEARCH", status: "TO_DO", priority: "MEDIUM", storyPoints: 2, assigneeId: users.admin.id, reporterId: users.eng1.id } }),
    prisma.task.create({ data: { organisationId: orgId, sprintId: sprints.phase5.id, epicId: epics.quality.id, title: "T10.4 — Define Sprint 1 Backlog", description: "Based on demo feedback: P0 visual editor, P0 billing, P0 quality v4, P0 WebSocket. P1 coaching templates, P1 Stripe in user apps, P1 performance. P2 RBAC audit. Create GitHub issues.", type: "FEATURE", status: "TO_DO", priority: "HIGH", storyPoints: 3, assigneeId: users.admin.id, reporterId: users.pm.id } }),
  ]);
  console.log(`  ${tasks.length} tasks created`);

  // ─── Backlog Items (Sprint 1+ deferred work) ───────────────────
  const backlogItems = await Promise.all([
    prisma.backlogItem.create({ data: { organisationId: orgId, title: "Visual Overlay Editor — Click-to-Edit Components", description: "Users can click any component in the preview and edit it inline without re-prompting from scratch. Requires iframe postMessage communication and component tree parsing.", type: "FEATURE", source: "INTERNAL", priorityScore: 95, status: "REFINED", epicId: epics.visualEditor.id, effortEstimate: "XL" } }),
    prisma.backlogItem.create({ data: { organisationId: orgId, title: "Stripe Billing Integration — Free/Pro/Business Plans", description: "Stripe Checkout for subscriptions. Free: 1 project. Pro: 5 projects + custom domain. Business: unlimited + white-label. Webhooks for plan changes.", type: "FEATURE", source: "INTERNAL", priorityScore: 93, status: "REFINED", epicId: epics.billing.id, effortEstimate: "XL" } }),
    prisma.backlogItem.create({ data: { organisationId: orgId, title: "Generation Quality v4 — Trained on Sprint Zero Data", description: "Analyse all test prompt results from Sprint Zero. Identify top failure patterns. Retrain system prompt. Target: 85% → 95% build success, avg quality 3.5 → 4.2/5.", type: "IMPROVEMENT", source: "INTERNAL", priorityScore: 90, status: "REFINED", epicId: epics.quality.id, effortEstimate: "L" } }),
    prisma.backlogItem.create({ data: { organisationId: orgId, title: "Real-time Build Status via WebSocket", description: "Replace 30s polling with WebSocket for instant build feedback. Server sends events: build_started, file_written, build_complete, deploy_started, deploy_complete.", type: "IMPROVEMENT", source: "INTERNAL", priorityScore: 82, status: "GROOMED", epicId: epics.buildDeploy.id, effortEstimate: "M" } }),
    prisma.backlogItem.create({ data: { organisationId: orgId, title: "Coaching Vertical Templates — 5 Pre-built Starting Points", description: "Life coach, business coach, fitness coach, therapist, course creator. Each template: pre-built pages, forms, colour scheme. Reduce time-to-first-site from 3 min to 45 seconds.", type: "FEATURE", source: "CUSTOMER_FEEDBACK", priorityScore: 78, status: "GROOMED", epicId: epics.codegen.id, effortEstimate: "L" } }),
    prisma.backlogItem.create({ data: { organisationId: orgId, title: "Stripe Payment Generation in User Apps", description: "Generate Stripe Checkout code in user-built apps. Coaches can sell services directly from their site. Requires Stripe Connect for per-user accounts.", type: "FEATURE", source: "CUSTOMER_FEEDBACK", priorityScore: 75, status: "GROOMED", epicId: epics.codegen.id, effortEstimate: "XL" } }),
    prisma.backlogItem.create({ data: { organisationId: orgId, title: "Performance — Generation Time 3 min → 90 seconds", description: "Semantic caching for similar prompts. Parallel file writes instead of sequential. Faster Docker build sandbox with layer caching. Pre-warmed containers.", type: "IMPROVEMENT", source: "INTERNAL", priorityScore: 70, status: "REFINED", epicId: epics.buildDeploy.id, effortEstimate: "L" } }),
    prisma.backlogItem.create({ data: { organisationId: orgId, title: "SEO Auto-Config — Meta Tags, Sitemap, OG Images", description: "Auto-generate: <meta> description, Open Graph images, robots.txt, sitemap.xml, structured data (JSON-LD). Every generated site search-engine ready.", type: "FEATURE", source: "INTERNAL", priorityScore: 60, status: "NEW", epicId: epics.codegen.id, effortEstimate: "M" } }),
    prisma.backlogItem.create({ data: { organisationId: orgId, title: "Langfuse Observability Integration", description: "Add Langfuse tracing to all Claude API calls. Track: token usage, latency, prompt versions, generation quality scores. Dashboard for monitoring AI costs.", type: "TECH_DEBT", source: "INTERNAL", priorityScore: 55, status: "NEW", epicId: epics.quality.id, effortEstimate: "M" } }),
    prisma.backlogItem.create({ data: { organisationId: orgId, title: "Advanced Analytics Dashboard", description: "Platform-wide analytics: total sites generated, build success rate over time, most popular industries, avg generation time, user retention curves.", type: "FEATURE", source: "INTERNAL", priorityScore: 45, status: "NEW", epicId: epics.platformUI.id, effortEstimate: "L" } }),
    prisma.backlogItem.create({ data: { organisationId: orgId, title: "Auth in Generated Apps — NextAuth for User Sites", description: "Generate authentication in user-built apps. Users can add login/signup to their coaching sites for client portals.", type: "FEATURE", source: "CUSTOMER_FEEDBACK", priorityScore: 50, status: "NEW", epicId: epics.codegen.id, effortEstimate: "XL" } }),
    prisma.backlogItem.create({ data: { organisationId: orgId, title: "Figma Import — Convert Designs to Code", description: "Import Figma designs as reference for AI generation. Extract colour palette, layout structure, component hierarchy.", type: "RESEARCH", source: "INTERNAL", priorityScore: 30, status: "NEW", epicId: epics.codegen.id, effortEstimate: "XL" } }),
    prisma.backlogItem.create({ data: { organisationId: orgId, title: "White-Label Agency Platform", description: "Agencies can white-label OneNexium for their clients. Custom branding, sub-accounts, agency dashboard, client management.", type: "FEATURE", source: "PARTNER_REQUEST", priorityScore: 25, status: "NEW", epicId: epics.billing.id, effortEstimate: "XL" } }),
    prisma.backlogItem.create({ data: { organisationId: orgId, title: "Mobile App (React Native)", description: "Native mobile app for managing projects on the go. Push notifications for builds, deploys, domain verification.", type: "FEATURE", source: "INTERNAL", priorityScore: 15, status: "NEW", effortEstimate: "XL" } }),
    prisma.backlogItem.create({ data: { organisationId: orgId, title: "Custom Component Library for Generated Apps", description: "Let users define custom component libraries that AI uses during generation. Upload component designs → AI uses them.", type: "RESEARCH", source: "INTERNAL", priorityScore: 20, status: "NEW", epicId: epics.codegen.id, effortEstimate: "XL" } }),
  ]);
  console.log(`  ${backlogItems.length} backlog items created`);

  // ─── Bugs ──────────────────────────────────────────────────────
  const bugs = await Promise.all([
    prisma.bug.create({ data: { organisationId: orgId, title: "Claude Code generates Pages Router patterns instead of App Router", description: "When generating Next.js files, Claude occasionally uses the old pages/ directory pattern instead of app/ directory with App Router conventions.", stepsToReproduce: "1. Send prompt: 'Build a landing page'\n2. Observe generated file structure\n3. Some files reference pages/ instead of app/", expectedBehaviour: "All generated files should use Next.js 14 App Router (app/ directory)", actualBehaviour: "Occasionally generates pages/_app.tsx, pages/index.tsx instead of app/layout.tsx, app/page.tsx", severity: "HIGH", platform: "Generated Apps", reportedById: users.eng1.id, assignedToId: users.eng1.id, status: "CONFIRMED" } }),
    prisma.bug.create({ data: { organisationId: orgId, title: "Navbar not imported in generated layout.tsx", description: "Multi-page generation sometimes produces layout.tsx without importing the Navbar component, causing a build error.", stepsToReproduce: "1. Generate multi-page site\n2. Check app/layout.tsx\n3. Navbar component referenced but not imported", expectedBehaviour: "layout.tsx should import Navbar from components/Navbar", actualBehaviour: "Missing import statement, causes 'Navbar is not defined' build error", severity: "HIGH", platform: "Generated Apps", reportedById: users.eng2.id, assignedToId: users.eng1.id, status: "IN_PROGRESS" } }),
    prisma.bug.create({ data: { organisationId: orgId, title: "Self-healing loop doesn't handle type-only imports correctly", description: "When the self-healing retry fixes TypeScript errors, it sometimes removes type-only imports which causes different errors on the next attempt.", stepsToReproduce: "1. Generate code with type imports\n2. Trigger build with TS error\n3. Self-healing fixes one error but breaks type imports", expectedBehaviour: "Self-healing should preserve type imports when fixing other errors", actualBehaviour: "Type-only imports are stripped, causing new compile errors", severity: "MEDIUM", platform: "MCP Build Tools", reportedById: users.eng1.id, assignedToId: users.eng1.id, status: "CONFIRMED" } }),
    prisma.bug.create({ data: { organisationId: orgId, title: "Mobile sidebar drawer doesn't close on route change", description: "On mobile (375px), after opening the hamburger menu and clicking a sidebar link, the slide-over drawer remains open.", stepsToReproduce: "1. Open platform on mobile (375px)\n2. Tap hamburger menu\n3. Tap 'Projects' in sidebar\n4. Drawer stays open over the new page", expectedBehaviour: "Sidebar drawer should close automatically when navigating to a new route", actualBehaviour: "Drawer stays open, blocking the page content", severity: "MEDIUM", platform: "Web — Mobile", browserDevice: "iPhone SE / Chrome 375px", reportedById: users.eng2.id, assignedToId: users.eng2.id, status: "IN_PROGRESS" } }),
    prisma.bug.create({ data: { organisationId: orgId, title: "DNS polling doesn't timeout after 48 hours", description: "The domain verification polling continues indefinitely instead of timing out and marking the domain as failed.", stepsToReproduce: "1. Add a custom domain with invalid DNS\n2. Wait beyond 48 hours\n3. Polling continues, status stays 'Verifying'", expectedBehaviour: "After 48 hours, polling should stop and mark domain as FAILED", actualBehaviour: "Polling continues forever, accumulating server resources", severity: "MEDIUM", platform: "Custom Domains", reportedById: users.eng1.id, assignedToId: users.eng1.id, status: "NEW" } }),
    prisma.bug.create({ data: { organisationId: orgId, title: "Let's Encrypt rate limit hit during development", description: "Using production cert resolver during dev burns through the 50 certs/week rate limit. Need to use staging resolver for Days 1-8.", stepsToReproduce: "1. Deploy multiple test sites with custom domains during dev\n2. Hit Let's Encrypt rate limit\n3. No SSL certs issued for remaining sites", expectedBehaviour: "Use staging ACME resolver during development, production only for Day 9-10", actualBehaviour: "Production resolver used throughout, hitting rate limits", severity: "HIGH", platform: "Traefik / SSL", reportedById: users.eng1.id, assignedToId: users.eng1.id, status: "FIXED" } }),
    prisma.bug.create({ data: { organisationId: orgId, title: "Connection pool exhaustion with 5+ simultaneous deploys", description: "When running 5 simultaneous deployments, the RDS connection pool exhausts and new connections fail.", stepsToReproduce: "1. Trigger 5 deployments at the same time\n2. Observe RDS connection count\n3. 6th connection attempt fails", expectedBehaviour: "Connection pool should handle at least 10 simultaneous connections", actualBehaviour: "Pool set to max 5 connections, causing failures", severity: "HIGH", platform: "RDS / Database", reportedById: users.eng1.id, assignedToId: users.eng1.id, status: "CONFIRMED" } }),
    prisma.bug.create({ data: { organisationId: orgId, title: "Generated contact form doesn't show success message", description: "After submitting a contact form on a generated site, no success feedback is shown to the user even though the submission is saved.", stepsToReproduce: "1. Generate a site with contact form\n2. Submit the form\n3. No visual feedback", expectedBehaviour: "Show 'Message sent successfully!' toast or inline message", actualBehaviour: "Form submits silently, user doesn't know if it worked", severity: "LOW", platform: "Generated Apps", reportedById: users.eng2.id, assignedToId: users.eng2.id, status: "NEW" } }),
  ]);
  console.log(`  ${bugs.length} bugs created`);

  // ─── OKRs ──────────────────────────────────────────────────────
  const okrs = await Promise.all([
    prisma.okr.create({
      data: {
        organisationId: orgId,
        ownerId: users.admin.id,
        objective: "Deliver a working AI web app builder that impresses 3 external users by Day 10",
        period: "Phase 5",
        level: "COMPANY",
        keyResults: {
          create: [
            { metricName: "Build Success Rate", currentValue: 72, targetValue: 80, unit: "%", progress: 90, confidence: "ON_TRACK" },
            { metricName: "Multi-Page Generation Success", currentValue: 3, targetValue: 5, unit: "out of 5 test prompts", progress: 60, confidence: "AT_RISK" },
            { metricName: "End-to-End Demo Completions", currentValue: 0, targetValue: 3, unit: "external people", progress: 0, confidence: "ON_TRACK" },
            { metricName: "MCP Tools Operational", currentValue: 15, targetValue: 15, unit: "tools", progress: 100, confidence: "ON_TRACK" },
          ],
        },
      },
    }),
    prisma.okr.create({
      data: {
        organisationId: orgId,
        ownerId: users.eng1.id,
        objective: "Build production-ready infrastructure and all MCP tools",
        period: "Phase 5",
        level: "TEAM",
        keyResults: {
          create: [
            { metricName: "EC2 Instances Provisioned", currentValue: 2, targetValue: 2, unit: "instances", progress: 100, confidence: "ON_TRACK", ownerId: users.eng1.id },
            { metricName: "MCP /codegen Tools", currentValue: 4, targetValue: 4, unit: "tools", progress: 100, confidence: "ON_TRACK", ownerId: users.eng1.id },
            { metricName: "MCP /build Tools (incl. self-healing)", currentValue: 3, targetValue: 3, unit: "tools", progress: 100, confidence: "ON_TRACK", ownerId: users.eng1.id },
            { metricName: "MCP /deploy Tools", currentValue: 4, targetValue: 4, unit: "tools", progress: 100, confidence: "ON_TRACK", ownerId: users.eng1.id },
            { metricName: "Simultaneous Deploy Capacity", currentValue: 3, targetValue: 5, unit: "concurrent deploys", progress: 60, confidence: "AT_RISK", ownerId: users.eng1.id },
          ],
        },
      },
    }),
    prisma.okr.create({
      data: {
        organisationId: orgId,
        ownerId: users.eng2.id,
        objective: "Deliver beautiful, responsive platform UI with seamless UX",
        period: "Phase 5",
        level: "TEAM",
        keyResults: {
          create: [
            { metricName: "Platform Pages Polished", currentValue: 5, targetValue: 8, unit: "pages", progress: 62, confidence: "AT_RISK", ownerId: users.eng2.id },
            { metricName: "Mobile Responsiveness Score", currentValue: 70, targetValue: 100, unit: "% pages pass 375px test", progress: 70, confidence: "AT_RISK", ownerId: users.eng2.id },
            { metricName: "Chat Interface Streaming Latency", currentValue: 800, targetValue: 500, unit: "ms p95", progress: 60, confidence: "AT_RISK", ownerId: users.eng2.id },
            { metricName: "Empty State Coverage", currentValue: 4, targetValue: 7, unit: "list pages", progress: 57, confidence: "ON_TRACK", ownerId: users.eng2.id },
          ],
        },
      },
    }),
    prisma.okr.create({
      data: {
        organisationId: orgId,
        ownerId: users.pm.id,
        objective: "Reach first 20 paying customers within 4 weeks of Sprint Zero completion",
        period: "Phase 6",
        level: "COMPANY",
        keyResults: {
          create: [
            { metricName: "Paying Customers", currentValue: 0, targetValue: 20, unit: "customers", progress: 0, confidence: "ON_TRACK", ownerId: users.pm.id },
            { metricName: "Monthly Recurring Revenue", currentValue: 0, targetValue: 2000, unit: "USD", progress: 0, confidence: "ON_TRACK", ownerId: users.pm.id },
            { metricName: "Build Success Rate (quality v4)", currentValue: 72, targetValue: 95, unit: "%", progress: 0, confidence: "ON_TRACK", ownerId: users.eng1.id },
            { metricName: "Coaching Templates Created", currentValue: 0, targetValue: 5, unit: "templates", progress: 0, confidence: "ON_TRACK", ownerId: users.eng2.id },
          ],
        },
      },
    }),
  ]);
  console.log(`  ${okrs.length} OKRs with key results created`);

  // ─── GTM Campaigns ─────────────────────────────────────────────
  const campaigns = await Promise.all([
    prisma.campaign.create({ data: { organisationId: orgId, name: "Sprint Zero Demo — 3 External Users", type: "EVENT", status: "ACTIVE", ownerId: users.admin.id, startDate: new Date("2026-03-12"), endDate: new Date("2026-03-13"), targetMetric: "3 external users complete full demo", description: "Day 10 demo: show the working product to 3 people outside the team. Coaches/consultants preferred. Record reactions, collect emails." } }),
    prisma.campaign.create({ data: { organisationId: orgId, name: "Coaching Vertical Launch — Public Beta", type: "CONTENT", status: "PLANNED", ownerId: users.gtm.id, startDate: new Date("2026-04-01"), endDate: new Date("2026-06-01"), budget: 5000, targetMetric: "200 signups, 20 paying users", description: "Public beta launch targeting coaching vertical. Content marketing: blog posts, social media, coaching community engagement. 5 pre-built templates." } }),
    prisma.campaign.create({ data: { organisationId: orgId, name: "Product Hunt Launch", type: "COMMUNITY", status: "PLANNED", ownerId: users.gtm.id, startDate: new Date("2026-04-15"), endDate: new Date("2026-04-15"), targetMetric: "Top 5 Product of the Day", description: "Product Hunt launch with demo video, screenshots of best-generated sites. Time for maximum US morning visibility." } }),
    prisma.campaign.create({ data: { organisationId: orgId, name: "Agency Partner Outreach — White-Label Pilot", type: "PARTNERSHIP", status: "PLANNED", ownerId: users.gtm.id, startDate: new Date("2026-07-01"), endDate: new Date("2026-09-30"), budget: 2000, targetMetric: "5 agency partners signed", description: "Reach out to digital marketing agencies who serve coaches/consultants. Offer white-label pilot program. Revenue share model." } }),
    prisma.campaign.create({ data: { organisationId: orgId, name: "Coaching Community Content Series", type: "CONTENT", status: "PLANNED", ownerId: users.gtm.id, startDate: new Date("2026-04-01"), endDate: new Date("2026-05-31"), targetMetric: "50 blog post readers → 10 signups", description: "Weekly blog posts: 'How to build your coaching website in 5 minutes', 'Why coaches need a professional website', 'Contact form best practices for coaches'." } }),
    prisma.campaign.create({ data: { organisationId: orgId, name: "Referral Program Launch", type: "REFERRAL", status: "PLANNED", ownerId: users.gtm.id, startDate: new Date("2026-05-01"), endDate: new Date("2026-12-31"), targetMetric: "20% of new signups from referrals", description: "Refer a friend, both get 1 month Pro free. Unique referral codes, tracking dashboard, automated reward fulfillment." } }),
  ]);
  console.log(`  ${campaigns.length} campaigns created`);

  // ─── GTM Partners ──────────────────────────────────────────────
  const partners = await Promise.all([
    prisma.partner.create({ data: { organisationId: orgId, companyName: "CoachingTools.io", contactPerson: "Sarah Mitchell", type: "INTEGRATION", tier: "GOLD", status: "ACTIVE", pipelineStage: "IN_DISCUSSION", assignedToId: users.gtm.id, region: "US", niche: "Life coaching", audienceSize: "15,000 coaches" } }),
    prisma.partner.create({ data: { organisationId: orgId, companyName: "Digital Agency Partners", contactPerson: "James Wilson", type: "AGENCY", tier: "SILVER", status: "APPLIED", pipelineStage: "CONTACTED", assignedToId: users.gtm.id, region: "UK", niche: "Digital marketing agencies", audienceSize: "200 agencies" } }),
    prisma.partner.create({ data: { organisationId: orgId, companyName: "FitnessBiz Pro", contactPerson: "Maria Rodriguez", type: "REFERRAL", tier: "BRONZE", status: "APPLIED", pipelineStage: "IDENTIFIED", assignedToId: users.gtm.id, region: "US", niche: "Fitness coaches and personal trainers", audienceSize: "8,000 trainers" } }),
    prisma.partner.create({ data: { organisationId: orgId, companyName: "TherapistWeb Network", contactPerson: "Dr. Emily Chen", type: "COMMUNITY", tier: "SILVER", status: "APPLIED", pipelineStage: "CONTACTED", assignedToId: users.gtm.id, region: "US/Canada", niche: "Therapists and counselors", audienceSize: "12,000 therapists" } }),
    prisma.partner.create({ data: { organisationId: orgId, companyName: "CourseCreator Hub", contactPerson: "Alex Thompson", type: "INFLUENCER", tier: "GOLD", status: "APPLIED", pipelineStage: "IN_DISCUSSION", assignedToId: users.gtm.id, region: "Global", niche: "Online course creators", audienceSize: "50,000 YouTube subscribers" } }),
  ]);
  console.log(`  ${partners.length} partners created`);

  // ─── GTM Assets ────────────────────────────────────────────────
  await Promise.all([
    prisma.asset.create({ data: { organisationId: orgId, name: "OneNexium Pitch Deck — Sprint Zero", type: "pitch_deck", url: "https://drive.google.com/placeholder/pitch-deck-v1", folder: "Investor Materials", audience: "internal" } }),
    prisma.asset.create({ data: { organisationId: orgId, name: "Product Demo Video Script", type: "video", url: "https://drive.google.com/placeholder/demo-video-script", folder: "Demo", audience: "public" } }),
    prisma.asset.create({ data: { organisationId: orgId, name: "Coaching Vertical One-Pager", type: "one_pager", url: "https://drive.google.com/placeholder/coaching-one-pager", folder: "Sales Materials", audience: "partner" } }),
    prisma.asset.create({ data: { organisationId: orgId, name: "Sprint Zero Technical Architecture Diagram", type: "one_pager", url: "https://drive.google.com/placeholder/tech-arch", folder: "Engineering", audience: "internal" } }),
    prisma.asset.create({ data: { organisationId: orgId, name: "Brand Guidelines — OneNexium", type: "one_pager", url: "https://drive.google.com/placeholder/brand-guide", folder: "Brand", audience: "internal" } }),
  ]);
  console.log("  GTM assets created");

  // ─── GTM Events ────────────────────────────────────────────────
  await Promise.all([
    prisma.gtmEvent.create({ data: { organisationId: orgId, name: "Sprint Zero Demo Day", type: "meetup", date: new Date("2026-03-13"), location: "Virtual / In-person", goals: "Show working product to 3 external people. Collect feedback: would they pay? what frustrated them?", attendees: "3 external (coaches/advisors) + 2 engineers + founder", outcomeNotes: "Pending — Day 10", followUpTasks: "Record reactions, collect emails, define Sprint 1 based on feedback" } }),
    prisma.gtmEvent.create({ data: { organisationId: orgId, name: "Product Hunt Launch", type: "conference", date: new Date("2026-04-15"), location: "producthunt.com", goals: "Top 5 Product of the Day. 500+ upvotes.", attendees: "Founder posts, team engages in comments", followUpTasks: "Prepare launch assets, demo video, screenshot gallery, respond to all comments" } }),
    prisma.gtmEvent.create({ data: { organisationId: orgId, name: "Coaching Business Webinar — Build Your Website in 5 Minutes", type: "webinar", date: new Date("2026-04-22"), location: "Zoom", goals: "20 attendees, 5 sign up for free trial during webinar", attendees: "Coaches, consultants, freelancers from social media outreach", followUpTasks: "Send recording, follow up with attendees who didn't sign up, blog post from webinar content" } }),
  ]);
  console.log("  GTM events created");

  // ─── Customers (Demo + Early Users) ────────────────────────────
  const customers = await Promise.all([
    prisma.customer.create({ data: { organisationId: orgId, name: "Demo Coach — Sarah", email: "demo-coach@onenexium.com", plan: "PRO", signupDate: new Date("2026-03-13"), sitesBuiltCount: 1, lastActiveAt: new Date("2026-03-13"), onboardingStatus: "First Project Built", npsScore: 9, churnRisk: "LOW", assignedCsmId: users.csm.id, notes: "Sprint Zero demo participant. Loved the speed. Asked about booking integration." } }),
    prisma.customer.create({ data: { organisationId: orgId, name: "Demo Client — Marcus", email: "demo-client@onenexium.com", plan: "FREE", signupDate: new Date("2026-03-13"), sitesBuiltCount: 0, lastActiveAt: new Date("2026-03-13"), onboardingStatus: "Signed Up", npsScore: 7, churnRisk: "MEDIUM", assignedCsmId: users.csm.id, notes: "Sprint Zero demo participant. Developer friend. Interested but wants visual editor before committing." } }),
    prisma.customer.create({ data: { organisationId: orgId, name: "Elevate Life Coaching — Jessica Park", email: "jessica@elevatecoaching.com", plan: "PRO", signupDate: new Date("2026-03-20"), sitesBuiltCount: 2, lastActiveAt: new Date("2026-03-22"), onboardingStatus: "Domain Connected", npsScore: 8, churnRisk: "LOW", assignedCsmId: users.csm.id, notes: "Life coach. Built 2 sites, connected custom domain. Very happy with contact form generation. Wants booking." } }),
    prisma.customer.create({ data: { organisationId: orgId, name: "FitPro Training — Mike Johnson", email: "mike@fitprotraining.com", plan: "FREE", signupDate: new Date("2026-03-21"), sitesBuiltCount: 1, lastActiveAt: new Date("2026-03-21"), onboardingStatus: "First Project Built", churnRisk: "HIGH", assignedCsmId: users.csm.id, notes: "Personal trainer. Built 1 site but UI quality wasn't high enough. Needs coaching template with fitness focus." } }),
    prisma.customer.create({ data: { organisationId: orgId, name: "Clarity Consulting — Dr. Anika Patel", email: "anika@clarityconsulting.com", plan: "BUSINESS", signupDate: new Date("2026-03-22"), sitesBuiltCount: 3, lastActiveAt: new Date("2026-03-25"), onboardingStatus: "Domain Connected", npsScore: 9, churnRisk: "LOW", assignedCsmId: users.csm.id, notes: "Business consultant. Built 3 sites for different service lines. Wants white-label for her clients." } }),
    prisma.customer.create({ data: { organisationId: orgId, name: "MindfulPath Therapy — Dr. Emily Chen", email: "emily@mindfulpath.com", plan: "PRO", signupDate: new Date("2026-03-23"), sitesBuiltCount: 1, lastActiveAt: new Date("2026-03-24"), onboardingStatus: "First Project Built", npsScore: 6, churnRisk: "MEDIUM", assignedCsmId: users.csm.id, notes: "Therapist. Concerned about HIPAA compliance for contact forms. Needs reassurance on data handling." } }),
  ]);
  console.log(`  ${customers.length} customers created`);

  // ─── Customer Feedback ─────────────────────────────────────────
  await Promise.all([
    prisma.customerFeedback.create({ data: { organisationId: orgId, customerId: customers[0].id, type: "POSITIVE", theme: "Speed", content: "I went from zero to a live website in under 5 minutes. That's insane. My web developer quoted me 2 weeks for this." } }),
    prisma.customerFeedback.create({ data: { organisationId: orgId, customerId: customers[0].id, type: "FEATURE_REQUEST", theme: "Booking", content: "I need a booking system. My coaching clients need to schedule sessions. Can you add Calendly-like functionality?" } }),
    prisma.customerFeedback.create({ data: { organisationId: orgId, customerId: customers[1].id, type: "FEATURE_REQUEST", theme: "Visual Editor", content: "I want to click on a heading and change the text directly. Re-prompting for small changes is frustrating." } }),
    prisma.customerFeedback.create({ data: { organisationId: orgId, customerId: customers[2].id, type: "POSITIVE", theme: "Contact Form", content: "The contact form just worked out of the box! I got email notifications and everything was saved. Amazing." } }),
    prisma.customerFeedback.create({ data: { organisationId: orgId, customerId: customers[3].id, type: "NEGATIVE", theme: "AI Quality", content: "The generated design looks generic. I want something that looks specifically like a fitness/gym website, not a generic business site." } }),
    prisma.customerFeedback.create({ data: { organisationId: orgId, customerId: customers[4].id, type: "FEATURE_REQUEST", theme: "White-Label", content: "I run a consulting firm. I want to offer website building to my clients under my brand. Can you do white-label?" } }),
    prisma.customerFeedback.create({ data: { organisationId: orgId, customerId: customers[5].id, type: "NEGATIVE", theme: "Compliance", content: "I'm a therapist. I need HIPAA compliance for any contact forms. Can you guarantee data is encrypted and stored securely?" } }),
    prisma.customerFeedback.create({ data: { organisationId: orgId, customerId: customers[2].id, type: "POSITIVE", theme: "Custom Domain", content: "Connected my custom domain in 10 minutes. SSL was automatic. This used to take me days of DNS configuration." } }),
  ]);
  console.log("  Customer feedback created");

  // ─── Support Tickets ───────────────────────────────────────────
  await Promise.all([
    prisma.supportTicket.create({ data: { organisationId: orgId, customerId: customers[3].id, title: "Generated site doesn't look fitness-specific", description: "Built a site for my personal training business. The design looks like a generic consulting website. Need fitness-specific imagery and layout.", severity: "Medium", status: "OPEN", assignedCsmId: users.csm.id } }),
    prisma.supportTicket.create({ data: { organisationId: orgId, customerId: customers[5].id, title: "HIPAA compliance question for contact forms", description: "I'm a licensed therapist. Before I can use the contact form on my website, I need to know: Is data encrypted at rest? Is it stored on HIPAA-compliant infrastructure?", severity: "High", status: "IN_PROGRESS", assignedCsmId: users.csm.id } }),
    prisma.supportTicket.create({ data: { organisationId: orgId, customerId: customers[1].id, title: "Build failed and no error message shown", description: "Tried to generate a simple landing page but the build failed. The chat just said 'Build failed' with no details. Can't figure out what went wrong.", severity: "High", status: "OPEN", assignedCsmId: users.csm.id } }),
  ]);
  console.log("  Support tickets created");

  // ─── NPS Responses ─────────────────────────────────────────────
  await Promise.all([
    prisma.npsResponse.create({ data: { organisationId: orgId, customerId: customers[0].id, score: 9, feedback: "Incredible speed. Would love booking integration. Will recommend to coaching friends." } }),
    prisma.npsResponse.create({ data: { organisationId: orgId, customerId: customers[1].id, score: 7, feedback: "Impressive tech but needs visual editing. I don't want to re-prompt for small text changes." } }),
    prisma.npsResponse.create({ data: { organisationId: orgId, customerId: customers[2].id, score: 8, feedback: "Contact form + custom domain were flawless. Needs more page variety though." } }),
    prisma.npsResponse.create({ data: { organisationId: orgId, customerId: customers[4].id, score: 9, feedback: "Best AI tool I've used. If you add white-label, I'll pay business tier immediately." } }),
    prisma.npsResponse.create({ data: { organisationId: orgId, customerId: customers[5].id, score: 6, feedback: "Good product but compliance concerns for healthcare. Need HIPAA documentation." } }),
  ]);
  console.log("  NPS responses created");

  // ─── Onboarding Milestones ─────────────────────────────────────
  const onboardingMs = await Promise.all([
    prisma.onboardingMilestone.create({ data: { organisationId: orgId, key: "Signed Up", order: 1 } }),
    prisma.onboardingMilestone.create({ data: { organisationId: orgId, key: "Onboarding Complete", order: 2 } }),
    prisma.onboardingMilestone.create({ data: { organisationId: orgId, key: "First Project Built", order: 3 } }),
    prisma.onboardingMilestone.create({ data: { organisationId: orgId, key: "Domain Connected", order: 4 } }),
    prisma.onboardingMilestone.create({ data: { organisationId: orgId, key: "First Paying Customer", order: 5 } }),
  ]);

  for (const c of customers) {
    const status = c.onboardingStatus;
    const msToComplete = onboardingMs.filter((m) => {
      if (status === "Signed Up") return m.key === "Signed Up";
      if (status === "First Project Built") return ["Signed Up", "Onboarding Complete", "First Project Built"].includes(m.key);
      if (status === "Domain Connected") return ["Signed Up", "Onboarding Complete", "First Project Built", "Domain Connected"].includes(m.key);
      return false;
    });
    for (const m of msToComplete) {
      await prisma.customerOnboardingProgress.create({ data: { customerId: c.id, milestoneId: m.id } }).catch(() => {});
    }
  }
  console.log("  Onboarding milestones + progress created");

  // ─── Documents ─────────────────────────────────────────────────
  await Promise.all([
    prisma.document.create({ data: { organisationId: orgId, title: "Sprint Zero — Revised 10-Day Plan", content: "AI-Accelerated with Claude Code + Cursor. Full Feature Set. 10 Days.\n\nThe non-negotiable rule: Quality still does not matter. Connectivity and completeness of the feature set is the goal. Fix quality in Sprint 1.\n\nThe Day 10 definition: A non-technical person signs up, onboards, generates a 4-page site with backend, connects a domain, and sees it live.", type: "PRODUCT_SPEC", sourceType: "library" } }),
    prisma.document.create({ data: { organisationId: orgId, title: "Feature 1 — Authentication Spec (NextAuth + RBAC)", content: "NextAuth v5 (Auth.js) with:\n- Providers: Google OAuth + Email magic link (Resend)\n- Session: JWT strategy, 24hr expiry\n- Callbacks: jwt() adds user.id and user.role to token\n- Database: Drizzle ORM PostgreSQL\n- Tables: users, accounts, sessions, verification_tokens\n- Add: role ENUM (admin, member, viewer)\n- Middleware: Protect /app/* routes\n- RBAC guards: requireRole(role), useRole() hook\n- Roles: admin (all), member (create/edit own), viewer (read only)", type: "PRODUCT_SPEC", sourceType: "library" } }),
    prisma.document.create({ data: { organisationId: orgId, title: "Feature 2 — Onboarding Flow Spec", content: "4-step onboarding wizard at /onboarding\n\nStep 1 — Business Type: Coaching / Consulting / Agency / Freelance / Other\nStep 2 — Business Name + Description\nStep 3 — Branding: Primary colour, logo upload, font preference (Modern/Classic/Playful)\nStep 4 — First Project Setup: Pre-fills AI chat with business context\n\nOn complete: mark user.onboarded = true, create workspace record", type: "PRODUCT_SPEC", sourceType: "library" } }),
    prisma.document.create({ data: { organisationId: orgId, title: "Feature 3 — Multi-Page Generation Spec", content: "When generating a website, always create:\n- app/layout.tsx — Root layout: navbar, footer, font setup\n- app/page.tsx — Homepage: hero, features, CTA, testimonials\n- app/about/page.tsx — About: story, team, mission, values\n- app/services/page.tsx — Services: service cards with descriptions + pricing\n- app/contact/page.tsx — Contact: form, address, social links\n- components/Navbar.tsx — Responsive with mobile hamburger\n- components/Footer.tsx — Links, social icons, copyright\n\nEvery page must be mobile-responsive with Tailwind prefixes.", type: "PRODUCT_SPEC", sourceType: "library" } }),
    prisma.document.create({ data: { organisationId: orgId, title: "Feature 4 — Backend Code Generation Spec", content: "After frontend is approved, detect required backend features:\n\nContact form → contacts table + POST /api/contact (Zod → Drizzle → Resend email)\nNewsletter → subscribers table + POST /api/subscribe\nBooking → bookings table + POST /api/bookings (slot availability check)\n\nEvery API route must: Zod validation, proper HTTP status codes, typed exports, try/catch error handling.\n\nAfter schema: run Drizzle migration.", type: "PRODUCT_SPEC", sourceType: "library" } }),
    prisma.document.create({ data: { organisationId: orgId, title: "Technical Architecture — AWS + Docker + Traefik", content: "Platform EC2: t3.large (2 vCPU, 8GB) — Amazon Linux 2023\nRuntime EC2: t3.xlarge (4 vCPU, 16GB) — Amazon Linux 2023\nRDS: PostgreSQL 16, db.t3.micro\nECR: onenexium/user-apps\n\nTraefik: entrypoints web:80 + websecure:443, Let's Encrypt ACME http-01, Docker provider, automatic HTTPS redirect.\n\nMCP Server: FastMCP + FastAPI, 5 namespaces (/workspace, /codegen, /build, /infra, /deploy), JWT auth, Caddy HTTPS at mcp.onenexium.com.", type: "TECHNICAL_ARCHITECTURE", sourceType: "library" } }),
    prisma.document.create({ data: { organisationId: orgId, title: "System Prompt v1 — Code Generation Rules", content: "System prompt for Claude AI code generation:\n\n1. Always use Next.js 14 App Router (app/ directory, NOT pages/)\n2. Write files in order: layout.tsx FIRST, then page.tsx, then sub-pages\n3. Import only from shadcn/ui — do not create custom primitives\n4. Every page must export const metadata\n5. Every page must be mobile-responsive (sm: md: lg: prefixes)\n6. Use CSS variables --primary, --secondary from workspace brand config\n7. After all files written and build success: auto-deploy chain (build_docker_image → start_container → register_traefik_route)", type: "RUNBOOK", sourceType: "library" } }),
    prisma.document.create({ data: { organisationId: orgId, title: "Risk Register — Sprint Zero", content: "High Risks:\n1. Claude Code generates Pages Router patterns (mitigation: specify App Router in every prompt)\n2. MCP endpoint unreachable from Claude API (mitigation: test public reachability before Day 5)\n3. Scope creep (mitigation: founder reviews TASKS.md every morning)\n\nMedium Risks:\n4. Drizzle migration conflicts (mitigation: separate schemas — public vs t_{tenant_id})\n5. Let's Encrypt rate limit (mitigation: staging resolver during dev)\n6. NextAuth v5 breaking changes (mitigation: specify 'NextAuth v5' explicitly)\n7. Self-healing costs (mitigation: cap retries at 3, monitor daily spend)\n8. EC2 disk full (mitigation: docker system prune daily)", type: "RUNBOOK", sourceType: "library" } }),
    prisma.document.create({ data: { organisationId: orgId, title: "Demo Script — Day 10", content: "Total time: 8 minutes\n\nPart 1 (4 min): Sign up → 4-step onboarding → Generate 5-page coaching site → Show live URL with SSL\nPart 2 (2 min): 'Add a contact form' → Watch backend generate → Show API route + DB entry\nPart 3 (2 min): Connect domain (pre-configured test domain) → DNS verified → SSL active\n\nBackup: Pre-generated screenshots if live demo fails.\n\nPre-tested prompts:\n1. 'Build a complete website for Elevate Life Coaching'\n2. 'Build a fitness coaching website for FitPro Training'\n3. 'Build a business consulting website for Clarity Consulting'", type: "MEETING_NOTES", sourceType: "library" } }),
    prisma.document.create({ data: { organisationId: orgId, title: "GTM Playbook — Coaching Vertical Launch", content: "Target Market: Life coaches, business coaches, fitness coaches, therapists, online course creators, consultants, freelancers.\n\nMessaging: 'Build your coaching website in 5 minutes, not 5 weeks.'\n\nChannels:\n1. Content marketing — weekly blog posts on coaching website best practices\n2. Community — coaching Facebook groups, Reddit r/lifecoaching\n3. Product Hunt launch (target: Top 5 PotD)\n4. Referral program — 1 month Pro free for referrer and referee\n5. Agency partnerships — white-label for marketing agencies serving coaches\n\nPricing: Free (1 project), Pro $29/mo (5 projects + custom domain), Business $99/mo (unlimited + white-label).", type: "GTM_PLAYBOOK", sourceType: "library" } }),
    prisma.document.create({ data: { organisationId: orgId, title: "Sprint 1 Backlog — Prioritized", content: "P0 (Must-have):\n- Visual overlay editor — click-to-edit components\n- Billing — Stripe Free/Pro/Business plans\n- Generation quality v4 — trained on Sprint Zero data (85%→95%)\n- Real-time build status via WebSocket\n\nP1 (Should-have):\n- Coaching templates — 5 pre-built starting points\n- Stripe payment generation in user apps\n- Performance — generation time 3 min → 90 seconds\n\nP2 (Nice-to-have):\n- SEO auto-config — meta tags, sitemap, OG images\n- Advanced RBAC — workspace-level permissions audit", type: "PRODUCT_SPEC", sourceType: "library" } }),
    prisma.document.create({ data: { organisationId: orgId, title: "Brand Guidelines — OneNexium", content: "Primary: #4F46E5 (Indigo)\nAccent: #7C3AED (Violet)\nBackground Dark: #0F172A\nBackground Light: #F8FAFC\nSurface (Dark cards): #1E293B\n\nDesign System: Tailwind CSS + shadcn/ui + Lucide icons\n\nLayout:\n- Left sidebar: 240px, collapsible to 60px\n- Top bar: breadcrumb left, user avatar + notifications right\n- Main: max-w-7xl, centered, padding 24px\n\nChat Interface:\n- User messages: right, indigo bubble\n- AI messages: left, surface card\n- Tool use chips: small rounded badges\n- Preview: split-pane — chat left (40%), iframe right (60%)", type: "BRAND_GUIDELINES", sourceType: "library" } }),
  ]);
  console.log("  Documents created");

  // ─── Feature Requests ──────────────────────────────────────────
  await Promise.all([
    prisma.featureRequest.create({ data: { organisationId: orgId, title: "Booking/Scheduling Integration (Calendly-like)", description: "Coaches need clients to book sessions. Generate booking system with time slots, calendar view, and email confirmations.", customerId: customers[0].id, votes: 8, status: "ACCEPTED", backlogItemId: backlogItems[5].id } }),
    prisma.featureRequest.create({ data: { organisationId: orgId, title: "Visual Click-to-Edit for Generated Sites", description: "Click any element on the preview and edit it inline. Change text, colours, images without re-prompting.", customerId: customers[1].id, votes: 15, status: "ACCEPTED", backlogItemId: backlogItems[0].id } }),
    prisma.featureRequest.create({ data: { organisationId: orgId, title: "White-Label for Agencies", description: "Agency dashboard to manage client sites. Custom branding on the platform. Sub-accounts.", customerId: customers[4].id, votes: 5, status: "ACCEPTED", backlogItemId: backlogItems[12].id } }),
    prisma.featureRequest.create({ data: { organisationId: orgId, title: "Industry-Specific Templates", description: "Pre-built starting points for specific industries: coaching, fitness, therapy, consulting. Should look industry-appropriate, not generic.", customerId: customers[3].id, votes: 12, status: "ACCEPTED", backlogItemId: backlogItems[4].id } }),
    prisma.featureRequest.create({ data: { organisationId: orgId, title: "HIPAA Compliance Documentation", description: "Official documentation on data handling, encryption, and compliance for healthcare professionals using the platform.", customerId: customers[5].id, votes: 3, status: "PENDING" } }),
  ]);
  console.log("  Feature requests created");

  // ─── Notifications (sample) ────────────────────────────────────
  await Promise.all([
    prisma.notification.create({ data: { organisationId: orgId, userId: users.admin.id, type: "milestone", title: "Sprint Zero — Phase 2 Complete", body: "All 11 MCP tools built and manually tested. Chat UI live. End-to-end generation pipe working.", link: "/sprint" } }),
    prisma.notification.create({ data: { organisationId: orgId, userId: users.admin.id, type: "bug", title: "High severity bug: Pages Router pattern generated", body: "Claude occasionally generates pages/ router instead of app/ router. Needs system prompt fix.", link: "/bugs" } }),
    prisma.notification.create({ data: { organisationId: orgId, userId: users.eng1.id, type: "task", title: "T7.2 assigned to you — 20-Prompt Test", body: "Run 20 diverse prompts and record build success rate. Target: 80% build success.", link: "/sprint" } }),
    prisma.notification.create({ data: { organisationId: orgId, userId: users.eng2.id, type: "task", title: "T7.1 assigned to you — UI Polish Pass", body: "Consistent spacing, hover states, loading skeletons, empty states across all platform pages.", link: "/sprint" } }),
    prisma.notification.create({ data: { organisationId: orgId, userId: users.csm.id, type: "ticket", title: "New support ticket: HIPAA compliance question", body: "Dr. Emily Chen needs HIPAA compliance information before using contact forms on her therapy website.", link: "/customers" } }),
    prisma.notification.create({ data: { organisationId: orgId, userId: users.gtm.id, type: "campaign", title: "Sprint Zero Demo Day is tomorrow", body: "3 external people are confirmed for the Day 10 demo. Demo script and backup screenshots ready.", link: "/gtm" } }),
  ]);
  console.log("  Notifications created");

  // ─── Activity Logs (recent activity) ───────────────────────────
  const now = new Date();
  const activityData = [
    { userId: users.eng1.id, action: "created", entityType: "task", entityId: tasks[0].id, metadata: { title: "T1.1 — AWS Infrastructure Setup" } },
    { userId: users.eng2.id, action: "created", entityType: "task", entityId: tasks[3].id, metadata: { title: "T1.4 — NextAuth + Drizzle Auth Schema" } },
    { userId: users.eng1.id, action: "updated", entityType: "task", entityId: tasks[0].id, metadata: { field: "status", from: "TO_DO", to: "DONE" } },
    { userId: users.eng2.id, action: "updated", entityType: "task", entityId: tasks[3].id, metadata: { field: "status", from: "IN_PROGRESS", to: "DONE" } },
    { userId: users.eng1.id, action: "created", entityType: "bug", entityId: bugs[0].id, metadata: { title: "Pages Router pattern generated" } },
    { userId: users.eng2.id, action: "updated", entityType: "roadmap_item", entityId: roadmap.auth.id, metadata: { field: "status", from: "IN_PROGRESS", to: "SHIPPED" } },
    { userId: users.admin.id, action: "created", entityType: "okr", entityId: okrs[0].id, metadata: { objective: "Deliver working AI web app builder" } },
    { userId: users.gtm.id, action: "created", entityType: "campaign", entityId: campaigns[0].id, metadata: { name: "Sprint Zero Demo" } },
    { userId: users.csm.id, action: "created", entityType: "customer", entityId: customers[0].id, metadata: { name: "Demo Coach — Sarah" } },
    { userId: users.eng2.id, action: "updated", entityType: "task", entityId: tasks[tasks.length - 10].id, metadata: { field: "status", from: "BACKLOG", to: "IN_PROGRESS" } },
  ];
  for (let i = 0; i < activityData.length; i++) {
    const a = activityData[i];
    await prisma.activityLog.create({
      data: {
        organisationId: orgId,
        userId: a.userId,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        metadata: a.metadata,
        createdAt: new Date(now.getTime() - (activityData.length - i) * 3600000),
      },
    });
  }
  console.log("  Activity logs created");

  // ─── Summary ───────────────────────────────────────────────────
  console.log("\n=== SEED COMPLETE ===");
  console.log(`Organisation: ${org.name} (${org.slug})`);
  console.log(`Users: 8 role accounts — passwords are name-based (admin keeps admin123)`);
  console.log(`Milestones: ${milestones.length}`);
  console.log(`Epics: ${Object.keys(epics).length}`);
  console.log(`Sprints: ${Object.keys(sprints).length}`);
  console.log(`Roadmap items: ${Object.keys(roadmap).length}`);
  console.log(`Tasks: ${tasks.length}`);
  console.log(`Backlog items: ${backlogItems.length}`);
  console.log(`Bugs: ${bugs.length}`);
  console.log(`OKRs: ${okrs.length}`);
  console.log(`Campaigns: ${campaigns.length}`);
  console.log(`Partners: ${partners.length}`);
  console.log(`Customers: ${customers.length}`);
  console.log(`Documents: 12`);
  console.log(`\nPrimary login accounts:`);
  console.log(`  SUPER_ADMIN        admin@onenexium.com / admin123`);
  console.log(`  PRODUCT_MANAGER    pm@onenexium.com / pm123`);
  console.log(`  ENGINEERING_LEAD   englead@onenexium.com / englead123`);
  console.log(`                     engineer1@onenexium.com / engineer1123`);
  console.log(`  DEVELOPER          dev@onenexium.com / dev123`);
  console.log(`                     engineer2@onenexium.com / engineer2123`);
  console.log(`\n(GTM/CS users may still exist for seed FK data; modules /gtm and /okrs are soft-archived.)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
