import { MarkerType, type Edge } from "@xyflow/react";
import type {
  ArchitectureFlowNode,
  LldSectionDefinition,
} from "@/components/architecture/types";

function edge(id: string, source: string, target: string, label?: string): Edge {
  return {
    id,
    source,
    target,
    label,
    markerEnd: { type: MarkerType.ArrowClosed },
  };
}

function node(
  id: string,
  x: number,
  y: number,
  data: ArchitectureFlowNode["data"]
): ArchitectureFlowNode {
  return {
    id,
    position: { x, y },
    type: "flowNode",
    data,
  };
}

function n(
  id: string,
  x: number,
  y: number,
  heading: string,
  label: string,
  subtitle: string,
  summary: string
): ArchitectureFlowNode {
  return node(id, x, y, { label, subtitle, summary, docTab: "lld", heading });
}

/**
 * LLD-only diagrams — deeper than HLD (files, guards, handlers, stores).
 * Topology is intentionally different from HLD layer graphs.
 */
export const LLD_DIAGRAMS: LldSectionDefinition[] = [
  {
    id: "lld-layer-0",
    shortLabel: "L0",
    heading: "Layer 0 — Browser / Frontend",
    title: "Browser / Frontend",
    description:
      "use-ai-stream.ts: POST body is live SSE; reconnect via build-stream (750ms tail) + build-status.",
    nodes: [
      n(
        "l0-hook",
        300,
        0,
        "Layer 0 — Browser / Frontend",
        "use-ai-stream.ts",
        "project-editor hook",
        "Chat input submits { projectId, message, mode?, attachments? }. Field names: mode (not action), message (not content)."
      ),
      n(
        "l0-post",
        300,
        120,
        "Layer 0 — Browser / Frontend",
        "POST /api/ai/chat",
        "Accept: text/event-stream",
        "Response body IS the live SSE for this turn. No GET /api/ai/events. On 423 PROJECT_BUSY: queue free-text or retry mode actions at 2s/4s/8s."
      ),
      n(
        "l0-stream",
        40,
        260,
        "Layer 0 — Browser / Frontend",
        "build-stream",
        "GET …/build-stream",
        "Reconnect observer: getEventsSince(lastEventId) then tail every TAIL_INTERVAL_MS=750ms until terminal (+4.5s quiescence) or previewUrl. Max 5 min."
      ),
      n(
        "l0-status",
        300,
        260,
        "Layer 0 — Browser / Frontend",
        "build-status",
        "JSON poll fallback",
        "GET …/build-status?lastEventId=… when SSE observer is unavailable."
      ),
      n(
        "l0-ui",
        560,
        260,
        "Layer 0 — Browser / Frontend",
        "Event → UI cards",
        "job_started · progress · pause",
        "Maps ~event types to React: MilestonePauseCard, QuestionCard (ai_question), preview iframe, LiveUrlCard, ErrorCard. Continue → mode continue_building → pushContinue."
      ),
      n(
        "l0-redis",
        300,
        400,
        "Layer 0 — Browser / Frontend",
        "BuildProgressState",
        "Redis 30m TTL",
        "Persists phase, milestone pause, pendingClarification so reconnect rehydrates without Postgres."
      ),
    ],
    edges: [
      edge("l0e1", "l0-hook", "l0-post"),
      edge("l0e2", "l0-post", "l0-ui", "live SSE"),
      edge("l0e3", "l0-hook", "l0-stream", "reconnect"),
      edge("l0e4", "l0-stream", "l0-status", "fallback"),
      edge("l0e5", "l0-stream", "l0-ui", "replay"),
      edge("l0e6", "l0-ui", "l0-redis", "hydrate"),
    ],
  },
  {
    id: "lld-layer-1",
    shortLabel: "L1",
    heading: "Layer 1 — Next.js API Route",
    title: "Next.js API Route",
    description:
      "route.ts: ordered guards → sanitizeResolvedMode → 5 branches. Always Response(sse.stream).",
    nodes: [
      n(
        "l1-file",
        300,
        0,
        "Layer 1 — Next.js API Route",
        "chat/route.ts",
        "+ build-jobs/route.ts",
        "Main handler. Does NOT classify PrimaryAction at entry — only in conversational branch / worker."
      ),
      n(
        "l1-guards",
        300,
        120,
        "Layer 1 — Next.js API Route",
        "Guard chain (1–10)",
        "auth → body → own → rate → dedup → lock",
        "requireUserId→401, parseBody→400, assertOwnsProject→404/403, rate→429, dedup→409, lock→423 (skip if conversational), checkAiReady→503."
      ),
      n(
        "l1-mode",
        300,
        250,
        "Layer 1 — Next.js API Route",
        "sanitizeResolvedMode",
        "client vs DB truth",
        "Only explicit button clicks override DB. Stale-start + built-project regression guards. conversational always trusted."
      ),
      n(
        "l1-ask",
        0,
        400,
        "Layer 1 — Next.js API Route",
        "ask / plan",
        "runAskMode / runPlanningMode",
        "Inline engines — no ai_build_jobs. One LLM round per HTTP turn for ask."
      ),
      n(
        "l1-build",
        220,
        400,
        "Layer 1 — Next.js API Route",
        "build kickoff",
        "dispatchBuildTurn",
        "confirm_requirements / approve_plan → enqueue job + observeBuildJob (SSE only)."
      ),
      n(
        "l1-cont",
        440,
        400,
        "Layer 1 — Next.js API Route",
        "continue_building",
        "pushContinue",
        "Hatchet events.push(continue:<projectId>) + resume paused job."
      ),
      n(
        "l1-conv",
        660,
        400,
        "Layer 1 — Next.js API Route",
        "conversational",
        "classify + resolveExecution",
        "message-understanding.ts (Haiku) → execution-resolver.ts (toolMode, maxRounds, budgets, forceEditMode)."
      ),
    ],
    edges: [
      edge("l1e1", "l1-file", "l1-guards"),
      edge("l1e2", "l1-guards", "l1-mode"),
      edge("l1e3", "l1-mode", "l1-ask", "ask/plan"),
      edge("l1e4", "l1-mode", "l1-build", "confirm"),
      edge("l1e5", "l1-mode", "l1-cont", "continue"),
      edge("l1e6", "l1-mode", "l1-conv", "conversational"),
    ],
  },
  {
    id: "lld-layer-2",
    shortLabel: "L2",
    heading: "Layer 2 — Build Orchestrator Worker",
    title: "Build Orchestrator Worker",
    description:
      "Platform dispatchBuildTurn then worker.ts bootstrap + pool claim (FOR UPDATE SKIP LOCKED).",
    nodes: [
      n(
        "l2-dispatch",
        300,
        0,
        "Layer 2 — Build Orchestrator Worker",
        "dispatchBuildTurn",
        "dispatch.ts + orchestrator.ts",
        "Persist kickoff message (userMessagePersisted) → startOrResumeBuildJob (DEDUP one active job) → emit build_handoff → observeBuildJob."
      ),
      n(
        "l2-row",
        300,
        130,
        "Layer 2 — Build Orchestrator Worker",
        "ai_build_jobs",
        "status: queued",
        "checkpoint.runContext holds userMessage, workspaceId, creditSessionId, singleEdit?, hatchetRunId later."
      ),
      n(
        "l2-boot",
        80,
        270,
        "Layer 2 — Build Orchestrator Worker",
        "worker bootstrap",
        "worker.ts ordered startup",
        "secrets → execution plane → health sweep → DDL → setOceRuntimeFactory → PgJobStore → startHatchetWorker."
      ),
      n(
        "l2-pool",
        520,
        270,
        "Layer 2 — Build Orchestrator Worker",
        "BuildWorkerPool",
        "worker-pool.ts",
        "capacity BUILD_WORKER_CONCURRENCY (default 12, cap 16). fillBuildWorkerPool claims via SKIP LOCKED."
      ),
      n(
        "l2-run",
        300,
        400,
        "Layer 2 — Build Orchestrator Worker",
        "runJob → job-runner",
        "poll BUILD_WORKER_POLL_MS",
        "SIGTERM re-queues inFlightJobIds to queued so no build is lost."
      ),
    ],
    edges: [
      edge("l2e1", "l2-dispatch", "l2-row"),
      edge("l2e2", "l2-row", "l2-boot", "worker sees"),
      edge("l2e3", "l2-boot", "l2-pool"),
      edge("l2e4", "l2-pool", "l2-run"),
      edge("l2e5", "l2-row", "l2-pool", "claim"),
    ],
  },
  {
    id: "lld-layer-3",
    shortLabel: "L3",
    heading: "Layer 3 — Job Runner (per-job gate)",
    title: "Job Runner (per-job gate)",
    description:
      "processOneJob (lease lock) → executeBuildJob (claim → Hatchet or inline + durableEmit).",
    nodes: [
      n(
        "l3-wrap",
        300,
        0,
        "Layer 3 — Job Runner (per-job gate)",
        "processOneJob",
        "job-runner.ts lock wrapper",
        "Skip paused_user; cancel signal → cancelBuildJob; job_paused_credits → checkBuildCredits RESUME-gate only; acquireProjectLock heartbeat lease."
      ),
      n(
        "l3-exec",
        300,
        130,
        "Layer 3 — Job Runner (per-job gate)",
        "executeBuildJob",
        "claim → route → run",
        "claimQueuedBuildJob atomic. Fresh queued builds are NOT credit-gated at start."
      ),
      n(
        "l3-hat",
        40,
        280,
        "Layer 3 — Job Runner (per-job gate)",
        "Hatchet route",
        "checkpoint.hatchetRunId",
        "Idempotent if runId set; else clarify gate → edit-first fork or dispatchHatchetBuild."
      ),
      n(
        "l3-inl",
        560,
        280,
        "Layer 3 — Job Runner (per-job gate)",
        "Inline path",
        "MCP JWT + HarnessFacade",
        "createMcpCredential → runWithHarnessDecision (freeze flags) → HarnessFacade.runJobOrchestrator."
      ),
      n(
        "l3-emit",
        300,
        420,
        "Layer 3 — Job Runner (per-job gate)",
        "durableEmit",
        "+ failure-taxonomy.ts",
        "All events via durableEmit → Redis. Taxonomy classifies failures for pause vs abort."
      ),
    ],
    edges: [
      edge("l3e1", "l3-wrap", "l3-exec"),
      edge("l3e2", "l3-exec", "l3-hat", "HATCHET"),
      edge("l3e3", "l3-exec", "l3-inl", "inline"),
      edge("l3e4", "l3-hat", "l3-emit"),
      edge("l3e5", "l3-inl", "l3-emit"),
    ],
  },
  {
    id: "lld-layer-4",
    shortLabel: "L4",
    heading: "Layer 4 — Pipeline Router (HarnessFacade)",
    title: "Pipeline Router (HarnessFacade)",
    description:
      "harness-facade.ts + feature-flags.ts ALS freeze; Hatchet fork lives one level up in job-runner.",
    nodes: [
      n(
        "l4-ff",
        300,
        0,
        "Layer 4 — Pipeline Router (HarnessFacade)",
        "feature-flags.ts",
        "AsyncLocalStorage freeze",
        "Per-job flag snapshot so mid-build env changes cannot split a job across pipelines."
      ),
      n(
        "l4-facade",
        300,
        130,
        "Layer 4 — Pipeline Router (HarnessFacade)",
        "HarnessFacade.runJobOrchestrator",
        "harness-facade.ts",
        "Decision tree after flags are frozen."
      ),
      n(
        "l4-oce",
        40,
        280,
        "Layer 4 — Pipeline Router (HarnessFacade)",
        "OCE_ENABLED",
        "runOceStageDriver",
        "Newest non-Hatchet path (default-off in many envs)."
      ),
      n(
        "l4-v3",
        300,
        280,
        "Layer 4 — Pipeline Router (HarnessFacade)",
        "HARNESS_V3",
        "runCoordinatorOrchestrator",
        "Multi-wave LLM coordinator with V3 gates."
      ),
      n(
        "l4-leg",
        560,
        280,
        "Layer 4 — Pipeline Router (HarnessFacade)",
        "default legacy",
        "runBuildJobOrchestrator",
        "Legacy orchestrator when OCE and V3 flags are off."
      ),
    ],
    edges: [
      edge("l4e1", "l4-ff", "l4-facade"),
      edge("l4e2", "l4-facade", "l4-oce", "OCE"),
      edge("l4e3", "l4-facade", "l4-v3", "V3"),
      edge("l4e4", "l4-facade", "l4-leg", "legacy"),
    ],
  },
  {
    id: "lld-layer-5a",
    shortLabel: "L5A",
    heading: "Layer 5A — OCE Stage Driver (non-Hatchet path)",
    title: "OCE Stage Driver",
    description:
      "oce-stage-driver.ts: resolve AppSpec → INSERT root → runFleet with claim/handler/fan-out.",
    nodes: [
      n(
        "l5a-res",
        300,
        0,
        "Layer 5A — OCE Stage Driver (non-Hatchet path)",
        "resolve AppSpec",
        "DB snapshot + delta",
        "runOceStageDriver loads prior AppSpec and applies user-message delta before fleet run."
      ),
      n(
        "l5a-ins",
        300,
        120,
        "Layer 5A — OCE Stage Driver (non-Hatchet path)",
        "INSERT root job",
        'stage: "spec"',
        "PgJobStore root row; production handlers injected via setOceRuntimeFactory."
      ),
      n(
        "l5a-fleet",
        300,
        240,
        "Layer 5A — OCE Stage Driver (non-Hatchet path)",
        "runFleet()",
        "concurrency model",
        "Claims jobs, runs Handler (det|llm), writes via McpWorkspace, fans out children with pendingChildren barrier."
      ),
      n(
        "l5a-step",
        300,
        370,
        "Layer 5A — OCE Stage Driver (non-Hatchet path)",
        "pipeline/runner step()",
        "MAX_ATTEMPTS per stage",
        "fill≤3, others≤2, compile=1. Dead children still unblock parent (partial-progress tolerance)."
      ),
    ],
    edges: [
      edge("l5ae1", "l5a-res", "l5a-ins"),
      edge("l5ae2", "l5a-ins", "l5a-fleet"),
      edge("l5ae3", "l5a-fleet", "l5a-step"),
    ],
  },
  {
    id: "lld-layer-5b",
    shortLabel: "L5B",
    heading: "Layer 5B — Hatchet Durable Execution",
    title: "Hatchet Durable Execution",
    description:
      "oce-build workflow: only modules is durable; LLM/I/O must be runChild (memoized).",
    nodes: [
      n(
        "l5b-reg",
        300,
        0,
        "Layer 5B — Hatchet Durable Execution",
        "worker registration",
        "hatchet/worker.ts",
        "Registers oce-build + child workflows when HATCHET_ENABLED."
      ),
      n(
        "l5b-seq",
        300,
        120,
        "Layer 5B — Hatchet Durable Execution",
        "oce-build sequence",
        "scaffold→…→finalize",
        "scaffold resolves AppSpec then seeds files. compile uses runStageFull for fill spawn. Per-user maxRuns=2 GROUP_ROUND_ROBIN."
      ),
      n(
        "l5b-mod",
        80,
        270,
        "Layer 5B — Hatchet Durable Execution",
        "modules loop",
        "durable task",
        "runChild(moduleStep/scoped/verify); Promise.allSettled barriers (not bulkRunChildren)."
      ),
      n(
        "l5b-wait",
        520,
        270,
        "Layer 5B — Hatchet Durable Execution",
        "waitFor continue",
        "milestone pause",
        "Or(UserEventCondition continue:<projectId>, SleepCondition 10m auto-continue)."
      ),
      n(
        "l5b-bridge",
        300,
        400,
        "Layer 5B — Hatchet Durable Execution",
        "bridge.ts",
        "dispatch + pushContinue",
        "dispatchHatchetBuild stores hatchetRunId; pushContinue fires the continue event."
      ),
    ],
    edges: [
      edge("l5be1", "l5b-reg", "l5b-seq"),
      edge("l5be2", "l5b-seq", "l5b-mod"),
      edge("l5be3", "l5b-mod", "l5b-wait", "pause"),
      edge("l5be4", "l5b-bridge", "l5b-wait", "continue"),
      edge("l5be5", "l5b-seq", "l5b-bridge"),
    ],
  },
  {
    id: "lld-layer-6",
    shortLabel: "L6",
    heading: "Layer 6 — OCE Compiler Engine",
    title: "OCE Compiler Engine",
    description:
      "server/engine: AppSpec Zod → generators → assemble-by-anchors → reconcile; step() stage table.",
    nodes: [
      n(
        "l6-ir",
        300,
        0,
        "Layer 6 — OCE Compiler Engine",
        "app-spec.ts",
        "Zod + injection guards",
        "Identifier/RoutePath/Slug/Href validators. Archetypes seed AppClass (pure-frontend → fullstack-saas)."
      ),
      n(
        "l6-compile",
        80,
        140,
        "Layer 6 — OCE Compiler Engine",
        "compile.ts",
        "generators → Fragment[]",
        "schema/crud/page/form/auth/rbac/report/workflow/scaffold — pure, side-effect free."
      ),
      n(
        "l6-asm",
        300,
        140,
        "Layer 6 — OCE Compiler Engine",
        "assemble-by-anchors",
        "shared · exclusive · seed",
        "Seed fragments are LLM-owned across rebuilds (dropSeedMarker after fill/edit)."
      ),
      n(
        "l6-scopes",
        520,
        140,
        "Layer 6 — OCE Compiler Engine",
        "scopes.ts",
        "customScopes(spec)",
        "Fan-out units for LLM fill. reconcile.ts writes only changed files."
      ),
      n(
        "l6-step",
        300,
        280,
        "Layer 6 — OCE Compiler Engine",
        "pipeline/runner step()",
        "+ stage transition table",
        "Claim → handler role (det|llm) → workspace write → children → advance/retry per types.ts table."
      ),
    ],
    edges: [
      edge("l6e1", "l6-ir", "l6-compile"),
      edge("l6e2", "l6-compile", "l6-asm"),
      edge("l6e3", "l6-asm", "l6-scopes"),
      edge("l6e4", "l6-scopes", "l6-step"),
    ],
  },
  {
    id: "lld-layer-7",
    shortLabel: "L7",
    heading: "Layer 7 — Stage Handlers (production-runtime)",
    title: "Stage Handlers",
    description:
      "production-runtime.ts handler registry + hooks (credit/infra, cancel, heal exhausted).",
    nodes: [
      n(
        "l7-reg",
        360,
        0,
        "Layer 7 — Stage Handlers (production-runtime)",
        "OceRuntime factory",
        "PgJobStore + McpWorkspace",
        "Handlers: scaffold,spec,design,compile,module,fill,enrich,verify,heal,milestone,preview,production-gate."
      ),
      n(
        "l7-scaf",
        0,
        140,
        "Layer 7 — Stage Handlers (production-runtime)",
        "scaffold",
        "Neon + create_project",
        "ensureDatabaseProvisioned, tenantId, MCP workspace/create_project, brief.md + page stubs."
      ),
      n(
        "l7-spec",
        180,
        140,
        "Layer 7 — Stage Handlers (production-runtime)",
        "spec",
        "write_appspec ≤10 rounds",
        "runAgentTurn mode=spec → parseAppSpec Zod → persist builderContext.spec."
      ),
      n(
        "l7-des",
        360,
        140,
        "Layer 7 — Stage Handlers (production-runtime)",
        "design",
        "design.md ≤5 rounds",
        "Writes design tokens; captureOceSourceSnapshot dual-write to S3."
      ),
      n(
        "l7-cmp",
        540,
        140,
        "Layer 7 — Stage Handlers (production-runtime)",
        "compile",
        "reconcileFiles",
        "compile(spec,{design}) → hash reconcile → compiled-manifest.json + initBuildState."
      ),
      n(
        "l7-fill",
        180,
        290,
        "Layer 7 — Stage Handlers (production-runtime)",
        "fill / module",
        "runAgentTurn + V3",
        "Per-scope fill; module advances pendingModules; empty scopes → preview."
      ),
      n(
        "l7-ver",
        360,
        290,
        "Layer 7 — Stage Handlers (production-runtime)",
        "verify → heal",
        "tsc + smoke + gate",
        "MCP typecheck, behavioral smoke, route-collision resolve, production-gate elevate step."
      ),
      n(
        "l7-prev",
        540,
        290,
        "Layer 7 — Stage Handlers (production-runtime)",
        "preview",
        "startDevServer + DB smoke",
        "cold_start; fullstack /api/health SELECT 1 — disconnected DB is FATAL."
      ),
    ],
    edges: [
      edge("l7e1", "l7-reg", "l7-scaf"),
      edge("l7e2", "l7-scaf", "l7-spec"),
      edge("l7e3", "l7-spec", "l7-des"),
      edge("l7e4", "l7-des", "l7-cmp"),
      edge("l7e5", "l7-cmp", "l7-fill"),
      edge("l7e6", "l7-fill", "l7-ver"),
      edge("l7e7", "l7-ver", "l7-prev", "pass"),
      edge("l7e8", "l7-ver", "l7-fill", "heal"),
    ],
  },
  {
    id: "lld-layer-8",
    shortLabel: "L8",
    heading: "Layer 8 — MCP Server + Dev Worker",
    title: "MCP Server + Dev Worker",
    description:
      "mcp_server.py :8000 namespaces + JWT; dev_worker :8001; tsc_service :8002; instance-pool.",
    nodes: [
      n(
        "l8-mcp",
        300,
        0,
        "Layer 8 — MCP Server + Dev Worker",
        "mcp_server.py :8000",
        "FastAPI + FastMCP",
        "Namespaces workspace/codegen/build/devserver/quality/deploy/infra. Auth HS256 JWT userId+workspaceId+projectId."
      ),
      n(
        "l8-dev",
        40,
        160,
        "Layer 8 — MCP Server + Dev Worker",
        "dev_worker.py :8001",
        "SSD lifecycle",
        "Per-project process on /home/projects/{tenantId}/; /worker/capacity slots."
      ),
      n(
        "l8-tsc",
        300,
        160,
        "Layer 8 — MCP Server + Dev Worker",
        "tsc_service.js :8002",
        "warm WatchProgram",
        "POST /check {project_id} → {passed, errors[]} — avoids cold tsc on every verify."
      ),
      n(
        "l8-pool",
        560,
        160,
        "Layer 8 — MCP Server + Dev Worker",
        "execution-plane",
        "instance-pool.ts",
        "EC2/MCP endpoint pool, health sweep, placement fencing for PER."
      ),
    ],
    edges: [
      edge("l8e1", "l8-mcp", "l8-dev", "devserver"),
      edge("l8e2", "l8-mcp", "l8-tsc", "quality"),
      edge("l8e3", "l8-mcp", "l8-pool", "infra"),
    ],
  },
  {
    id: "lld-layer-9",
    shortLabel: "L9",
    heading: "Layer 9 — Data Layer (Full Schema)",
    title: "Data Layer (Full Schema)",
    description:
      "Drizzle schema.ts tables, Redis key classes, OCE PgJobStore (dedicated pool).",
    nodes: [
      n(
        "l9-pg",
        40,
        40,
        "Layer 9 — Data Layer (Full Schema)",
        "Postgres (Drizzle)",
        "schema.ts",
        "projects, ai_build_jobs, oce_jobs, project_execution (PER), credit_*, memory/episodic, knowledge_patterns, ai_generation_runs…"
      ),
      n(
        "l9-redis",
        300,
        40,
        "Layer 9 — Data Layer (Full Schema)",
        "Redis",
        "lock · SSE · progress",
        "Lease locks, XADD/XRANGE event streams (max ~500, 30m), BuildProgressState JSON, rate limits, MCP cache."
      ),
      n(
        "l9-oce",
        560,
        40,
        "Layer 9 — Data Layer (Full Schema)",
        "PgJobStore",
        "pipeline/pg-store.ts",
        "Dedicated pool (never shared Drizzle pool). oce_jobs claim/advance for stage driver."
      ),
      n(
        "l9-hat",
        300,
        200,
        "Layer 9 — Data Layer (Full Schema)",
        "Hatchet state",
        "durable memoization",
        "Workflow runs, child task results, concurrency groups — separate from Postgres job rows."
      ),
    ],
    edges: [
      edge("l9e1", "l9-pg", "l9-redis", "emit"),
      edge("l9e2", "l9-pg", "l9-oce", "OCE jobs"),
      edge("l9e3", "l9-pg", "l9-hat", "runs"),
    ],
  },
  {
    id: "lld-layer-10",
    shortLabel: "L10",
    heading: "Layer 10 — SSE Event System",
    title: "SSE Event System",
    description:
      "sse.ts event catalog → event-store.ts XADD → build-progress-store.ts JSON.",
    nodes: [
      n(
        "l10-types",
        300,
        0,
        "Layer 10 — SSE Event System",
        "sse.ts event types",
        "~44 types",
        "job_started, build_progress, ai_question (not clarification), milestone_pause, live_url, mode_change, done, error…"
      ),
      n(
        "l10-store",
        80,
        150,
        "Layer 10 — SSE Event System",
        "event-store.ts",
        "Redis Stream",
        "appendEvent XADD; getEventsSince XRANGE for reconnect replay."
      ),
      n(
        "l10-prog",
        520,
        150,
        "Layer 10 — SSE Event System",
        "build-progress-store",
        "BuildProgressState",
        "JSON snapshot 30m TTL — phase, pages, pause payloads. Not Postgres."
      ),
      n(
        "l10-out",
        300,
        300,
        "Layer 10 — SSE Event System",
        "durableEmit()",
        "append + update",
        "Every stage calls durableEmit(projectId,jobId)(event) → store + progress together."
      ),
    ],
    edges: [
      edge("l10e1", "l10-types", "l10-out"),
      edge("l10e2", "l10-out", "l10-store"),
      edge("l10e3", "l10-out", "l10-prog"),
    ],
  },
  {
    id: "lld-layer-11-publish",
    shortLabel: "L11 Pub",
    heading: "Layer 11 — Publish / Deploy (`server/project/publish-from-dev.ts`)",
    title: "Publish / Deploy",
    description:
      "publish-from-dev.ts status ladder: validating→syncing→building→deploying→live.",
    nodes: [
      n(
        "l11-click",
        300,
        0,
        "Layer 11 — Publish / Deploy (`server/project/publish-from-dev.ts`)",
        "Publish click",
        "preview_ready unlock",
        "Not automatic. Durable background worker survives refresh; streams over SSE."
      ),
      n(
        "l11-sync",
        40,
        140,
        "Layer 11 — Publish / Deploy (`server/project/publish-from-dev.ts`)",
        "syncing",
        "SSD → S3",
        "sync_project_to_aws → user-projects/{projectId}/ for CodeBuild input."
      ),
      n(
        "l11-cb",
        300,
        140,
        "Layer 11 — Publish / Deploy (`server/project/publish-from-dev.ts`)",
        "building",
        "CodeBuild → ECR",
        "onenexium-site-builder Docker standalone → ECR {tenantId}:{buildId}; poll % + errors[]."
      ),
      n(
        "l11-db",
        560,
        140,
        "Layer 11 — Publish / Deploy (`server/project/publish-from-dev.ts`)",
        "prod DB setup",
        "Neon + schema + seeds",
        "provision once → schema_push → seed_accounts; passwords emitted ONCE then stripped from durable log."
      ),
      n(
        "l11-live",
        300,
        290,
        "Layer 11 — Publish / Deploy (`server/project/publish-from-dev.ts`)",
        "deploying → live",
        "ECS + Traefik",
        "start_container, register_traefik_route, health probe → status=live, preview cleared."
      ),
    ],
    edges: [
      edge("l11e1", "l11-click", "l11-sync"),
      edge("l11e2", "l11-sync", "l11-cb"),
      edge("l11e3", "l11-cb", "l11-db"),
      edge("l11e4", "l11-db", "l11-live"),
    ],
  },
  {
    id: "lld-ask-mode",
    shortLabel: "Ask",
    heading: "Ask Mode — Pre-Build Requirements Gathering",
    title: "Ask Mode",
    description:
      "ask-mode.ts: one LLM round/HTTP turn, readiness rubric, 3-guard completion (85 floor).",
    nodes: [
      n(
        "ask-file",
        300,
        0,
        "Ask Mode — Pre-Build Requirements Gathering",
        "ask-mode.ts",
        "runAskMode(input)",
        "Invoked inline when resolvedMode ∈ {ask,asking}. Multi-round interview = successive POSTs."
      ),
      n(
        "ask-ctx",
        80,
        130,
        "Ask Mode — Pre-Build Requirements Gathering",
        "assembleAskContext",
        "profile · brand · template",
        "User profile, workspace brand, template, prompt specificity into asking-tier model."
      ),
      n(
        "ask-rubric",
        300,
        130,
        "Ask Mode — Pre-Build Requirements Gathering",
        "generateReadinessRubric",
        "first turn only",
        "Industry criteria[8–12] persisted on builderContext and reused every later turn."
      ),
      n(
        "ask-stream",
        520,
        130,
        "Ask Mode — Pre-Build Requirements Gathering",
        "stream LLM",
        "nexium-questions fence",
        "Emits ai_question LIVE. Optional [REQUIREMENTS_COMPLETE] marker is not trusted alone."
      ),
      n(
        "ask-gate",
        300,
        280,
        "Ask Mode — Pre-Build Requirements Gathering",
        "3-guard completion",
        "floor · cap · anti-strand",
        "A: score<85 veto. B: round≥MAX_ASK_ROUNDS(6) force-complete. C: anti-strand. → ask_complete."
      ),
    ],
    edges: [
      edge("aske1", "ask-file", "ask-ctx"),
      edge("aske2", "ask-file", "ask-rubric"),
      edge("aske3", "ask-rubric", "ask-stream"),
      edge("aske4", "ask-ctx", "ask-stream"),
      edge("aske5", "ask-stream", "ask-gate"),
    ],
  },
  {
    id: "lld-llm-client",
    shortLabel: "LLM",
    heading: "Universal LLM Client",
    title: "Universal LLM Client",
    description:
      "llm-client.ts: platform_settings → env → default; adapters expose Anthropic-shaped API.",
    nodes: [
      n(
        "llm-fac",
        300,
        0,
        "Universal LLM Client",
        "createLlmClientAsync",
        "llm-client.ts",
        "Single factory for spec, design, ask, fill, heal — zero caller changes on provider switch."
      ),
      n(
        "llm-prio",
        40,
        150,
        "Universal LLM Client",
        "Config priority",
        "DB → env → anthropic",
        "1) platform_settings AI Models panel 2) env vars 3) anthropic/direct default."
      ),
      n(
        "llm-prov",
        300,
        150,
        "Universal LLM Client",
        "Providers",
        "anthropic · openai · google · glm",
        "direct/vertex/bedrock variants where applicable; identical SDK surface to callers."
      ),
      n(
        "llm-tier",
        560,
        150,
        "Universal LLM Client",
        "Tiers + routing",
        "opus · sonnet · haiku",
        "model-routing.ts auto-select: first turn/complex→opus; short edit→haiku; default sonnet."
      ),
    ],
    edges: [
      edge("llme1", "llm-fac", "llm-prio"),
      edge("llme2", "llm-fac", "llm-prov"),
      edge("llme3", "llm-fac", "llm-tier"),
    ],
  },
  {
    id: "lld-v3-gates",
    shortLabel: "V3 Gates",
    heading: "Harness V3 Gates",
    title: "Harness V3 Gates",
    description:
      "harness-v3/gates: 10 gates across pre-tool / post-tool / post-response / pre-turn-end.",
    nodes: [
      n(
        "v3-dir",
        300,
        0,
        "Harness V3 Gates",
        "gates/",
        "HARNESS_V3=1",
        "Intercept every tool call inside runAgentTurn when flag is on."
      ),
      n(
        "v3-pre",
        40,
        140,
        "Harness V3 Gates",
        "pre-tool",
        "before MCP",
        "Validate/block unsafe or out-of-policy tool calls before execution."
      ),
      n(
        "v3-post",
        220,
        140,
        "Harness V3 Gates",
        "post-tool",
        "after MCP result",
        "Shape/validate tool results before they re-enter the agent loop."
      ),
      n(
        "v3-resp",
        400,
        140,
        "Harness V3 Gates",
        "post-response",
        "after LLM",
        "Checks model reply before continuing the round."
      ),
      n(
        "v3-end",
        580,
        140,
        "Harness V3 Gates",
        "pre-turn-end",
        "before exit",
        "Final gate before the agent turn ends."
      ),
    ],
    edges: [
      edge("v3e1", "v3-dir", "v3-pre"),
      edge("v3e2", "v3-pre", "v3-post"),
      edge("v3e3", "v3-post", "v3-resp"),
      edge("v3e4", "v3-resp", "v3-end"),
    ],
  },
  {
    id: "lld-skills",
    shortLabel: "L20",
    heading: "Layer 20 — Skill System",
    title: "Skill System",
    description:
      "skills/index.ts: trigger regex → instructions + requiredTools for THIS TURN only.",
    nodes: [
      n(
        "sk-idx",
        300,
        0,
        "Layer 20 — Skill System",
        "skills/index.ts",
        "SkillId catalog",
        "crud_api, auth_flow, form_builder, chart_widget, landing_page, …"
      ),
      n(
        "sk-trig",
        300,
        130,
        "Layer 20 — Skill System",
        "trigger match",
        "skill.triggers regex",
        "Activation: skill.triggers.some(rx => rx.test(userMessage))."
      ),
      n(
        "sk-ins",
        80,
        270,
        "Layer 20 — Skill System",
        "instructions",
        "append to system prompt",
        "Focused domain text for this turn only — avoids always-on 15–20K token waste."
      ),
      n(
        "sk-tools",
        520,
        270,
        "Layer 20 — Skill System",
        "requiredTools",
        "toolset merge",
        "skill.requiredTools added to available tools for this turn only."
      ),
    ],
    edges: [
      edge("ske1", "sk-idx", "sk-trig"),
      edge("ske2", "sk-trig", "sk-ins"),
      edge("ske3", "sk-trig", "sk-tools"),
    ],
  },
  {
    id: "lld-aws",
    shortLabel: "L21",
    heading: "Layer 21 — AWS Infrastructure Layer",
    title: "AWS Infrastructure",
    description:
      "project_secrets metadata in PG; values in Secrets Manager. S3 user-projects + assets.",
    nodes: [
      n(
        "aws-sec",
        80,
        40,
        "Layer 21 — AWS Infrastructure Layer",
        "Secrets Manager",
        "project + platform",
        "Values at {AWS_PROJECT_SECRETS_PREFIX}/{projectId}/{key}. Platform secrets loaded at worker bootstrap."
      ),
      n(
        "aws-s3",
        300,
        40,
        "Layer 21 — AWS Infrastructure Layer",
        "S3 (s3.ts)",
        "user-projects/",
        "Source for CodeBuild, assets/, workspace-templates/ preview images."
      ),
      n(
        "aws-meta",
        520,
        40,
        "Layer 21 — AWS Infrastructure Layer",
        "project_secrets table",
        "metadata only",
        "Key names + scope in Postgres — secret values never stored in PG."
      ),
    ],
    edges: [
      edge("awse1", "aws-meta", "aws-sec", "values"),
      edge("awse2", "aws-s3", "aws-sec"),
    ],
  },
  {
    id: "lld-follow-up",
    shortLabel: "Follow-up",
    heading: "Follow-up Flow — a message on an already-built project",
    title: "Follow-up Flow",
    description:
      "Three stages: route resolution → worker gates → singleEdit vs growAppSpec Hatchet build.",
    nodes: [
      n(
        "fu-s1",
        300,
        0,
        "Follow-up Flow — a message on an already-built project",
        "Stage 1 — route",
        "chat route resolution",
        "Built project turns resolve to conversational / continue / confirm paths; never re-open ask by stale cache."
      ),
      n(
        "fu-s2",
        300,
        130,
        "Follow-up Flow — a message on an already-built project",
        "Stage 2 — gates",
        "executeBuildJob Hatchet path",
        "Pre-dispatch: clarify gate, edit-first fork detection, forceEditMode pin."
      ),
      n(
        "fu-edit",
        80,
        280,
        "Follow-up Flow — a message on an already-built project",
        "Stage 3A — singleEdit",
        "inline edit agent",
        "Confirmed all-edit ops stay in-process — clean toolset read+apply_diff, no full growth job."
      ),
      n(
        "fu-grow",
        520,
        280,
        "Follow-up Flow — a message on an already-built project",
        "Stage 3B — growth",
        "dispatchHatchetBuild",
        "scaffold resolveAppSpec → growAppSpec from prior appspec.prev.json → OCE rebuild."
      ),
    ],
    edges: [
      edge("fue1", "fu-s1", "fu-s2"),
      edge("fue2", "fu-s2", "fu-edit", "edit"),
      edge("fue3", "fu-s2", "fu-grow", "growth"),
    ],
  },
  {
    id: "lld-lock",
    shortLabel: "Lock",
    heading: "Cross-Cutting: Distributed Lock",
    title: "Distributed Lock",
    description:
      "distributed-lock.ts: heartbeat lease (LOCK_LEASE_TTL_MS / RENEW_MS), not a fixed dead TTL.",
    nodes: [
      n(
        "lk-acq",
        300,
        0,
        "Cross-Cutting: Distributed Lock",
        "acquireProjectLock",
        "ttlMs + waitMs",
        "Route: ttl 180s wait 8s → 423 PROJECT_BUSY. Job runner: lease renew; active job waitMs=0."
      ),
      n(
        "lk-renew",
        300,
        140,
        "Cross-Cutting: Distributed Lock",
        "Heartbeat renew",
        "LOCK_LEASE_RENEW_MS",
        "Lease refreshed while work runs so holders are not evicted mid-build."
      ),
      n(
        "lk-skip",
        80,
        280,
        "Cross-Cutting: Distributed Lock",
        "conversational SKIP",
        "fake acquired lock",
        "Q&A must not block on a running build — lock acquisition skipped."
      ),
      n(
        "lk-rel",
        520,
        280,
        "Cross-Cutting: Distributed Lock",
        "release",
        "end of turn / job",
        "Build-kickoff releases after handoff to worker; observe continues over SSE."
      ),
    ],
    edges: [
      edge("lke1", "lk-acq", "lk-renew"),
      edge("lke2", "lk-acq", "lk-skip", "conversational"),
      edge("lke3", "lk-renew", "lk-rel"),
    ],
  },
  {
    id: "lld-billing",
    shortLabel: "Billing",
    heading: "Cross-Cutting: Billing / Credit Engine",
    title: "Billing / Credit Engine",
    description:
      "reserve → stream meter → ledger settle; gateways + session-sweep. Credits size budget.",
    nodes: [
      n(
        "bill-res",
        40,
        40,
        "Cross-Cutting: Billing / Credit Engine",
        "reserveForChat",
        "route non-blocking",
        "insufficient_funds still proceeds on default budget — hard gate is resume-only in worker."
      ),
      n(
        "bill-meter",
        240,
        40,
        "Cross-Cutting: Billing / Credit Engine",
        "ai-stream-meter",
        "token usage",
        "Meters LLM stream tokens against the reservation during the turn."
      ),
      n(
        "bill-led",
        440,
        40,
        "Cross-Cutting: Billing / Credit Engine",
        "ledger.ts",
        "commit / release",
        "Settles spend; mid-build insufficiency → job_paused_credits (BuildBlockedCard)."
      ),
      n(
        "bill-gw",
        640,
        40,
        "Cross-Cutting: Billing / Credit Engine",
        "gateway-router",
        "+ session-sweep",
        "Payment gateways + periodic session sweep for stale reservations."
      ),
    ],
    edges: [
      edge("bille1", "bill-res", "bill-meter"),
      edge("bille2", "bill-meter", "bill-led"),
      edge("bille3", "bill-led", "bill-gw"),
    ],
  },
  {
    id: "lld-clarify",
    shortLabel: "Clarify",
    heading: "Clarification Gate (C1) — Mid-Build Confidence Pause",
    title: "Clarification Gate (C1)",
    description:
      "clarification.ts: pause when spec confidence low; resume via clarification_answer.",
    nodes: [
      n(
        "c1-file",
        300,
        0,
        "Clarification Gate (C1) — Mid-Build Confidence Pause",
        "clarification.ts",
        "build-jobs/",
        "C1 gate during / after spec interpretation."
      ),
      n(
        "c1-conf",
        300,
        120,
        "Clarification Gate (C1) — Mid-Build Confidence Pause",
        "confidence check",
        "threshold (~90)",
        "Low confidence → pause rather than guessing structural AppSpec."
      ),
      n(
        "c1-pause",
        300,
        240,
        "Clarification Gate (C1) — Mid-Build Confidence Pause",
        "SSE pause + question",
        "pendingClarification",
        "Persisted in BuildProgressState for reconnect; UI QuestionCard."
      ),
      n(
        "c1-ans",
        300,
        360,
        "Clarification Gate (C1) — Mid-Build Confidence Pause",
        "clarification_answer",
        "resume build",
        "Answer returns through chat mode and resumes durable/inline path."
      ),
    ],
    edges: [
      edge("c1e1", "c1-file", "c1-conf"),
      edge("c1e2", "c1-conf", "c1-pause"),
      edge("c1e3", "c1-pause", "c1-ans"),
    ],
  },
  {
    id: "lld-context",
    shortLabel: "L11 Ctx",
    heading: "Layer 11 — Context Assembly (per LLM turn)",
    title: "Context Assembly",
    description:
      "context.ts + context-budget + between-turn-compressor + knowledge-selector (EKS).",
    nodes: [
      n(
        "ctx-main",
        300,
        0,
        "Layer 11 — Context Assembly (per LLM turn)",
        "context.ts",
        "assemble per turn",
        "Builds prompt package from project brief, memory, prior messages, tool results."
      ),
      n(
        "ctx-bud",
        40,
        150,
        "Layer 11 — Context Assembly (per LLM turn)",
        "context-budget.ts",
        "token ceilings",
        "Enforces model context limits before the LLM call."
      ),
      n(
        "ctx-comp",
        300,
        150,
        "Layer 11 — Context Assembly (per LLM turn)",
        "between-turn-compressor",
        "history shrink",
        "Compresses prior turns when approaching budget."
      ),
      n(
        "ctx-eks",
        560,
        150,
        "Layer 11 — Context Assembly (per LLM turn)",
        "knowledge-selector",
        "EKS patterns",
        "Injects curated knowledge_patterns relevant to this turn."
      ),
    ],
    edges: [
      edge("ctxe1", "ctx-main", "ctx-bud"),
      edge("ctxe2", "ctx-main", "ctx-comp"),
      edge("ctxe3", "ctx-main", "ctx-eks"),
    ],
  },
  {
    id: "lld-agent-turn",
    shortLabel: "L12",
    heading: "Layer 12 — Agent Turn Internals",
    title: "Agent Turn Internals",
    description:
      "agent-turn/: tool-exec-policy, loop-guards, system-prompt-augment (+ shaping/pairing).",
    nodes: [
      n(
        "at-pol",
        40,
        40,
        "Layer 12 — Agent Turn Internals",
        "tool-exec-policy.ts",
        "allowed tools",
        "Restricts MCP tools available for this ExecutionConfig / mode."
      ),
      n(
        "at-loop",
        240,
        40,
        "Layer 12 — Agent Turn Internals",
        "loop-guards.ts",
        "anti-spin",
        "Stops repeated identical tool calls and runaway round counts."
      ),
      n(
        "at-safe",
        440,
        40,
        "Layer 12 — Agent Turn Internals",
        "system-prompt-augment",
        "safety rules",
        "Injects safety constraints into the agent system prompt."
      ),
      n(
        "at-shape",
        640,
        40,
        "Layer 12 — Agent Turn Internals",
        "shaping + pairing",
        "tool-result / repair",
        "trimToolResult, evictOldToolResults, repairToolPairing for Hatchet replay safety."
      ),
    ],
    edges: [
      edge("ate1", "at-pol", "at-loop"),
      edge("ate2", "at-loop", "at-safe"),
      edge("ate3", "at-safe", "at-shape"),
    ],
  },
  {
    id: "lld-builder-mode",
    shortLabel: "L15",
    heading: "Layer 15 — Builder Mode State Machine (Full)",
    title: "Builder Mode State Machine",
    description:
      "builder-state-machine.ts: legal transitions only; stale client cannot force ask/build.",
    nodes: [
      n(
        "bm-ask",
        0,
        40,
        "Layer 15 — Builder Mode State Machine (Full)",
        "asking",
        "Ask Mode",
        "Q&A rounds; forceBuilderMode(asking) while incomplete."
      ),
      n(
        "bm-ac",
        160,
        40,
        "Layer 15 — Builder Mode State Machine (Full)",
        "ask_complete",
        "reqs persisted",
        "transitionBuilderMode after 3-guard completion — not plan_complete."
      ),
      n(
        "bm-plan",
        320,
        40,
        "Layer 15 — Builder Mode State Machine (Full)",
        "planning / plan_complete",
        "blueprint",
        "Planning engine then ready for approve_plan / confirm_requirements."
      ),
      n(
        "bm-build",
        500,
        40,
        "Layer 15 — Builder Mode State Machine (Full)",
        "building",
        "job running",
        "OCE/Hatchet job active; clarification can pause and resume here."
      ),
      n(
        "bm-done",
        680,
        40,
        "Layer 15 — Builder Mode State Machine (Full)",
        "done / error",
        "terminal-ish",
        "preview_ready/done; follow-up re-enters building. error is terminal failure."
      ),
    ],
    edges: [
      edge("bme1", "bm-ask", "bm-ac"),
      edge("bme2", "bm-ac", "bm-plan"),
      edge("bme3", "bm-plan", "bm-build"),
      edge("bme4", "bm-build", "bm-done"),
      edge("bme5", "bm-done", "bm-build", "follow-up"),
    ],
  },
  {
    id: "lld-memory-xcut",
    shortLabel: "Memory",
    heading: "Cross-Cutting: Memory System",
    title: "Memory System",
    description:
      "project_memory_facts + episodic (pgvector) + fileManifest — extracted after each agent turn.",
    nodes: [
      n(
        "mem-ext",
        300,
        0,
        "Cross-Cutting: Memory System",
        "memory-extractor.ts",
        "after runAgentTurn",
        "Categories: decision|error_fix|entity|pattern|constraint. importance 0–1, isActive when not superseded."
      ),
      n(
        "mem-facts",
        40,
        150,
        "Cross-Cutting: Memory System",
        "project_memory_facts",
        "top 30 by importance",
        "Retrieved into LLM context ORDER BY importance DESC, lastUsedAt DESC LIMIT 30."
      ),
      n(
        "mem-epi",
        300,
        150,
        "Cross-Cutting: Memory System",
        "ai_episodic_memory",
        "project | global",
        "failure/success/performance patterns. ≥3 projects same lesson → scope global (poisoning-guarded)."
      ),
      n(
        "mem-man",
        560,
        150,
        "Cross-Cutting: Memory System",
        "fileManifest",
        "component-manifest.ts",
        "exports/imports map updated after fill — agent knows APIs without reading every file."
      ),
    ],
    edges: [
      edge("meme1", "mem-ext", "mem-facts"),
      edge("meme2", "mem-ext", "mem-epi"),
      edge("meme3", "mem-ext", "mem-man"),
    ],
  },
  {
    id: "lld-obs",
    shortLabel: "Obs",
    heading: "Cross-Cutting: Observability",
    title: "Observability",
    description:
      "ai_generation_runs per turn + optional Langfuse traces + build/harness event sinks.",
    nodes: [
      n(
        "obs-run",
        300,
        0,
        "Cross-Cutting: Observability",
        "ai_generation_runs",
        "per-turn record",
        "model, tokens, costCents, toolCallsJson, tokenBreakdown, budgetTrace, status ladder."
      ),
      n(
        "obs-lf",
        80,
        150,
        "Cross-Cutting: Observability",
        "Langfuse",
        "langfuse.ts",
        "If LANGFUSE_* set: trace per runAgentTurn, spans per tool; traceId on generation run."
      ),
      n(
        "obs-be",
        300,
        150,
        "Cross-Cutting: Observability",
        "build-events.ts",
        "emitBuildEvent",
        "Structured log sink for dashboard build phases."
      ),
      n(
        "obs-he",
        520,
        150,
        "Cross-Cutting: Observability",
        "harness-events.ts",
        "emitHarnessEvent",
        "Pipeline-phase timing events for harness observability."
      ),
    ],
    edges: [
      edge("obse1", "obs-run", "obs-lf"),
      edge("obse2", "obs-run", "obs-be"),
      edge("obse3", "obs-run", "obs-he"),
    ],
  },
  {
    id: "lld-config",
    shortLabel: "Config",
    heading: "Configuration Reference (env vars)",
    title: "Configuration (env vars)",
    description:
      "Pipeline flags and worker knobs: OCE / V3 / Hatchet, concurrency, heartbeats, credits.",
    nodes: [
      n(
        "cfg-pipe",
        80,
        40,
        "Configuration Reference (env vars)",
        "Pipeline flags",
        "OCE · V3 · Hatchet",
        "OCE_ENABLED, HARNESS_V3, HATCHET_ENABLED — pick execution plane."
      ),
      n(
        "cfg-hat",
        300,
        40,
        "Configuration Reference (env vars)",
        "Hatchet caps",
        "user / fleet / timeout",
        "HATCHET_USER_MAX_RUNS=2, WORKER_SLOTS=40, MILESTONE_CONTINUE_TIMEOUT=10m."
      ),
      n(
        "cfg-wrk",
        520,
        40,
        "Configuration Reference (env vars)",
        "Worker knobs",
        "poll · heartbeat · retries",
        "BUILDS_WORKER_CONCURRENCY, POLL_MS, HEARTBEAT_MS, STALE_MS, TRANSIENT/REPAIR retries, MIN_VIABLE_CREDITS."
      ),
    ],
    edges: [
      edge("cfge1", "cfg-pipe", "cfg-hat"),
      edge("cfge2", "cfg-hat", "cfg-wrk"),
    ],
  },
  {
    id: "lld-dual-write",
    shortLabel: "L13",
    heading: "Layer 13 — Memory Dual-Write",
    title: "Memory Dual-Write",
    description:
      "memory-dual-write.ts: MCP disk primary + builderContext.memorySnapshot secondary + retry queue.",
    nodes: [
      n(
        "dw-mcp",
        80,
        40,
        "Layer 13 — Memory Dual-Write",
        "Primary: MCP disk",
        ".onenexium/*",
        "write_file → /home/projects/{tenantId}/.onenexium/* (brief, appspec, design, …)."
      ),
      n(
        "dw-pg",
        300,
        40,
        "Layer 13 — Memory Dual-Write",
        "Secondary: Postgres",
        "memorySnapshot",
        "projects.builderContext.memorySnapshot holds brief/spec/design/appspec/sourceSnapshot for EC2 loss."
      ),
      n(
        "dw-retry",
        520,
        40,
        "Layer 13 — Memory Dual-Write",
        "Retry queue",
        "3× / 500ms",
        "Failed dual-writes queued; clearPendingWritesForProject at job start; captureOceSourceSnapshot after compile."
      ),
    ],
    edges: [
      edge("dwe1", "dw-mcp", "dw-pg", "dual"),
      edge("dwe2", "dw-pg", "dw-retry", "fail"),
    ],
  },
  {
    id: "lld-s3-sync",
    shortLabel: "L14",
    heading: "Layer 14 — S3 Sync Before Production Build",
    title: "S3 Sync Before Build",
    description:
      "sync-project-to-s3.ts must run before trigger_build — CodeBuild reads S3, not SSD.",
    nodes: [
      n(
        "s3-ssd",
        80,
        40,
        "Layer 14 — S3 Sync Before Production Build",
        "Dev worker SSD",
        "/home/projects/{tenantId}",
        "Live project tree on the assigned worker instance."
      ),
      n(
        "s3-sync",
        300,
        40,
        "Layer 14 — S3 Sync Before Production Build",
        "sync_project_to_aws",
        "timeout 180s",
        "syncProjectToAwsBeforeBuild → MCP rsync/aws s3 sync. Without it CodeBuild sees empty/stale tree."
      ),
      n(
        "s3-bucket",
        520,
        40,
        "Layer 14 — S3 Sync Before Production Build",
        "S3 user-projects/",
        "CodeBuild source",
        "s3://…/user-projects/{projectId}/ becomes trigger_build input."
      ),
    ],
    edges: [
      edge("s3e1", "s3-ssd", "s3-sync"),
      edge("s3e2", "s3-sync", "s3-bucket"),
    ],
  },
  {
    id: "lld-billing-int",
    shortLabel: "L16",
    heading: "Layer 16 — Billing Internals",
    title: "Billing Internals",
    description:
      "ledger invariants + stream meter settle + gateway-router + session-sweep.",
    nodes: [
      n(
        "bi-led",
        40,
        40,
        "Layer 16 — Billing Internals",
        "ledger.ts",
        "4 hard invariants",
        "Idempotent key, never-negative balance, append-only rows, balance == SUM(active tokens)."
      ),
      n(
        "bi-meter",
        240,
        40,
        "Layer 16 — Billing Internals",
        "ai-stream-meter",
        "settleSession txn",
        "Every ~100 tokens update session; end → usage token + balance/reserve in ONE SQL txn."
      ),
      n(
        "bi-gw",
        440,
        40,
        "Layer 16 — Billing Internals",
        "gateway-router",
        "stripe · razorpay · cashfree",
        "selectGateway by preferred/country; payment_orders idempotency before redirect."
      ),
      n(
        "bi-sweep",
        640,
        40,
        "Layer 16 — Billing Internals",
        "session-sweep",
        "expire stuck reserves",
        "Active sessions past expires_at → expired + release reservedCredits (no usage row)."
      ),
    ],
    edges: [
      edge("bie1", "bi-led", "bi-meter"),
      edge("bie2", "bi-meter", "bi-gw"),
      edge("bie3", "bi-gw", "bi-sweep"),
    ],
  },
  {
    id: "lld-vector",
    shortLabel: "L17",
    heading: "Layer 17 — Vector Search / Embeddings (T6)",
    title: "Vector Search / Embeddings",
    description:
      "vector-search.ts + embeddings.ts — pgvector with mandatory embedding_dim filter.",
    nodes: [
      n(
        "vec-emb",
        300,
        0,
        "Layer 17 — Vector Search / Embeddings (T6)",
        "embedForStorage",
        "embeddings.ts",
        "Vertex 768d / OpenAI 1536d / large 3072d from platform_settings — same admin panel as LLM."
      ),
      n(
        "vec-q",
        80,
        150,
        "Layer 17 — Vector Search / Embeddings (T6)",
        "pgvector query",
        "<=> cosine",
        "WHERE embedding_dim = $currentModelDim ORDER BY embedding <=> $queryVec. Cross-dim throws."
      ),
      n(
        "vec-tbl",
        520,
        150,
        "Layer 17 — Vector Search / Embeddings (T6)",
        "Tables",
        "episodic + knowledge",
        "ai_episodic_memory + knowledge_patterns. Retriever returns null → tag/count fallback."
      ),
    ],
    edges: [
      edge("vece1", "vec-emb", "vec-q"),
      edge("vece2", "vec-emb", "vec-tbl"),
    ],
  },
  {
    id: "lld-deploy-pipe",
    shortLabel: "L18",
    heading: "Layer 18 — Deployment Pipeline (trigger_build → live)",
    title: "Deployment Pipeline",
    description:
      "build_tools.py trigger_build → CodeBuild → ECR → ECS/Traefik → live_url SSE.",
    nodes: [
      n(
        "dp-trig",
        300,
        0,
        "Layer 18 — Deployment Pipeline (trigger_build → live)",
        "trigger_build",
        "build_tools.py",
        "Requires prior S3 sync. start_build onenexium-site-builder; poll + CloudWatch logs on failure."
      ),
      n(
        "dp-ecr",
        80,
        150,
        "Layer 18 — Deployment Pipeline (trigger_build → live)",
        "ECR image",
        "{tenantId}:{buildId}",
        "Docker standalone pushed on CodeBuild SUCCEEDED."
      ),
      n(
        "dp-ecs",
        300,
        150,
        "Layer 18 — Deployment Pipeline (trigger_build → live)",
        "ECS + Traefik",
        "deploy/ namespace",
        "start_container / promote_preview_to_live / register_traefik_route / custom domain + ACM."
      ),
      n(
        "dp-live",
        520,
        150,
        "Layer 18 — Deployment Pipeline (trigger_build → live)",
        "live_url event",
        "productionUrl",
        "Update projects.productionUrl + liveBuildJobId; durableEmit → LiveUrlCard."
      ),
    ],
    edges: [
      edge("dpe1", "dp-trig", "dp-ecr"),
      edge("dpe2", "dp-ecr", "dp-ecs"),
      edge("dpe3", "dp-ecs", "dp-live"),
    ],
  },
  {
    id: "lld-seams",
    shortLabel: "L19",
    heading: "Layer 19 — Agent Turn: Remaining Seams",
    title: "Agent Turn Remaining Seams",
    description:
      "tool-result-shaping, tool-pairing repair, page-progress → build_progress SSE.",
    nodes: [
      n(
        "seam-shape",
        80,
        40,
        "Layer 19 — Agent Turn: Remaining Seams",
        "tool-result-shaping",
        "trim + evict",
        "trimToolResult; evictOldToolResults when >160K — keep last 2 rounds intact."
      ),
      n(
        "seam-pair",
        300,
        40,
        "Layer 19 — Agent Turn: Remaining Seams",
        "tool-pairing.ts",
        "repairToolPairing",
        "Inserts synthetic tool_result for orphaned tool_use after Hatchet replay/compaction."
      ),
      n(
        "seam-page",
        520,
        40,
        "Layer 19 — Agent Turn: Remaining Seams",
        "page-progress.ts",
        "build_progress SSE",
        "Maps written files → routes; deriveBuildPhase; pagesCompleted[] / pagesRemaining[]."
      ),
    ],
    edges: [
      edge("seame1", "seam-shape", "seam-pair"),
      edge("seame2", "seam-pair", "seam-page"),
    ],
  },
  {
    id: "lld-routing",
    shortLabel: "Routing",
    heading: "Model Routing",
    title: "Model Routing",
    description:
      "model-routing.ts + ai-config.ts: opus/sonnet/haiku tiers from signals + platform_settings.",
    nodes: [
      n(
        "rt-sig",
        300,
        0,
        "Model Routing",
        "Message signals",
        "length · keywords",
        "First turn / architect-refactor → opus; short one-liner edit → haiku; default sonnet."
      ),
      n(
        "rt-map",
        80,
        150,
        "Model Routing",
        "Tier map",
        "ai-config.ts",
        "Admin-configurable mapping of opus/sonnet/haiku → concrete model ids."
      ),
      n(
        "rt-call",
        520,
        150,
        "Model Routing",
        "createLlmClientAsync",
        "selected model",
        "Router picks tier; factory binds provider adapter for the call."
      ),
    ],
    edges: [
      edge("rte1", "rt-sig", "rt-map"),
      edge("rte2", "rt-map", "rt-call"),
    ],
  },
  {
    id: "lld-arch",
    shortLabel: "Archetypes",
    heading: "AppSpec Archetypes",
    title: "AppSpec Archetypes",
    description:
      "archetypes/index.ts: landing/portfolio/saas/lob/marketplace seeds + AppClass.",
    nodes: [
      n(
        "ar-seed",
        300,
        0,
        "AppSpec Archetypes",
        "Archetype seeds",
        "partial AppSpec",
        "landing, portfolio, saas-basic, lob-crud, marketplace — structural starting points."
      ),
      n(
        "ar-class",
        80,
        150,
        "AppSpec Archetypes",
        "AppClass",
        "tier of app",
        "pure-frontend | frontend-light-backend | fullstack-lob | fullstack-saas."
      ),
      n(
        "ar-out",
        520,
        150,
        "AppSpec Archetypes",
        "Into compile",
        "generators subset",
        "Class/tier decides which generators (auth, CRUD, schema) run."
      ),
    ],
    edges: [
      edge("are1", "ar-seed", "ar-class"),
      edge("are2", "ar-class", "ar-out"),
    ],
  },
  {
    id: "lld-spec-int",
    shortLabel: "Spec Int",
    heading: "Spec Interpreter — LLM → AppSpec",
    title: "Spec Interpreter",
    description:
      "spec-interpreter.ts: LLM → sanitize → Zod parse → validate/repair → confidence gate.",
    nodes: [
      n(
        "si-llm",
        300,
        0,
        "Spec Interpreter — LLM → AppSpec",
        "LLM interpret",
        "spec-interpreter.ts",
        "Targeted call produces AppSpec JSON (+ _confidence, _clarifications)."
      ),
      n(
        "si-san",
        80,
        150,
        "Spec Interpreter — LLM → AppSpec",
        "sanitize + Zod",
        "parseAppSpec",
        "Injection sanitization then Zod schema validation."
      ),
      n(
        "si-fix",
        300,
        150,
        "Spec Interpreter — LLM → AppSpec",
        "validate / repair",
        "auto-fix pass",
        "Structural repairs when possible before persisting."
      ),
      n(
        "si-gate",
        520,
        150,
        "Spec Interpreter — LLM → AppSpec",
        "confidence gate",
        "C1 pause",
        "Low confidence → clarification pause rather than bad skeleton."
      ),
    ],
    edges: [
      edge("sie1", "si-llm", "si-san"),
      edge("sie2", "si-san", "si-fix"),
      edge("sie3", "si-fix", "si-gate"),
    ],
  },
  {
    id: "lld-compactor",
    shortLabel: "Compact",
    heading: "Context Compactor",
    title: "Context Compactor",
    description:
      "context-compactor.ts shrinks conversation/tool history when approaching model limits.",
    nodes: [
      n(
        "cc-in",
        300,
        0,
        "Context Compactor",
        "Oversized context",
        "approaching limit",
        "Triggered when assembled prompt nears model window."
      ),
      n(
        "cc-run",
        300,
        140,
        "Context Compactor",
        "context-compactor.ts",
        "summarize / drop",
        "Compacts older rounds while preserving recent tool results and critical brief/spec."
      ),
      n(
        "cc-out",
        300,
        280,
        "Context Compactor",
        "Fit for LLM call",
        "budgetTrace metrics",
        "Records truncation/escalation metrics onto generation run observability."
      ),
    ],
    edges: [
      edge("cce1", "cc-in", "cc-run"),
      edge("cce2", "cc-run", "cc-out"),
    ],
  },
  {
    id: "lld-per",
    shortLabel: "PER",
    heading: "Execution Phase Machine",
    title: "Execution Phase Machine (PER)",
    description:
      "phase-machine.ts + per.ts: project_execution is sole lifecycle authority + fencing token.",
    nodes: [
      n(
        "per-rec",
        300,
        0,
        "Execution Phase Machine",
        "project_execution",
        "PER row",
        "Single authority for phase, worker IP, placementEpoch fencing — actors never recompute phase."
      ),
      n(
        "per-ph",
        80,
        150,
        "Execution Phase Machine",
        "Active phases",
        "created→preview",
        "created → placed → scaffolded → provisioned → building → verified → preview."
      ),
      n(
        "per-term",
        300,
        150,
        "Execution Phase Machine",
        "Terminal / paused",
        "blocked · failed · …",
        "blocked|failed|cancelled; paused_infra|paused_credits recoverable."
      ),
      n(
        "per-guard",
        520,
        150,
        "Execution Phase Machine",
        "Precondition guards",
        "pure functions",
        "Illegal transitions refused before work starts; epoch bumps on reassignment."
      ),
    ],
    edges: [
      edge("pere1", "per-rec", "per-ph"),
      edge("pere2", "per-rec", "per-term"),
      edge("pere3", "per-ph", "per-guard"),
    ],
  },
  {
    id: "lld-build-state",
    shortLabel: "BuildState",
    heading: "Build State — Job-Scoped Operational Memory",
    title: "Build State",
    description:
      "harness-v3/memory/build-state.ts tracks completed/pending modules during OCE fill.",
    nodes: [
      n(
        "bs-init",
        300,
        0,
        "Build State — Job-Scoped Operational Memory",
        "initBuildState",
        "from spec.pages",
        "Seeded after compile with planned pages/modules."
      ),
      n(
        "bs-pend",
        80,
        150,
        "Build State — Job-Scoped Operational Memory",
        "pendingModules[]",
        "module handler",
        "Next module popped for scoped fill fan-out."
      ),
      n(
        "bs-done",
        520,
        150,
        "Build State — Job-Scoped Operational Memory",
        "completedModules[]",
        "advance",
        "Empty pending → advanceTo preview. Persisted for durable resume."
      ),
    ],
    edges: [
      edge("bse1", "bs-init", "bs-pend"),
      edge("bse2", "bs-pend", "bs-done"),
    ],
  },
  {
    id: "lld-brief",
    shortLabel: "Brief",
    heading: "Brief Composer — Rich Context Assembly",
    title: "Brief Composer",
    description:
      "brief-composer.ts writes .onenexium/brief.md from request + Q&A + plan + data model.",
    nodes: [
      n(
        "br-src",
        300,
        0,
        "Brief Composer — Rich Context Assembly",
        "Inputs",
        "request · Q&A · plan",
        "User prompt, ask-mode requirements, planning blueprint, inferred data model."
      ),
      n(
        "br-comp",
        300,
        140,
        "Brief Composer — Rich Context Assembly",
        "brief-composer.ts",
        "compose",
        "Assembles rich project context document for later LLM stages."
      ),
      n(
        "br-out",
        300,
        280,
        "Brief Composer — Rich Context Assembly",
        ".onenexium/brief.md",
        "+ memorySnapshot",
        "Written to workspace and dual-written into builderContext for DR."
      ),
    ],
    edges: [
      edge("bre1", "br-src", "br-comp"),
      edge("bre2", "br-comp", "br-out"),
    ],
  },
  {
    id: "lld-design-agent",
    shortLabel: "Design",
    heading: "Design Agent",
    title: "Design Agent",
    description:
      "design-agent.ts: targeted LLM → design.md tokens; WCAG contrast validated post-parse.",
    nodes: [
      n(
        "da-in",
        300,
        0,
        "Design Agent",
        "Load AppSpec",
        "+ brief context",
        "design-agent reads spec summary for visual system generation."
      ),
      n(
        "da-llm",
        300,
        140,
        "Design Agent",
        "Targeted LLM",
        "≤5 rounds / write_file",
        "Produces palette, typography, radius, density, voice into design.md."
      ),
      n(
        "da-val",
        300,
        280,
        "Design Agent",
        "WCAG validate",
        "post-parse",
        "Contrast checks after parse; snapshot dual-write for DR."
      ),
    ],
    edges: [
      edge("dae1", "da-in", "da-llm"),
      edge("dae2", "da-llm", "da-val"),
    ],
  },
];

/** Match a split LLD section heading to a diagram definition. */
export function findLldDiagram(heading: string): LldSectionDefinition | undefined {
  const normalized = heading.replace(/`/g, "").replace(/\*\*/g, "").trim();
  return (
    LLD_DIAGRAMS.find((d) => d.heading === heading.trim() || d.heading === normalized) ??
    LLD_DIAGRAMS.find((d) => {
      const a = d.heading.replace(/`/g, "").toLowerCase();
      const b = normalized.toLowerCase();
      return a === b || a.startsWith(b.slice(0, 48)) || b.startsWith(a.slice(0, 48));
    })
  );
}
