import { MarkerType, type Edge, type Node } from "@xyflow/react";

export type E2eNodeData = {
  label: string;
  subtitle?: string;
  summary: string;
  phase: string;
  docTab: "hld" | "lld";
  heading: string;
};

export type E2eFlowDefinition = {
  id: string;
  shortLabel: string;
  title: string;
  description: string;
  nodes: (Omit<Node, "data"> & { data: E2eNodeData })[];
  edges: Edge[];
};

function edge(
  id: string,
  source: string,
  target: string,
  label?: string,
  opts?: { animated?: boolean; primary?: boolean }
): Edge {
  return {
    id,
    source,
    target,
    label,
    animated: opts?.animated,
    style: opts?.primary
      ? { stroke: "hsl(var(--primary))", strokeWidth: 2 }
      : undefined,
    markerEnd: { type: MarkerType.ArrowClosed },
  };
}

function n(
  id: string,
  x: number,
  y: number,
  phase: string,
  label: string,
  subtitle: string,
  summary: string,
  heading: string,
  docTab: "hld" | "lld" = "hld"
): Omit<Node, "data"> & { data: E2eNodeData } {
  return {
    id,
    position: { x, y },
    type: "e2eNode",
    data: { label, subtitle, summary, phase, heading, docTab },
  };
}

/** First-build happy path + side branches — mirrors HLD "Complete End-to-End Flow". */
const FIRST_BUILD: E2eFlowDefinition = {
  id: "first-build",
  shortLabel: "First build",
  title: "First build — prompt → preview",
  description:
    "Full path from chat submit through mode resolution, ask (optional), job queue, OCE/Hatchet stages, verification, preview, and SSE back to the browser.",
  nodes: [
    n(
      "fb-user",
      420,
      0,
      "1 · Client",
      "User message",
      "natural-language prompt",
      "User types in the project chat. Body fields: projectId, message, mode?, attachments?. No separate events endpoint.",
      "Layer 0 — Browser (Next.js Client)"
    ),
    n(
      "fb-browser",
      420,
      110,
      "1 · Client",
      "Browser chat UI",
      "use-ai-stream.ts",
      "POST /api/ai/chat with Accept: text/event-stream. Response body IS the live SSE for this turn. Cards render as events arrive. Reconnect uses build-stream + build-status.",
      "Layer 0 — Browser (Next.js Client)"
    ),
    n(
      "fb-api",
      420,
      230,
      "2 · API",
      "POST /api/ai/chat",
      "route.ts",
      "Always returns SSE (new Response(sse.stream)). Does NOT classify PrimaryAction at entry — only after mode resolution, and only in conversational / worker paths.",
      "Layer 1 — Next.js API Route"
    ),
    n(
      "fb-guards",
      420,
      350,
      "2 · API",
      "Guard chain",
      "auth → body → own → rate → dedup → lock",
      "requireUserId→401, parseBody→400, assertOwnsProject→404/403, rate→429, dedup→409, lock→423 (skipped for conversational), checkAiReady→503.",
      "Layer 1 — Next.js API Route"
    ),
    n(
      "fb-mode",
      420,
      470,
      "2 · API",
      "sanitizeResolvedMode",
      "client mode vs DB truth",
      "Dispatch key. Only explicit button clicks override DB. Stale-start + built-project regression guards. conversational always trusted.",
      "Layer 1 — Next.js API Route"
    ),
    n(
      "fb-ask",
      40,
      620,
      "3 · Pre-build",
      "Ask Mode",
      "runAskMode · inline",
      "One LLM round per HTTP turn. Readiness rubric + 85/100 floor. Completes → ask_complete (not plan_complete). No ai_build_jobs row.",
      "Layer 1B — Ask Mode (Pre-Build, Inline)"
    ),
    n(
      "fb-plan",
      240,
      620,
      "3 · Pre-build",
      "Planning Mode",
      "runPlanningMode · inline",
      "Inline planning engine (no job). Produces plan_complete when ready for approve_plan / confirm_requirements.",
      "Layer 1 — Next.js API Route"
    ),
    n(
      "fb-dispatch",
      480,
      620,
      "3 · Dispatch",
      "dispatchBuildTurn",
      "confirm / approve_plan",
      "Persist kickoff message → startOrResumeBuildJob (DEDUP: one active job per project) → emit build_handoff → observeBuildJob over SSE. Worker executes.",
      "Layer 2 — Build Orchestrator Worker (PM2)"
    ),
    n(
      "fb-cont",
      720,
      620,
      "3 · Control",
      "continue_building",
      "pushContinue",
      "Hatchet events.push(continue:<projectId>) resumes modules waitFor. Used after milestone_pause.",
      "Layer 5B — Hatchet Durable Execution (HATCHET_ENABLED path)"
    ),
    n(
      "fb-conv",
      920,
      620,
      "3 · Control",
      "conversational",
      "classify + resolveExecution",
      "Haiku classifyMessage → execution-resolver (toolMode, maxRounds, budgets). operate → devserver ≤8 rounds. question may stay inline with no job.",
      "Layer 1 — Next.js API Route"
    ),
    n(
      "fb-queue",
      480,
      760,
      "4 · Queue",
      "ai_build_jobs",
      "status: queued",
      "checkpoint.runContext holds userMessage, workspaceId, creditSessionId, singleEdit?, later hatchetRunId / milestone state.",
      "Layer 2 — Build Orchestrator Worker (PM2)"
    ),
    n(
      "fb-worker",
      480,
      880,
      "4 · Worker",
      "Build orchestrator",
      "worker.ts poll + pool",
      "PM2 process. BUILD_WORKER_POLL_MS → claimExecutableBuildJobs (FOR UPDATE SKIP LOCKED) → job-runner. SIGTERM re-queues in-flight.",
      "Layer 2 — Build Orchestrator Worker (PM2)"
    ),
    n(
      "fb-runner",
      480,
      1000,
      "4 · Worker",
      "job-runner.ts",
      "processOneJob → executeBuildJob",
      "Pause/cancel checks; checkBuildCredits is RESUME-gate only. Heartbeat Redis lease. createMcpCredential JWT. Freeze feature flags in ALS.",
      "Layer 3 — Job Runner (per-job gate)"
    ),
    n(
      "fb-hatchet",
      240,
      1140,
      "5 · Pipeline",
      "Hatchet oce-build",
      "if HATCHET_ENABLED",
      "dispatchHatchetBuild. Durable: scaffold→spec→design→compile→[modules]→preview→production-gate→finalize. LLM/I/O only inside memoized runChild.",
      "Layer 5B — Hatchet Durable Execution (HATCHET_ENABLED path)"
    ),
    n(
      "fb-oce",
      720,
      1140,
      "5 · Pipeline",
      "OCE Stage Driver",
      "HarnessFacade / non-Hatchet",
      "OCE_ENABLED → runOceStageDriver (PgJobStore + step loop). Else V3 coordinator or legacy. Flags frozen per job.",
      "Layer 5A — OCE Stage Driver (non-Hatchet path)"
    ),
    n(
      "fb-scaffold",
      40,
      1300,
      "6 · Stages",
      "scaffold",
      "Neon + workspace",
      "ensureDatabaseProvisioned, tenantId, MCP create_project, brief.md + page stubs.",
      "Layer 7 — Stage Handlers (production-runtime.ts)"
    ),
    n(
      "fb-spec",
      220,
      1300,
      "6 · Stages",
      "spec",
      "spec-interpreter",
      "Targeted LLM → AppSpec JSON. _confidence < 90 → C1 clarification pause (not a guess).",
      "Layer 7 — Stage Handlers (production-runtime.ts)"
    ),
    n(
      "fb-design",
      400,
      1300,
      "6 · Stages",
      "design",
      "design-agent",
      "Targeted LLM → design.md tokens (palette, type, density). WCAG contrast validated.",
      "Layer 7 — Stage Handlers (production-runtime.ts)"
    ),
    n(
      "fb-compile",
      580,
      1300,
      "6 · Stages",
      "compile (OCE)",
      "deterministic",
      "Same AppSpec → identical bytes. Generators + assemblers + reconcile. No LLM in compile.",
      "Layer 6 — OCE Compiler Engine (Deterministic)"
    ),
    n(
      "fb-fill",
      760,
      1300,
      "6 · Stages",
      "fill / modules",
      "runAgentTurn + V3",
      "Per-scope LLM fill with Harness V3 gates. Hatchet modules loop uses allSettled barriers.",
      "Layer 7 — Stage Handlers (production-runtime.ts)"
    ),
    n(
      "fb-verify",
      940,
      1300,
      "6 · Stages",
      "verify → heal",
      "tsc + smoke + routes",
      "MCP typecheck (tsc-service), behavioral smoke, route-collision resolve, heal loop, production-gate elevate.",
      "Layer 7 — Stage Handlers (production-runtime.ts)"
    ),
    n(
      "fb-preview",
      1120,
      1300,
      "6 · Stages",
      "preview",
      "dev server + DB smoke",
      "startDevServer; fullstack probes /api/health. Disconnected DB is FATAL. Emits dev_preview_url.",
      "Layer 7 — Stage Handlers (production-runtime.ts)"
    ),
    n(
      "fb-llm",
      220,
      1460,
      "7 · Services",
      "Universal LLM Client",
      "createLlmClientAsync",
      "Provider from platform_settings (anthropic/openai/google/glm). Tiers opus/sonnet/haiku. Zero caller changes on switch.",
      "Layer 7B — Universal LLM Client"
    ),
    n(
      "fb-mcp",
      580,
      1460,
      "7 · Services",
      "MCP + Dev Worker",
      ":8000 / :8001 / :8002",
      "JWT-scoped tools (workspace/build/devserver/quality/…). Dev worker SSD lifecycle. Warm tsc-service for verify.",
      "Layer 8 — MCP Server + Dev Worker (Python / AI Core)"
    ),
    n(
      "fb-data",
      940,
      1460,
      "7 · Services",
      "Data plane",
      "Postgres · Redis · PER",
      "ai_build_jobs / oce_jobs / project_execution. Redis: lock + SSE stream + BuildProgressState (30m). Dual-write .onenexium/ ↔ memorySnapshot.",
      "Layer 9 — Data Layer"
    ),
    n(
      "fb-emit",
      580,
      1600,
      "8 · Feedback",
      "durableEmit()",
      "Redis Stream + progress",
      "XADD event log + BuildProgressState JSON. Not Postgres. Powers live POST SSE and reconnect replay via XRANGE.",
      "Layer 10 — SSE Event Flow Back to Browser"
    ),
    n(
      "fb-ui",
      580,
      1720,
      "8 · Feedback",
      "Browser cards",
      "progress · pause · preview",
      "job_started, build_progress, ai_question, milestone_pause, dev_preview_url, mode_change, done/error. Continue → continue_building.",
      "Layer 0 — Browser (Next.js Client)"
    ),
    n(
      "fb-publish",
      940,
      1720,
      "9 · Optional",
      "Publish (later)",
      "user-triggered",
      "Not automatic. After preview_ready, Publish → sync S3 → CodeBuild → ECR → prod DB → ECS/Traefik → live_url. See Publish flow tab.",
      "Layer 11 — Publish / Deploy Pipeline (`publish-from-dev.ts` → CodeBuild → ECR → Traefik)"
    ),
  ],
  edges: [
    edge("fb-e1", "fb-user", "fb-browser"),
    edge("fb-e2", "fb-browser", "fb-api"),
    edge("fb-e3", "fb-api", "fb-guards"),
    edge("fb-e4", "fb-guards", "fb-mode"),
    edge("fb-e5", "fb-mode", "fb-ask", "ask"),
    edge("fb-e6", "fb-mode", "fb-plan", "plan"),
    edge("fb-e7", "fb-mode", "fb-dispatch", "confirm"),
    edge("fb-e8", "fb-mode", "fb-cont", "continue"),
    edge("fb-e9", "fb-mode", "fb-conv", "conversational"),
    edge("fb-e10", "fb-dispatch", "fb-queue"),
    edge("fb-e11", "fb-queue", "fb-worker"),
    edge("fb-e12", "fb-worker", "fb-runner"),
    edge("fb-e13", "fb-runner", "fb-hatchet", "Hatchet"),
    edge("fb-e14", "fb-runner", "fb-oce", "inline OCE/V3"),
    edge("fb-e15", "fb-hatchet", "fb-scaffold"),
    edge("fb-e16", "fb-oce", "fb-scaffold"),
    edge("fb-e17", "fb-scaffold", "fb-spec"),
    edge("fb-e18", "fb-spec", "fb-design"),
    edge("fb-e19", "fb-design", "fb-compile"),
    edge("fb-e20", "fb-compile", "fb-fill"),
    edge("fb-e21", "fb-fill", "fb-verify"),
    edge("fb-e22", "fb-verify", "fb-preview", "pass"),
    edge("fb-e23", "fb-verify", "fb-fill", "heal"),
    edge("fb-e24", "fb-spec", "fb-llm"),
    edge("fb-e25", "fb-design", "fb-llm"),
    edge("fb-e26", "fb-fill", "fb-llm"),
    edge("fb-e27", "fb-fill", "fb-mcp"),
    edge("fb-e28", "fb-verify", "fb-mcp"),
    edge("fb-e29", "fb-preview", "fb-mcp"),
    edge("fb-e30", "fb-runner", "fb-data"),
    edge("fb-e31", "fb-preview", "fb-emit"),
    edge("fb-e32", "fb-emit", "fb-ui", undefined, { animated: true, primary: true }),
    edge("fb-e33", "fb-ask", "fb-emit", "SSE"),
    edge("fb-e34", "fb-ui", "fb-browser", "reconnect", { animated: true }),
    edge("fb-e35", "fb-preview", "fb-publish", "optional"),
    edge("fb-e36", "fb-cont", "fb-hatchet", "resume"),
  ],
};

/** Follow-up on an already-built project — HLD + LLD Follow-up Flow. */
const FOLLOW_UP: E2eFlowDefinition = {
  id: "follow-up",
  shortLabel: "Follow-up",
  title: "Follow-up — message on a built project",
  description:
    "done → building → done. Routes by what CHANGES (not keywords): question/operate inline, bounded edit agent, or OCE growth build.",
  nodes: [
    n(
      "fu-msg",
      420,
      0,
      "1 · Entry",
      "Built project + message",
      "preview_ready / done",
      "User sends a follow-up (add wishlist, rename entity, tweak footer…). Status may already be preview_ready or live.",
      "Follow-up Flow (message on an already-built project)"
    ),
    n(
      "fu-mode",
      420,
      120,
      "1 · Entry",
      "sanitizeResolvedMode R3",
      "regression guard",
      "Forces conversational for finished projects — stale client cache cannot re-open ask/plan or force a blind rebuild.",
      "Layer 1 — Next.js API Route"
    ),
    n(
      "fu-cls",
      420,
      240,
      "2 · Classify",
      "classifyMessage",
      "Haiku PrimaryAction",
      "question → inline answer (no build). operate → devserver op. edit|fix bounded → singleEdit dispatch. structural/compound → full follow-up job.",
      "Layer 1 — Next.js API Route"
    ),
    n(
      "fu-q",
      80,
      380,
      "3 · Inline",
      "Question / operate",
      "no ai_build_jobs",
      "Inline runAgentTurn or devserver toolMode (restart/rebuild/logs) ≤8 rounds. Survives without queueing a build.",
      "Layer 1 — Next.js API Route"
    ),
    n(
      "fu-disp",
      420,
      380,
      "3 · Dispatch",
      "dispatchBuildTurn",
      "worker executes",
      "singleEdit:true for bounded edits, or full job for growth. Platform only observes SSE; PM2 worker runs the job.",
      "Layer 2 — Build Orchestrator Worker (PM2)"
    ),
    n(
      "fu-gates",
      420,
      520,
      "4 · Worker gates",
      "Follow-up pre-dispatch",
      "executeBuildJob Hatchet path",
      "1) Clarify gate: planFollowup not confident → job_paused_user + ai_question (threshold 90, max 3 rounds). 2) Edit-first router by ops.",
      "Follow-up Flow — a message on an already-built project",
      "lld"
    ),
    n(
      "fu-edit",
      160,
      680,
      "5A · Edit agent",
      "In-place EDIT",
      "singleEdit · forceEditMode",
      "runAgentTurn edit toolMode: read_file + apply_diff + apply_data_change (NO run_command). Renames/field-adds → data-safe ALTER TABLE. Fast, no full rebuild.",
      "Follow-up Flow — a message on an already-built project",
      "lld"
    ),
    n(
      "fu-grow",
      680,
      680,
      "5B · Growth",
      "OCE GROWTH BUILD",
      "growAppSpec",
      "add=unionSpecs (shrink-proof), remove=subtractSpec (keeps tables), rename=ALTER. compile emits __deltaSpawn → modules fill only changed scopes → production-gate → finalize.",
      "Follow-up Flow — a message on an already-built project",
      "lld"
    ),
    n(
      "fu-emit",
      420,
      840,
      "6 · Feedback",
      "durableEmit → SSE",
      "same spine as first build",
      "Progress, questions, preview URL stream back. Follow-ups inject design.md so new pages match existing tokens.",
      "Layer 10 — SSE Event Flow Back to Browser"
    ),
    n(
      "fu-done",
      420,
      960,
      "6 · Feedback",
      "done again",
      "builderMode stays done",
      "State machine: done → building → done. Preview/live updated; no re-entry into ask.",
      "Layer 15 — Builder Mode State Machine (Full)",
      "lld"
    ),
  ],
  edges: [
    edge("fu-e1", "fu-msg", "fu-mode"),
    edge("fu-e2", "fu-mode", "fu-cls"),
    edge("fu-e3", "fu-cls", "fu-q", "question/operate"),
    edge("fu-e4", "fu-cls", "fu-disp", "edit|growth"),
    edge("fu-e5", "fu-disp", "fu-gates"),
    edge("fu-e6", "fu-gates", "fu-edit", "edit/fix/rename"),
    edge("fu-e7", "fu-gates", "fu-grow", "add|remove"),
    edge("fu-e8", "fu-edit", "fu-emit"),
    edge("fu-e9", "fu-grow", "fu-emit"),
    edge("fu-e10", "fu-q", "fu-emit", "SSE"),
    edge("fu-e11", "fu-emit", "fu-done", undefined, { animated: true, primary: true }),
  ],
};

/** User-triggered publish — HLD Layer 11 + LLD publish/deploy. */
const PUBLISH: E2eFlowDefinition = {
  id: "publish",
  shortLabel: "Publish",
  title: "Publish — preview_ready → live URL",
  description:
    "User-triggered only. Durable publishFromDevPreview: S3 sync → CodeBuild → ECR → prod DB → ECS/Traefik → live_url (passwords once).",
  nodes: [
    n(
      "pub-ready",
      420,
      0,
      "1 · Unlock",
      "preview_ready",
      "Publish button unlocked",
      "After production-gate + smoke, project is preview_ready. Deploy is NOT automatic — user clicks Publish.",
      "Layer 11 — Publish / Deploy Pipeline (`publish-from-dev.ts` → CodeBuild → ECR → Traefik)"
    ),
    n(
      "pub-click",
      420,
      120,
      "1 · Unlock",
      "Publish click",
      "publish-from-dev.ts",
      "Durable background worker survives refresh; streams status over SSE: validating → syncing → building → deploying → live.",
      "Layer 11 — Publish / Deploy (`server/project/publish-from-dev.ts`)",
      "lld"
    ),
    n(
      "pub-sync",
      420,
      260,
      "2 · Sync",
      "S3 sync",
      "syncProjectToAwsBeforeBuild",
      "SSD → s3://…/user-projects/{projectId}/. Required: CodeBuild reads S3, not the worker disk. Empty sync = empty build.",
      "Layer 14 — S3 Sync Before Production Build",
      "lld"
    ),
    n(
      "pub-cb",
      420,
      400,
      "3 · Build",
      "CodeBuild → ECR",
      "onenexium-site-builder",
      "Docker Next.js standalone → push ECR {tenantId}:{buildId}. Poll status; CloudWatch logs on failure.",
      "Layer 18 — Deployment Pipeline (trigger_build → live)",
      "lld"
    ),
    n(
      "pub-db",
      200,
      540,
      "4 · Prod data",
      "Production DB",
      "provision + schema + seeds",
      "Neon/prod PG once → schema_push → seed role logins. Passwords emitted ONCE then stripped from durable log.",
      "Layer 11 — Publish / Deploy Pipeline (`publish-from-dev.ts` → CodeBuild → ECR → Traefik)"
    ),
    n(
      "pub-ecs",
      640,
      540,
      "4 · Runtime",
      "ECS + Traefik",
      "sites.onenexium.com",
      "start_container, register_traefik_route, optional custom domain + ACM, health probe.",
      "Layer 18 — Deployment Pipeline (trigger_build → live)",
      "lld"
    ),
    n(
      "pub-live",
      420,
      680,
      "5 · Live",
      "status = live",
      "live_url SSE",
      "UPDATE productionUrl, liveBuildJobId; clear preview; stop dev server. Browser shows LiveUrlCard + one-time accounts.",
      "Layer 11 — Publish / Deploy Pipeline (`publish-from-dev.ts` → CodeBuild → ECR → Traefik)"
    ),
  ],
  edges: [
    edge("pub-e1", "pub-ready", "pub-click"),
    edge("pub-e2", "pub-click", "pub-sync"),
    edge("pub-e3", "pub-sync", "pub-cb"),
    edge("pub-e4", "pub-cb", "pub-db"),
    edge("pub-e5", "pub-cb", "pub-ecs"),
    edge("pub-e6", "pub-db", "pub-live"),
    edge("pub-e7", "pub-ecs", "pub-live", undefined, { animated: true, primary: true }),
  ],
};

export const E2E_FLOWS: E2eFlowDefinition[] = [FIRST_BUILD, FOLLOW_UP, PUBLISH];
