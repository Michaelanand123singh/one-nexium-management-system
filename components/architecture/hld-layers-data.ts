import { MarkerType, type Edge } from "@xyflow/react";
import type { ArchitectureFlowNode, HldLayerDefinition } from "@/components/architecture/types";

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

/**
 * Phase 1 — HLD layer diagrams (one graph per layer from ONENEXIUM_HLD_V2).
 * Headings must match the HLD markdown for "View full docs" anchors.
 */
export const HLD_LAYERS: HldLayerDefinition[] = [
  {
    id: "layer-0",
    shortLabel: "L0",
    heading: "Layer 0 — Browser (Next.js Client)",
    title: "Browser (Next.js Client)",
    description:
      "Chat UI, progress cards, and preview iframe. Live turn SSE is the POST /api/ai/chat body; reconnect uses build-stream.",
    nodes: [
      node("l0-chat", 280, 0, {
        label: "Chat Panel",
        subtitle: "features/project-editor",
        docTab: "hld",
        heading: "Layer 0 — Browser (Next.js Client)",
        summary:
          "User sends a natural-language message from the project chat panel. Cards render as SSE events arrive (progress, questions, live URL).",
      }),
      node("l0-post", 280, 130, {
        label: "POST /api/ai/chat",
        subtitle: "Accept: text/event-stream",
        docTab: "hld",
        heading: "Layer 0 — Browser (Next.js Client)",
        summary:
          "Single chat endpoint. Response body is the live SSE stream for that turn — there is no GET /api/ai/events route.",
      }),
      node("l0-reconnect", 40, 260, {
        label: "build-stream SSE",
        subtitle: "Reconnect / refresh",
        docTab: "hld",
        heading: "Layer 0 — Browser (Next.js Client)",
        summary:
          "GET /api/projects/{id}/build-stream?lastEventId=… replay-then-tail for mid-build reconnect. build-status is the JSON poll fallback.",
      }),
      node("l0-cards", 520, 260, {
        label: "UI Cards",
        subtitle: "progress · pause · preview",
        docTab: "hld",
        heading: "Layer 0 — Browser (Next.js Client)",
        summary:
          "Renders progress bar, milestone pause, clarification/question cards, and live preview iframe from streamed events.",
      }),
    ],
    edges: [
      edge("l0-e1", "l0-chat", "l0-post"),
      edge("l0-e2", "l0-post", "l0-reconnect", "reconnect"),
      edge("l0-e3", "l0-post", "l0-cards", "live SSE"),
      edge("l0-e4", "l0-reconnect", "l0-cards", "replay"),
    ],
  },
  {
    id: "layer-1",
    shortLabel: "L1",
    heading: "Layer 1 — Next.js API Route",
    title: "Next.js API Route",
    description:
      "Guard chain → mode resolution → ask/plan inline or dispatch build. Always returns live SSE.",
    nodes: [
      node("l1-guards", 300, 0, {
        label: "Guard Chain",
        subtitle: "auth → body → own → rate → lock",
        docTab: "hld",
        heading: "Layer 1 — Next.js API Route",
        summary:
          "requireUserId → parseBody → assertOwnsProject → checkRateLimit → checkAndSetDedup → acquireProjectLock → checkAiReady.",
      }),
      node("l1-mode", 300, 130, {
        label: "sanitizeResolvedMode",
        subtitle: "client mode vs DB truth",
        docTab: "hld",
        heading: "Layer 1 — Next.js API Route",
        summary:
          "Dispatch key. Only explicit button clicks override DB truth; stale cache must never force a build or re-open ask.",
      }),
      node("l1-ask", 40, 280, {
        label: "Ask / Plan",
        subtitle: "inline, no job",
        docTab: "hld",
        heading: "Layer 1B — Ask Mode (Pre-Build, Inline)",
        summary: "runAskMode() / runPlanningMode() inline — no ai_build_jobs row created.",
      }),
      node("l1-dispatch", 300, 280, {
        label: "dispatchBuildTurn",
        subtitle: "queue job + observe SSE",
        docTab: "hld",
        heading: "Layer 1 — Next.js API Route",
        summary:
          "confirm_requirements / approve_plan → startOrResumeBuildJob (dedup one active job per project) then observeBuildJob.",
      }),
      node("l1-conv", 560, 280, {
        label: "Conversational",
        subtitle: "classifyMessage()",
        docTab: "hld",
        heading: "Layer 1 — Next.js API Route",
        summary:
          "Haiku classifies intent (ask/build/edit/operate/…). resolveExecutionConfig maps to toolMode, maxRounds, budgets.",
      }),
    ],
    edges: [
      edge("l1-e1", "l1-guards", "l1-mode"),
      edge("l1-e2", "l1-mode", "l1-ask", "ask/plan"),
      edge("l1-e3", "l1-mode", "l1-dispatch", "confirm"),
      edge("l1-e4", "l1-mode", "l1-conv", "conversational"),
    ],
  },
  {
    id: "layer-1b",
    shortLabel: "L1B",
    heading: "Layer 1B — Ask Mode (Pre-Build, Inline)",
    title: "Ask Mode (Pre-Build)",
    description:
      "One LLM round per HTTP turn. Completeness floor 85/100; transitions to ask_complete.",
    nodes: [
      node("l1b-ctx", 300, 0, {
        label: "assembleAskContext",
        subtitle: "profile · brand · template",
        docTab: "hld",
        heading: "Layer 1B — Ask Mode (Pre-Build, Inline)",
        summary: "Builds ask context from user profile, workspace brand, template, and prompt specificity.",
      }),
      node("l1b-rubric", 300, 120, {
        label: "Readiness Rubric",
        subtitle: "first turn only",
        docTab: "hld",
        heading: "Layer 1B — Ask Mode (Pre-Build, Inline)",
        summary:
          "generateReadinessRubric() — industry criteria[8–12], persisted on builderContext and reused later.",
      }),
      node("l1b-llm", 300, 240, {
        label: "Stream LLM (asking)",
        subtitle: "nexium-questions fence",
        docTab: "hld",
        heading: "Layer 1B — Ask Mode (Pre-Build, Inline)",
        summary: "Emits ai_question events live. Optional [REQUIREMENTS_COMPLETE] marker is not trusted alone.",
      }),
      node("l1b-gate", 300, 360, {
        label: "3-Guard Completion",
        subtitle: "floor · round cap · anti-strand",
        docTab: "hld",
        heading: "Layer 1B — Ask Mode (Pre-Build, Inline)",
        summary:
          "A: score < 85 veto. B: round ≥ 6 force-complete. C: anti-strand. Complete → ask_complete + requirements.",
      }),
    ],
    edges: [
      edge("l1b-e1", "l1b-ctx", "l1b-rubric"),
      edge("l1b-e2", "l1b-rubric", "l1b-llm"),
      edge("l1b-e3", "l1b-llm", "l1b-gate"),
    ],
  },
  {
    id: "layer-2",
    shortLabel: "L2",
    heading: "Layer 2 — Build Orchestrator Worker (PM2)",
    title: "Build Orchestrator Worker",
    description: "Detached PM2 process: bootstrap once, then poll queue and hand jobs to job-runner.",
    nodes: [
      node("l2-boot", 300, 0, {
        label: "Bootstrap",
        subtitle: "secrets · schema · OCE · Hatchet",
        docTab: "hld",
        heading: "Layer 2 — Build Orchestrator Worker (PM2)",
        summary:
          "bootstrapRuntimeSecrets, bootstrapExecutionPlane, ensureBuildJobsSchema, setOceRuntimeFactory, PgJobStore.init, startHatchetWorker.",
      }),
      node("l2-poll", 300, 140, {
        label: "Poll Loop",
        subtitle: "BUILD_WORKER_POLL_MS",
        docTab: "hld",
        heading: "Layer 2 — Build Orchestrator Worker (PM2)",
        summary: "fillBuildWorkerPool / processBuildJobQueue claims queued rows via FOR UPDATE SKIP LOCKED.",
      }),
      node("l2-runner", 300, 280, {
        label: "job-runner.ts",
        subtitle: "per claimed job",
        docTab: "hld",
        heading: "Layer 3 — Job Runner (per-job gate)",
        summary: "Hands each claimed job to processOneJob → executeBuildJob (Layer 3).",
      }),
    ],
    edges: [
      edge("l2-e1", "l2-boot", "l2-poll"),
      edge("l2-e2", "l2-poll", "l2-runner"),
    ],
  },
  {
    id: "layer-3",
    shortLabel: "L3",
    heading: "Layer 3 — Job Runner (per-job gate)",
    title: "Job Runner (per-job gate)",
    description:
      "Lock + credit resume-gate, then Hatchet route or inline HarnessFacade with MCP JWT.",
    nodes: [
      node("l3-lock", 300, 0, {
        label: "processOneJob",
        subtitle: "pause checks · credits · lock",
        docTab: "hld",
        heading: "Layer 3 — Job Runner (per-job gate)",
        summary:
          "Pre-checks paused/cancel. checkBuildCredits is resume-gate only. acquireProjectLock with Redis heartbeat lease.",
      }),
      node("l3-claim", 300, 130, {
        label: "claimQueuedBuildJob",
        subtitle: "atomic claim-lease",
        docTab: "hld",
        heading: "Layer 3 — Job Runner (per-job gate)",
        summary: "Status ladder + FOR UPDATE SKIP LOCKED claim before routing.",
      }),
      node("l3-hatchet", 80, 270, {
        label: "Hatchet Path",
        subtitle: "if HATCHET_ENABLED",
        docTab: "hld",
        heading: "Layer 5B — Hatchet Durable Execution (HATCHET_ENABLED path)",
        summary: "Idempotency via checkpoint.hatchetRunId → dispatchHatchetBuild → store runId.",
      }),
      node("l3-inline", 520, 270, {
        label: "Inline Path",
        subtitle: "MCP JWT → HarnessFacade",
        docTab: "hld",
        heading: "Layer 4 — Pipeline Router (HarnessFacade)",
        summary:
          "createMcpCredential + runWithHarnessDecision (freeze flags) → HarnessFacade.runJobOrchestrator.",
      }),
    ],
    edges: [
      edge("l3-e1", "l3-lock", "l3-claim"),
      edge("l3-e2", "l3-claim", "l3-hatchet", "Hatchet"),
      edge("l3-e3", "l3-claim", "l3-inline", "inline"),
    ],
  },
  {
    id: "layer-4",
    shortLabel: "L4",
    heading: "Layer 4 — Pipeline Router (HarnessFacade)",
    title: "Pipeline Router (HarnessFacade)",
    description: "Frozen feature flags pick OCE, Harness V3, or legacy orchestrator for the job.",
    nodes: [
      node("l4-facade", 300, 0, {
        label: "HarnessFacade",
        subtitle: "runJobOrchestrator",
        docTab: "hld",
        heading: "Layer 4 — Pipeline Router (HarnessFacade)",
        summary: "Single entry that routes by frozen per-job flags in AsyncLocalStorage.",
      }),
      node("l4-oce", 40, 160, {
        label: "OCE Stage Driver",
        subtitle: "OCE_ENABLED",
        docTab: "hld",
        heading: "Layer 5A — OCE Stage Driver (non-Hatchet path)",
        summary: "Newest path (default-off): runOceStageDriver().",
      }),
      node("l4-v3", 300, 160, {
        label: "Coordinator V3",
        subtitle: "HARNESS_V3",
        docTab: "hld",
        heading: "Layer 7C — Harness V3 Gates",
        summary: "runCoordinatorOrchestrator() — multi-wave LLM with V3 gates.",
      }),
      node("l4-legacy", 560, 160, {
        label: "Legacy Orchestrator",
        subtitle: "default",
        docTab: "hld",
        heading: "Layer 4 — Pipeline Router (HarnessFacade)",
        summary: "runBuildJobOrchestrator() when OCE and V3 flags are off.",
      }),
    ],
    edges: [
      edge("l4-e1", "l4-facade", "l4-oce", "OCE"),
      edge("l4-e2", "l4-facade", "l4-v3", "V3"),
      edge("l4-e3", "l4-facade", "l4-legacy", "legacy"),
    ],
  },
  {
    id: "layer-5a",
    shortLabel: "L5A",
    heading: "Layer 5A — OCE Stage Driver (non-Hatchet path)",
    title: "OCE Stage Driver",
    description: "Resolve AppSpec, insert root job, runFleet step loop until terminal.",
    nodes: [
      node("l5a-spec", 300, 0, {
        label: "Resolve AppSpec",
        subtitle: "DB snapshot + delta",
        docTab: "hld",
        heading: "Layer 5A — OCE Stage Driver (non-Hatchet path)",
        summary: "Combine stored AppSpec with user message delta before fleet run.",
      }),
      node("l5a-root", 300, 120, {
        label: "INSERT root job",
        subtitle: 'stage: "spec"',
        docTab: "hld",
        heading: "Layer 5A — OCE Stage Driver (non-Hatchet path)",
        summary: "Persists root job into PgJobStore at stage spec.",
      }),
      node("l5a-fleet", 300, 240, {
        label: "runFleet → step()",
        subtitle: "claim · handler · fan-out",
        docTab: "hld",
        heading: "Layer 5A — OCE Stage Driver (non-Hatchet path)",
        summary:
          "Claim job → run Handler → write files via McpWorkspace → fan-out children → advance/retry. Dead children still unblock parent.",
      }),
    ],
    edges: [
      edge("l5a-e1", "l5a-spec", "l5a-root"),
      edge("l5a-e2", "l5a-root", "l5a-fleet"),
    ],
  },
  {
    id: "layer-5b",
    shortLabel: "L5B",
    heading: "Layer 5B — Hatchet Durable Execution (HATCHET_ENABLED path)",
    title: "Hatchet Durable Execution",
    description:
      "Sequential durable stages; non-deterministic work only inside memoized child workflows.",
    nodes: [
      node("l5b-scaffold", 40, 40, {
        label: "scaffold",
        subtitle: "resolve AppSpec",
        docTab: "hld",
        heading: "Layer 5B — Hatchet Durable Execution (HATCHET_ENABLED path)",
        summary: "spec-interpreter → sanitize → Zod parse → validate/repair, then seed .onenexium/ base files.",
      }),
      node("l5b-spec", 200, 40, {
        label: "spec",
        subtitle: "targeted LLM",
        docTab: "hld",
        heading: "Layer 5B — Hatchet Durable Execution (HATCHET_ENABLED path)",
        summary: "Durable stage producing validated AppSpec for the build.",
      }),
      node("l5b-design", 360, 40, {
        label: "design",
        subtitle: "design.md",
        docTab: "hld",
        heading: "Layer 5B — Hatchet Durable Execution (HATCHET_ENABLED path)",
        summary: "Design tokens (palette, typography, density) written to design.md.",
      }),
      node("l5b-compile", 520, 40, {
        label: "compile",
        subtitle: "+ fill spawn",
        docTab: "hld",
        heading: "Layer 5B — Hatchet Durable Execution (HATCHET_ENABLED path)",
        summary: "Deterministic compile; runStageFull captures fill fan-out spawn for modules loop.",
      }),
      node("l5b-modules", 280, 180, {
        label: "modules loop",
        subtitle: "durable · barriers",
        docTab: "hld",
        heading: "Layer 5B — Hatchet Durable Execution (HATCHET_ENABLED path)",
        summary:
          "runChild module/scoped/verify with Promise.allSettled barriers; waitFor continue event at milestones.",
      }),
      node("l5b-final", 280, 320, {
        label: "preview → finalize",
        subtitle: "production-gate",
        docTab: "hld",
        heading: "Layer 5B — Hatchet Durable Execution (HATCHET_ENABLED path)",
        summary: "preview → production-gate → finalize after modules complete.",
      }),
    ],
    edges: [
      edge("l5b-e1", "l5b-scaffold", "l5b-spec"),
      edge("l5b-e2", "l5b-spec", "l5b-design"),
      edge("l5b-e3", "l5b-design", "l5b-compile"),
      edge("l5b-e4", "l5b-compile", "l5b-modules"),
      edge("l5b-e5", "l5b-modules", "l5b-final"),
    ],
  },
  {
    id: "layer-6",
    shortLabel: "L6",
    heading: "Layer 6 — OCE Compiler Engine (Deterministic)",
    title: "OCE Compiler Engine",
    description: "Same AppSpec → identical bytes. Generators + assemblers, no LLM in compile.",
    nodes: [
      node("l6-parse", 300, 0, {
        label: "parseAppSpec",
        subtitle: "Zod + sanitizers",
        docTab: "hld",
        heading: "Layer 6 — OCE Compiler Engine (Deterministic)",
        summary: "Zod schema with Identifier/RoutePath/Slug/Href validators blocking template injection.",
      }),
      node("l6-arch", 80, 140, {
        label: "Archetypes",
        subtitle: "landing · saas · lob…",
        docTab: "hld",
        heading: "Layer 6 — OCE Compiler Engine (Deterministic)",
        summary: "Partial AppSpec seeds and AppClass (pure-frontend → fullstack-saas).",
      }),
      node("l6-gen", 300, 140, {
        label: "Generators",
        subtitle: "schema · crud · page…",
        docTab: "hld",
        heading: "Layer 6 — OCE Compiler Engine (Deterministic)",
        summary: "Pure functions → Fragment[] (schema, CRUD, pages, forms, auth, RBAC, reports, workflows).",
      }),
      node("l6-asm", 520, 140, {
        label: "Assemblers",
        subtitle: "anchors · seed · exclusive",
        docTab: "hld",
        heading: "Layer 6 — OCE Compiler Engine (Deterministic)",
        summary: "Merge shared fragments; exclusive = full files; seed fragments are LLM-owned across rebuilds.",
      }),
      node("l6-out", 300, 280, {
        label: "reconcile → files",
        subtitle: ".onenexium/* anchors",
        docTab: "hld",
        heading: "Layer 6 — OCE Compiler Engine (Deterministic)",
        summary: "Diff compiled vs workspace; write only changed files. appspec.json / brief.md / design.md anchors.",
      }),
    ],
    edges: [
      edge("l6-e1", "l6-parse", "l6-arch"),
      edge("l6-e2", "l6-parse", "l6-gen"),
      edge("l6-e3", "l6-gen", "l6-asm"),
      edge("l6-e4", "l6-asm", "l6-out"),
      edge("l6-e5", "l6-arch", "l6-gen"),
    ],
  },
  {
    id: "layer-7",
    shortLabel: "L7",
    heading: "Layer 7 — Stage Handlers (production-runtime.ts)",
    title: "Stage Handlers",
    description: "spec/design = single LLM; fill/heal = agent loop; verify/preview = deterministic gates.",
    nodes: [
      node("l7-spec", 40, 0, {
        label: "spec (llm)",
        subtitle: "AppSpec JSON",
        docTab: "hld",
        heading: "Layer 7 — Stage Handlers (production-runtime.ts)",
        summary: "spec-interpreter → AppSpec; pause if confidence < 90.",
      }),
      node("l7-design", 220, 0, {
        label: "design (llm)",
        subtitle: "design.md",
        docTab: "hld",
        heading: "Layer 7 — Stage Handlers (production-runtime.ts)",
        summary: "design-agent → tokens; WCAG contrast validated post-parse.",
      }),
      node("l7-compile", 400, 0, {
        label: "compile (det)",
        subtitle: "OCE compile()",
        docTab: "hld",
        heading: "Layer 7 — Stage Handlers (production-runtime.ts)",
        summary: "Deterministic scaffold files via McpWorkspace.",
      }),
      node("l7-fill", 40, 160, {
        label: "fill (llm)",
        subtitle: "runAgentTurn / scope",
        docTab: "hld",
        heading: "Layer 7 — Stage Handlers (production-runtime.ts)",
        summary: "Per-scope fill with V3 pre/post-tool gates (10 guards per round).",
      }),
      node("l7-verify", 220, 160, {
        label: "verify (det)",
        subtitle: "tsc · smoke · routes",
        docTab: "hld",
        heading: "Layer 7 — Stage Handlers (production-runtime.ts)",
        summary: "MCP typecheck + behavioral smoke + route integrity; collision resolution before heal.",
      }),
      node("l7-heal", 400, 160, {
        label: "heal (llm)",
        subtitle: "fix type/lint",
        docTab: "hld",
        heading: "Layer 7 — Stage Handlers (production-runtime.ts)",
        summary: "runAgentTurn with gates; production-gate elevates role for admin smoke checks.",
      }),
      node("l7-preview", 220, 300, {
        label: "preview (det)",
        subtitle: "dev server + DB smoke",
        docTab: "hld",
        heading: "Layer 7 — Stage Handlers (production-runtime.ts)",
        summary: "startDevServer; fullstack probes /api/health — disconnected DB is FATAL.",
      }),
    ],
    edges: [
      edge("l7-e1", "l7-spec", "l7-design"),
      edge("l7-e2", "l7-design", "l7-compile"),
      edge("l7-e3", "l7-compile", "l7-fill"),
      edge("l7-e4", "l7-fill", "l7-verify"),
      edge("l7-e5", "l7-verify", "l7-heal", "fail"),
      edge("l7-e6", "l7-heal", "l7-verify", "retry"),
      edge("l7-e7", "l7-verify", "l7-preview", "pass"),
    ],
  },
  {
    id: "layer-7b",
    shortLabel: "L7B",
    heading: "Layer 7B — Universal LLM Client",
    title: "Universal LLM Client",
    description: "Provider-agnostic factory; Super Admin configures provider and model tiers.",
    nodes: [
      node("l7b-factory", 300, 0, {
        label: "createLlmClientAsync",
        subtitle: "single factory",
        docTab: "hld",
        heading: "Layer 7B — Universal LLM Client",
        summary: "Every LLM call (spec, design, ask, fill, heal) goes through this factory.",
      }),
      node("l7b-cfg", 80, 150, {
        label: "Config Priority",
        subtitle: "DB → env → default",
        docTab: "hld",
        heading: "Layer 7B — Universal LLM Client",
        summary: "1) platform_settings 2) env vars 3) anthropic/direct default.",
      }),
      node("l7b-prov", 300, 150, {
        label: "Providers",
        subtitle: "anthropic · openai · google · glm",
        docTab: "hld",
        heading: "Layer 7B — Universal LLM Client",
        summary: "Identical Anthropic SDK interface → zero caller changes on switch.",
      }),
      node("l7b-tier", 520, 150, {
        label: "Model Tiers",
        subtitle: "opus · sonnet · haiku",
        docTab: "hld",
        heading: "Layer 7B — Universal LLM Client",
        summary: "opus = heavy build; sonnet = ask/edit; haiku = classify/rubric. Auto-select by signal.",
      }),
    ],
    edges: [
      edge("l7b-e1", "l7b-factory", "l7b-cfg"),
      edge("l7b-e2", "l7b-factory", "l7b-prov"),
      edge("l7b-e3", "l7b-factory", "l7b-tier"),
    ],
  },
  {
    id: "layer-7c",
    shortLabel: "L7C",
    heading: "Layer 7C — Harness V3 Gates",
    title: "Harness V3 Gates",
    description: "When HARNESS_V3=1, 10 safety gates intercept every tool call in runAgentTurn.",
    nodes: [
      node("l7c-pre", 40, 80, {
        label: "pre-tool",
        subtitle: "before MCP call",
        docTab: "hld",
        heading: "Layer 7C — Harness V3 Gates",
        summary: "Intercepts and validates tool calls before they hit MCP.",
      }),
      node("l7c-post", 220, 80, {
        label: "post-tool",
        subtitle: "after MCP result",
        docTab: "hld",
        heading: "Layer 7C — Harness V3 Gates",
        summary: "Shapes/validates tool results before they re-enter the agent loop.",
      }),
      node("l7c-resp", 400, 80, {
        label: "post-response",
        subtitle: "after LLM reply",
        docTab: "hld",
        heading: "Layer 7C — Harness V3 Gates",
        summary: "Checks model response before continuing the round.",
      }),
      node("l7c-end", 580, 80, {
        label: "pre-turn-end",
        subtitle: "before exit",
        docTab: "hld",
        heading: "Layer 7C — Harness V3 Gates",
        summary: "Final gate before the agent turn ends.",
      }),
    ],
    edges: [
      edge("l7c-e1", "l7c-pre", "l7c-post"),
      edge("l7c-e2", "l7c-post", "l7c-resp"),
      edge("l7c-e3", "l7c-resp", "l7c-end"),
    ],
  },
  {
    id: "layer-8",
    shortLabel: "L8",
    heading: "Layer 8 — MCP Server + Dev Worker (Python / AI Core)",
    title: "MCP Server + Dev Worker",
    description: "Python AI core: MCP tools :8000, dev worker :8001, warm tsc :8002.",
    nodes: [
      node("l8-mcp", 300, 0, {
        label: "MCP Server :8000",
        subtitle: "FastAPI + FastMCP",
        docTab: "hld",
        heading: "Layer 8 — MCP Server + Dev Worker (Python / AI Core)",
        summary:
          "Namespaces: workspace, codegen, build, devserver, quality, deploy, infra. Auth: HS256 JWT scoped to user+workspace+project.",
      }),
      node("l8-worker", 80, 160, {
        label: "Dev Worker :8001",
        subtitle: "dev_worker.py",
        docTab: "hld",
        heading: "Layer 8 — MCP Server + Dev Worker (Python / AI Core)",
        summary: "Per-project dev server lifecycle on SSD; /worker/capacity for slots.",
      }),
      node("l8-tsc", 520, 160, {
        label: "tsc-service :8002",
        subtitle: "warm WatchProgram",
        docTab: "hld",
        heading: "Layer 8 — MCP Server + Dev Worker (Python / AI Core)",
        summary: "POST /check {project_id} → passed/errors — avoids cold tsc on every verify.",
      }),
    ],
    edges: [
      edge("l8-e1", "l8-mcp", "l8-worker", "devserver"),
      edge("l8-e2", "l8-mcp", "l8-tsc", "quality"),
    ],
  },
  {
    id: "layer-9",
    shortLabel: "L9",
    heading: "Layer 9 — Data Layer",
    title: "Data Layer",
    description: "Postgres truth, Redis locks/SSE, MinIO snapshots, Hatchet durable state.",
    nodes: [
      node("l9-pg", 40, 80, {
        label: "Postgres",
        subtitle: "jobs · memory · PER",
        docTab: "hld",
        heading: "Layer 9 — Data Layer",
        summary:
          "users, projects, ai_build_jobs, oce_jobs, credits, project_execution (PER lifecycle authority), episodic memory.",
      }),
      node("l9-redis", 240, 80, {
        label: "Redis",
        subtitle: "lock · SSE · progress",
        docTab: "hld",
        heading: "Layer 9 — Data Layer",
        summary: "Distributed lock lease, SSE stream XADD/XRANGE, BuildProgressState 30m TTL, rate limits.",
      }),
      node("l9-minio", 440, 80, {
        label: "MinIO",
        subtitle: "snapshots · backups",
        docTab: "hld",
        heading: "Layer 9 — Data Layer",
        summary: "S3-compatible project file snapshots and workspace backups.",
      }),
      node("l9-hatchet", 640, 80, {
        label: "Hatchet",
        subtitle: "durable state",
        docTab: "hld",
        heading: "Layer 9 — Data Layer",
        summary: "Workflow state, child task memoization, concurrency groups.",
      }),
    ],
    edges: [
      edge("l9-e1", "l9-pg", "l9-redis", "jobs emit"),
      edge("l9-e2", "l9-redis", "l9-minio"),
      edge("l9-e3", "l9-pg", "l9-hatchet", "runs"),
    ],
  },
  {
    id: "layer-10",
    shortLabel: "L10",
    heading: "Layer 10 — SSE Event Flow Back to Browser",
    title: "SSE Event Flow",
    description: "durableEmit → Redis stream + progress; browser live turn or reconnect observer.",
    nodes: [
      node("l10-emit", 300, 0, {
        label: "durableEmit",
        subtitle: "every stage",
        docTab: "hld",
        heading: "Layer 10 — SSE Event Flow Back to Browser",
        summary: "Appends to Redis Stream and updates BuildProgressState — not Postgres.",
      }),
      node("l10-redis", 300, 130, {
        label: "Redis Stream",
        subtitle: "XADD · max 500 · 30m",
        docTab: "hld",
        heading: "Layer 10 — SSE Event Flow Back to Browser",
        summary: "Append log powering live SSE and reconnect replay via XRANGE.",
      }),
      node("l10-live", 80, 270, {
        label: "Live turn SSE",
        subtitle: "POST /api/ai/chat body",
        docTab: "hld",
        heading: "Layer 10 — SSE Event Flow Back to Browser",
        summary: "Current request streams events as the turn runs.",
      }),
      node("l10-re", 520, 270, {
        label: "Reconnect SSE",
        subtitle: "build-stream",
        docTab: "hld",
        heading: "Layer 10 — SSE Event Flow Back to Browser",
        summary: "GET build-stream?lastEventId=… replay-then-tail after refresh/drop.",
      }),
      node("l10-ui", 300, 400, {
        label: "Browser Cards",
        subtitle: "progress · pause · preview",
        docTab: "hld",
        heading: "Layer 10 — SSE Event Flow Back to Browser",
        summary:
          "Progress bar, milestone continue (pushContinue), ai_question cards, live preview iframe.",
      }),
    ],
    edges: [
      edge("l10-e1", "l10-emit", "l10-redis"),
      edge("l10-e2", "l10-redis", "l10-live"),
      edge("l10-e3", "l10-redis", "l10-re"),
      edge("l10-e4", "l10-live", "l10-ui"),
      edge("l10-e5", "l10-re", "l10-ui"),
    ],
  },
  {
    id: "layer-11",
    shortLabel: "L11",
    heading: "Layer 11 — Publish / Deploy Pipeline (`publish-from-dev.ts` → CodeBuild → ECR → Traefik)",
    title: "Publish / Deploy Pipeline",
    description: "User-triggered publish: sync → CodeBuild → prod DB → ECS/Traefik → live URL.",
    nodes: [
      node("l11-pub", 300, 0, {
        label: "Publish click",
        subtitle: "preview_ready → worker",
        docTab: "hld",
        heading: "Layer 11 — Publish / Deploy Pipeline (`publish-from-dev.ts` → CodeBuild → ECR → Traefik)",
        summary: "Not automatic. Unlocks after production-gate + smoke; durable publishFromDevPreview worker.",
      }),
      node("l11-sync", 80, 140, {
        label: "Sync SSD → S3",
        subtitle: "user-projects/",
        docTab: "hld",
        heading: "Layer 11 — Publish / Deploy Pipeline (`publish-from-dev.ts` → CodeBuild → ECR → Traefik)",
        summary: "sync_project_to_aws from dev-worker SSD to S3.",
      }),
      node("l11-build", 300, 140, {
        label: "CodeBuild → ECR",
        subtitle: "Docker standalone",
        docTab: "hld",
        heading: "Layer 11 — Publish / Deploy Pipeline (`publish-from-dev.ts` → CodeBuild → ECR → Traefik)",
        summary: "onenexium-site-builder builds image and pushes to ECR {tenantId}:{buildId}.",
      }),
      node("l11-db", 520, 140, {
        label: "Prod DB setup",
        subtitle: "Neon / schema / seeds",
        docTab: "hld",
        heading: "Layer 11 — Publish / Deploy Pipeline (`publish-from-dev.ts` → CodeBuild → ECR → Traefik)",
        summary: "Provision prod DB once, schema_push, seed role logins (passwords delivered once).",
      }),
      node("l11-live", 300, 280, {
        label: "ECS + Traefik",
        subtitle: "sites.onenexium.com",
        docTab: "hld",
        heading: "Layer 11 — Publish / Deploy Pipeline (`publish-from-dev.ts` → CodeBuild → ECR → Traefik)",
        summary: "start_container, register_traefik_route, health probe → status live.",
      }),
    ],
    edges: [
      edge("l11-e1", "l11-pub", "l11-sync"),
      edge("l11-e2", "l11-sync", "l11-build"),
      edge("l11-e3", "l11-build", "l11-db"),
      edge("l11-e4", "l11-db", "l11-live"),
    ],
  },
  {
    id: "layer-12",
    shortLabel: "L12",
    heading: "Layer 12 — Skill System",
    title: "Skill System",
    description: "On-demand instruction + tool injection when message matches skill triggers.",
    nodes: [
      node("l12-msg", 300, 0, {
        label: "User Message",
        subtitle: "this turn only",
        docTab: "hld",
        heading: "Layer 12 — Skill System",
        summary: "Skills activate per turn from message content — not always-on in the system prompt.",
      }),
      node("l12-match", 300, 130, {
        label: "Trigger Match",
        subtitle: "skill.triggers regex",
        docTab: "hld",
        heading: "Layer 12 — Skill System",
        summary: "crud_api, auth_flow, form_builder, chart_widget, landing_page, etc.",
      }),
      node("l12-inj", 140, 270, {
        label: "Instructions",
        subtitle: "append to prompt",
        docTab: "hld",
        heading: "Layer 12 — Skill System",
        summary: "Focused domain instructions appended for this turn only (~saves 15–20K tokens).",
      }),
      node("l12-tools", 460, 270, {
        label: "requiredTools",
        subtitle: "toolset add",
        docTab: "hld",
        heading: "Layer 12 — Skill System",
        summary: "skill.requiredTools merged into available tools for this turn only.",
      }),
    ],
    edges: [
      edge("l12-e1", "l12-msg", "l12-match"),
      edge("l12-e2", "l12-match", "l12-inj"),
      edge("l12-e3", "l12-match", "l12-tools"),
    ],
  },
  {
    id: "layer-13",
    shortLabel: "L13",
    heading: "Layer 13 — AWS Infrastructure Layer",
    title: "AWS Infrastructure Layer",
    description: "Secrets Manager, S3 project buckets, and agent-turn seams (shaping, pairing, progress).",
    nodes: [
      node("l13-sec", 80, 40, {
        label: "Secrets Manager",
        subtitle: "project + platform",
        docTab: "hld",
        heading: "Layer 13 — AWS Infrastructure Layer",
        summary:
          "Project secrets in SM (Postgres holds metadata only). Platform secrets loaded at worker bootstrap.",
      }),
      node("l13-s3", 300, 40, {
        label: "S3 Buckets",
        subtitle: "user-projects · assets",
        docTab: "hld",
        heading: "Layer 13 — AWS Infrastructure Layer",
        summary: "user-projects/{id}/ source + assets; workspace-templates for previews.",
      }),
      node("l13-seams", 520, 40, {
        label: "Agent Turn Seams",
        subtitle: "shape · pair · progress",
        docTab: "hld",
        heading: "Layer 13 — AWS Infrastructure Layer",
        summary:
          "trimToolResult / repairToolPairing / page-progress → build_progress SSE with pages completed/remaining.",
      }),
    ],
    edges: [
      edge("l13-e1", "l13-sec", "l13-s3"),
      edge("l13-e2", "l13-s3", "l13-seams"),
    ],
  },
];
