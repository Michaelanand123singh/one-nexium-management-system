# OneNexium — High-Level Design (HLD)

> **Source**: Derived from live codebase (feat/prince-chat-panel branch), 2026-07-11.  
> This document tracks the actual code, not aspirational design. Update it when the system changes.

---

## What is OneNexium?

An AI website-builder SaaS. A user types a natural-language prompt; the platform generates, builds,
previews, and optionally deploys a full-stack Next.js application. The core innovation is a
**compiler-first + LLM-fill hybrid**: a deterministic compiler (OCE) generates the structural skeleton
from a validated IR (`AppSpec`), then LLM agents fill the creative/logic regions. A verification spine
(typecheck → smoke gate → heal) ensures nothing ships broken.

### Builder Mode State Machine

Every project tracks a `builderMode` that gates what the API accepts and what the UI shows:

```
asking → ask_complete → planning → plan_complete → building → done → (follow-up) → building → done
                                                        ↑ clarification pause ↓
                                                   clarification_answer → resume build
```

- **asking**: Ask Mode is running — Q&A rounds gathering requirements
- **plan_complete**: requirements complete, ready for build dispatch
- **building**: build job is running (OCE pipeline)
- **done**: build finished, preview live
- **error**: terminal failure

---

## Process Map

Six PM2 processes form the runtime:

| Process | Entry point | Port |
|---|---|---|
| `platform` | `onenexium_platform/` Next.js | 3000 |
| `build-orchestrator` | `server/ai/build-jobs/worker.ts` | — |
| `mcp` | `onenexium-ai-core/mcp_server.py` | 8000 |
| `worker` | `onenexium-ai-core/dev_worker.py` | 8001 |
| `tsc-service` | `onenexium-ai-core/tsc_service.js` | 8002 |
| `dag-ui` | Hatchet dashboard (when enabled) | 8888 |

Docker deps: Postgres :5432, Redis :6379, MinIO :9000, Neon HTTP proxy :4444.  
Optional: Hatchet-lite (gRPC :7077, API :8888) via `local/hatchet-compose.yml`.

---

## Layer-by-Layer Breakdown

### Layer 0 — Browser (Next.js Client)

```
features/project-editor/   ← chat panel, progress bar, preview iframe
features/workspace/         ← project list, billing
app/(dashboard)/            ← App Router pages
```

The user sends a message from the chat panel via a single `POST /api/ai/chat`
(`Accept: text/event-stream`) — **its response body is the live SSE stream** for that turn
(there is no `GET /api/ai/events` route). Durable reconnection mid-build (refresh, dropped
stream) is served by `GET /api/projects/{projectId}/build-stream?lastEventId=…` (SSE observer:
replay-then-tail) with `GET /api/projects/{projectId}/build-status` as the JSON poll fallback.
The browser renders cards (progress, milestone pause, clarification, live URL) as events arrive.

---

### Layer 1 — Next.js API Route

```
POST /api/ai/chat  (app/api/ai/chat/route.ts)
  ├── GUARD CHAIN (in order): requireUserId (401) → parseBody (400) →
  │     assertOwnsProject (404/403) → checkRateLimit (429) →
  │     checkAndSetDedup (409) → acquireProjectLock (423, conversational skips) →
  │     checkAiReady (503)
  ├── resolvedMode = sanitizeResolvedMode(clientMode, DB.builderMode, DB.status)
  │       ↑ dispatch key. The route does NOT classify intent at entry — it reconciles the
  │         client-sent `mode` against DB truth. Effective routes:
  │     ask / plan          → runAskMode() / runPlanningMode() inline (no job created)
  │     confirm_requirements│approve_plan → dispatchBuildTurn() → INSERT ai_build_jobs (queued)
  │     continue_building   → pushContinue(projectId) [Hatchet] + resume paused job
  │     conversational      → classifyMessage() decides: inline answer | singleEdit | growth build
  └── ALWAYS returns the live SSE stream (POST response body); durableEmit also appends
        each event to the Redis event store for reconnect replay.
```

The route dispatches by `resolvedMode`; build-kickoff modes release the project lock and hand
execution to the detached orchestrator, then observe via SSE. `classifyMessage()` (the 6-Primary
Action model below) runs only in the `conversational` branch and inside the build worker — not at
route entry. The route-level credit reservation (`reserveForChat`) is **non-blocking** —
`insufficient_funds` proceeds on a default budget ("credits size the budget, not gate access"); any
hard credit gate lives in the build worker (Layer 3). `runAskMode`/`runPlanningMode` are dedicated
engines (not `runAgentTurn`).

**Mode Resolution trust model** (`sanitizeResolvedMode`): the guiding rule is *only an explicit
button-click may override DB truth; a stale client cache must never force a build or re-open ask
mode.* Three guards: (1) `conversational` is always trusted (bypasses the lock for mid-build Q&A);
(2) a **stale-start guard** redirects a replayed `confirm_requirements` to `conversational` when the
build has already advanced past ask; (3) a **built-project regression guard** routes any non-action
turn on a finished project (`status=preview_ready` / `builderMode∈{done,building}`) to
`conversational` — a completed project can never re-enter ask/plan. Client `ask`/`plan` are trusted
only for a new project (`builderMode` null or `asking`); everything else falls back to DB truth.
See LLD → *Mode Resolution* for the full ladder + truth table.

#### Intent Classification: Two-Tier + `operate` (conversational branch + worker)

Intent is derived by `classifyMessage()` (message-understanding.ts):
- **Tier 1**: LLM (Haiku) — sole authoritative classifier (old regex fast-path removed; it misread bug reports as `question`)
- **Tier 2 (fallback)**: Legacy keyword classifier — only fires when Haiku is unreachable (network/timeout/rate limit)

`operate` is the 6th `PrimaryAction` — commands about the **build machinery itself** (restart dev server, rebuild/refresh preview, read logs), not the app's code. Disambiguation rule: "rebuild the dashboard PAGE" = `edit`; "rebuild/refresh the PREVIEW/server" = `operate`.

Legacy compatibility: `operate` maps to `"question"` in the legacy `UserIntent` enum (safe/non-mutating fallback). Real routing is on `primary === "operate"` in the execution resolver.

#### Execution Resolver

`resolveExecutionConfig()` (execution-resolver.ts) maps `MessageUnderstanding` → `ExecutionConfig`:

```
toolMode   operate                → devserver (owns start_dev_server / trigger_build / get_runtime_logs)
           edit/fix (non-large)   → edit      (clean toolset: read+apply_diff; NO run_command)
           forceEditMode          → edit      (router's confirmed all-edit path, bypasses re-classification)
           deploy                 → agent
           question (no context)  → question
           everything else        → devserver

maxRounds  operate                → 8   (AI_OPERATE_MAX_ROUNDS, env-tunable)
           trivial edit/fix       → 25  (AI_EDIT_MAX_ROUNDS)
           moderate edit/fix      → 60  (AI_EDIT_MODERATE_MAX_ROUNDS)
           question               → 3 (no context) or configuredMax
           large / build          → configuredMax (100)

toolOutputBudget   question (read-only) → compact  (4096 tokens)
                   large work           → generous (128K tokens)
                   everything else      → standard (65536 tokens)
                   NOTE: decoupled from outputEffort — a message phrased as a question
                   promoted to devserver/edit gets a real write budget, not the 4096 ceiling
```

**`forceEditMode`**: The upstream follow-up router can mark a dispatch as a confirmed all-edit path (every planned op is an edit, no structural change). This flag is passed to the resolver and **pins** the turn to edit mode regardless of the classifier's fresh opinion. Prevents a second independent classification from upgrading a layout-edit to a full-build config (100 rounds + run_command) — which previously caused 185 reads over 9 minutes on a simple sidebar change.

---

### Layer 1B — Ask Mode (Pre-Build, Inline)

Ask Mode runs **before** any build job exists, invoked inline when `resolvedMode ∈ {ask, asking}`.
It is **one LLM round per HTTP turn** — the multi-round interview is spread across successive
`POST /api/ai/chat` calls (round # is a persisted counter, not an in-process loop). The real
laptop-store trace = 6 separate turns.

```
runAskMode(input):   // ONE turn
  ├── assembleAskContext()      — user profile, workspace brand, template, prompt specificity
  ├── first turn only: generateReadinessRubric() — industry rubric { industry, criteria[8–12] },
  │                    persisted on builderContext + reused every later turn
  ├── stream LLM (model = "asking" tier):
  │     ├── prose + a ```nexium-questions fence → emit `ai_question` events LIVE (not `clarification`)
  │     └── optional [REQUIREMENTS_COMPLETE] marker
  └── 3-guard completion gate (server does NOT trust the marker):
        A floorVeto     — score < 85 → synthesize gap questions, force another round
        B round cap      — round ≥ MAX_ASK_ROUNDS(6) → force-complete best-effort
        C anti-strand    — vetoed but no question producible → allow completion
        complete → transitionBuilderMode("ask_complete") + persist requirementsSummary + requirements
        else     → forceBuilderMode("asking") + persist accumulated requirements doc, round++
```

Completeness floor is 85/100 — the LLM cannot self-declare completion below this score. Score is
the LLM-judged **readiness-rubric** coverage (keyword `computeCompleteness` is the fallback). On
completion the transition is **`ask_complete`** (not `plan_complete`).

---

### Layer 2 — Build Orchestrator Worker (PM2)

```
server/ai/build-jobs/worker.ts
  Bootstrap sequence (once at startup):
  ├── bootstrapRuntimeSecrets()
  ├── bootstrapExecutionPlane()    — EC2 / MCP endpoint pool
  ├── ensureBuildJobsSchema()      — idempotent DDL
  ├── setOceRuntimeFactory()       — injects production handlers
  ├── getProductionJobStore().init() — OCE Postgres tables
  └── startHatchetWorker()         — no-op unless HATCHET_ENABLED

  Poll loop (BUILD_WORKER_POLL_MS):
  └── fillBuildWorkerPool() / processBuildJobQueue()
        └── per-job → job-runner.ts
```

**Job creation is platform-side**: the route's `dispatchBuildTurn()` persists the kickoff message,
calls `startOrResumeBuildJob()` (which **dedups to one active job per project** — a second dispatch
*resumes* the existing job and merges its `runContext`, never duplicates), then only *observes* the
durable job over SSE (`observeBuildJob`). The worker (this layer) claims queued rows via
`claimExecutableBuildJobs()` (`FOR UPDATE SKIP LOCKED`) and executes them.

---

### Layer 3 — Job Runner (per-job gate)

```
server/ai/build-jobs/job-runner.ts   (two functions: processOneJob → executeBuildJob)
  processOneJob (lock wrapper):
  ├── job_paused_user/cancel/paused_credits pre-checks
  ├── checkBuildCredits()          — RESUME-GATE ONLY: gates un-pausing a job_paused_credits job;
  │                                   a fresh build is NOT credit-gated at start (credits size budget;
  │                                   mid-build insufficiency → job_paused_credits pause, not an abort)
  └── acquireProjectLock()         — Redis heartbeat-LEASE (LOCK_LEASE_TTL_MS, renew every LOCK_LEASE_RENEW_MS)
  executeBuildJob (claim → route → run):
  ├── status ladder → claimQueuedBuildJob()   — atomic (FOR UPDATE SKIP LOCKED + claim-lease)
  ├── HATCHET ROUTING (if enabled): idempotency (checkpoint.hatchetRunId) → follow-up clarify gate
  │        → edit-first fork (in-place edit stays inline; else dispatchHatchetBuild → store runId → return)
  └── INLINE (non-Hatchet / edit follow-up):
        createMcpCredential()      — short-lived HS256 JWT (userId+workspaceId+projectId)
        runWithHarnessDecision()   — freeze feature flags in AsyncLocalStorage
          └── HarnessFacade.runJobOrchestrator(params)
```

All events are emitted via `durableEmit()` which writes to the event-store (Redis)
so the browser SSE stream picks them up:

```
job_started | build_progress | live_url | dev_preview_url | ai_question | text |
milestone_pause | mode_change | job_completed | done | error
```
(~44 event types total in `sse.ts`; questions are `ai_question`, not `clarification`.)

---

### Layer 4 — Pipeline Router (HarnessFacade)

```
server/ai/harness-v3/harness-facade.ts

  HarnessFacade.runJobOrchestrator()
    ├── OCE_ENABLED?   → runOceStageDriver()         (newest, default-off)
    ├── HARNESS_V3?    → runCoordinatorOrchestrator() (multi-wave LLM)
    └── (default)      → runBuildJobOrchestrator()    (legacy)

  Feature flags are frozen per-job in AsyncLocalStorage (feature-flags.ts).
  A mid-build env change cannot split a job across pipelines.
```

When `HATCHET_ENABLED`, the routing happens one level up in `job-runner.ts`:

```
  checkpoint.hatchetRunId set? → return (idempotent)
  otherwise → dispatchHatchetBuild() → Hatchet "oce-build" run
```

---

### Layer 5A — OCE Stage Driver (non-Hatchet path)

```
server/ai/harness-v3/oce/oce-stage-driver.ts

  ├── Resolve AppSpec (DB snapshot + user message delta)
  ├── INSERT root job (stage: "spec") into PgJobStore
  └── runFleet() → step() loop until all jobs terminal

        engine/pipeline/runner.ts : step()
          ├── Claim one job from PgJobStore
          ├── Run its Handler (det or llm role)
          ├── Write output files → McpWorkspace
          ├── Fan-out child jobs (fill scopes, pendingChildren barrier)
          └── Advance stage or retry (MAX_ATTEMPTS: fill 3, others 2, compile 1)
```

Dead children still unblock their parent (partial-progress tolerance, §4.1).

---

### Layer 5B — Hatchet Durable Execution (HATCHET_ENABLED path)

```
server/orchestration/hatchet/build-workflow.ts

  Workflow: "oce-build"   (per-user concurrency cap via expression: input.userId,
                           maxRuns HATCHET_USER_MAX_RUNS=2, GROUP_ROUND_ROBIN;
                           taskDefaults.executionTimeout "10m" = safety floor vs the SDK's 60s default)

  Sequential tasks (parents chain; ONLY `modules` is a durable task):
    scaffold → spec → design → compile → [modules loop] → preview → production-gate → finalize

  scaffold: appSpec = resolveAppSpec()  (spec-interpreter LLM → sanitize → parse(Zod) → validate/repair)
            THEN runStage("scaffold") seeds the project + .onenexium/ base files. The AppSpec is
            resolved in the scaffold task and passed forward via payload.
  compile:  uses runStageFull to capture the fill fan-out `spawn` (follow-up deltas).

  Durable modules loop (guard: 0..500 iterations):
    (follow-up only) delta pre-pass: allSettled(runChild(scopedWf, payload.__deltaSpawn)) + verify
    step = runChild(moduleStepWf)              ← memoized across replay
    if advanceTo == "preview": break
    if spawn:
      Promise.allSettled(spawn.map(c => runChild(scopedWf, c)))   ← BARRIER, NOT bulkRunChildren
                                                 (allSettled tolerates a dead child without abandoning
                                                  siblings → fixes the false-green barrier bug)
    runChild(verifyWf, { payload })            ← verify scoped to builtCount → heal loop
    if pauseAtMilestone:
      emitMilestonePause()
      waitFor(Or(UserEventCondition("continue:<projectId>"), SleepCondition(10m auto-continue)))

  Child workflows:
    oce-module-step  → runStageFull("module", ...)     20m timeout, 2 retries
    oce-scoped       → runStageFull(stage, {scope})    20m timeout, 3 retries
    oce-verify       → verify → allSettled heal loop   20m timeout, 2 retries
```

**Durable-determinism rule**: Hatchet evicts a durable task at every wait point and
replays from the top. Non-deterministic work (LLM, file I/O, `runStageFull`) must run only inside
child workflows invoked by `ctx.runChild` (which Hatchet memoizes). The durable body may only
orchestrate (`runChild` + `Promise.allSettled` + `ctx.waitFor`) — never call LLMs inline.

---

### Layer 6 — OCE Compiler Engine (Deterministic)

```
server/engine/

  app-spec.ts      → parseAppSpec()  Zod schema + injection sanitization
                     Identifier/RoutePath/Slug/Href validators block template injection
  archetypes/      → partial AppSpec seeds (landing/portfolio/saas-basic/lob-crud/marketplace)
                     AppClass: pure-frontend | frontend-light-backend | fullstack-lob | fullstack-saas
  compile.ts       → generators → Fragment[] → assemblers → sorted File[]

  generators/ (one function per concern, pure, no side-effects):
    schema-gen      → Drizzle schema files
    crud-gen        → API route handlers (list, create, get, update, delete)
    page-gen        → Next.js page scaffolds
    form-gen        → React form components
    auth-gen        → NextAuth config, sign-in/out pages
    rbac-gen        → middleware, role guards
    report-gen      → data table / analytics pages
    workflow-gen    → multi-step workflow pages
    scaffold-gen    → project root files (layout, providers, env)

  assemblers/assemble-by-anchors.ts
    → merges "shared" fragments for a target file
    → "exclusive" fragments are full files (no merge)
    → "seed" fragments are LLM-owned: written on first build, preserved on rebuild
      (OCE fill calls dropSeedMarker after writing; apply_diff on edit turns also drops it)
      e.g. app/(protected)/layout.tsx — auth enforced in API handlers; the sidebar/topbar
      layout is UX-only, so LLM edits persist across OCE rebuilds

  scopes.ts        → customScopes(spec) = fan-out units for LLM fill
  reconcile.ts     → diff compiled vs workspace → write only changed files
```

**Project tier** (set by spec interpreter): `"basic"` (static/presentational, no DB/auth) vs `"fullstack"` (data/accounts). Tier determines scaffold structure and which generators run.

The same `AppSpec` always produces identical bytes. Side-effect-free.

**Workspace anchor files** (written during build, read by handlers):
```
.onenexium/appspec.json      ← compiled IR (source of truth)
.onenexium/appspec.prev.json ← prior revision (follow-up delta)
.onenexium/brief.md          ← rich project context (user request + Q&A + plan + data model)
.onenexium/design.md         ← design tokens (palette, typography, density)
.onenexium/built.json        ← durable "full build done" marker
.onenexium/pages/            ← per-page spec stubs for fill handlers
```

---

### Layer 7 — Stage Handlers (production-runtime.ts)

```
server/ai/harness-v3/oce/production-runtime.ts

  Stage → Handler type → What it does
  ─────────────────────────────────────────────────────────────────────────
  spec    llm   spec-interpreter.ts  → targeted LLM call → AppSpec JSON
                                       emits _confidence + _clarifications
                                       clarification gate: pause if confidence < 90
  design  llm   design-agent.ts      → targeted LLM call → design.md
                                       (palette, typography, radius, density, voice)
                                       WCAG contrast validated post-parse
  compile det   OCE compile()        → deterministic → all scaffold files via McpWorkspace
  fill    llm   runAgentTurn()        → per scope → fills page/component logic
                                       gates (V3): 10 pre/post-tool guards per round
  verify  det   MCP typecheck (tsc-service) + behavioral smoke + route integrity
  heal    llm   runAgentTurn()        → fixes type/lint errors; gates active
  preview det   startDevServer() (cold_start) → live dev URL + DB SMOKE GATE: fullstack apps probe
                                       /api/health (SELECT 1); database "disconnected"/503 → FATAL
                                       throw (catches a dead/unmigrated DB — "looks done, backend dead")
```

**spec and design use targeted single LLM calls** (not the multi-round agent turn loop). `runAgentTurn()` is used only for fill and heal — the stages that need multi-round tool loops.

#### Production Gate — Route-Collision Resolution & Smoke Elevation

**Route-collision resolution (deterministic, runs before each LLM repair turn)**:  
Moving pages under a `(protected)` route group leaves a re-export stub at the old flat path. Both resolve to the same URL (route groups don't appear in Next.js URLs) → fatal "parallel pages" error. Previously, the heal loop tried to CREATE the missing file (a stub) → re-introduced the collision → looped forever.

Fix: `resolveRouteCollisionsAtGate()` runs the pure `findRouteCollisions()` engine function before each repair attempt. If it finds exactly one real page + one or more stubs at the same URL, it deletes the stubs deterministically. Ambiguous cases (all-real or all-stub) are left for the LLM. Zero cost on clean builds.

**Error path translation**: `next build` type errors reference generated `.next/types/app/<route>/page.ts` files — not editable sources. `sourceFileForError()` translates these back to `app/<route>/page.tsx` so the repair agent edits the real file. Previously the agent tried to create the generated path → introduced another stub → triggered a new collision.

**Behavioral smoke — role elevation step**:  
The smoke runner now inserts an `elevate` step between CRUD checks and feature checks for auth apps:

```
CRUD checks (default-role user — verifies RBAC denial still works)
  ↓
elevate step (ONLY when spec has a distinct admin role AND ≥1 protected feature):
  run_db_seed → UPDATE users.role = {elevatedRole}
  re-login    → fresh JWT now carries the elevated role
  ↓
feature checks (now run as the authorized elevated user → 200 legitimately)
```

Before this fix, the smoke seeded one default-role user and asserted protected admin features returned 200 — an impossible demand that drove a 69-minute unwinnable heal loop. Now the smoke promotes the user to the highest declared role before checking admin-gated endpoints.

### Layer 7B — Universal LLM Client

All LLM calls (spec, design, ask-mode, fill, heal) go through a single `createLlmClientAsync()` factory. Provider is DB-configured by the Super Admin, not hardcoded.

```
Provider priority:
  1. platform_settings (DB) → Super Admin → AI Models panel
  2. Environment variables
  3. Default: anthropic/direct

Supported: anthropic (direct/vertex/bedrock), openai, google (direct/vertex), glm
All adapters expose identical Anthropic SDK interface → zero caller changes on switch

Model tiers (admin-configurable, mapped from platform_settings):
  opus   → building / planning stages (heavy reasoning)
  sonnet → ask mode, editing, follow-ups
  haiku  → classification, rubric generation, quick checks

Tier auto-selection per message:
  first user turn        → opus
  complex signals        → opus  (architect/refactor entire/redesign)
  short one-liner edits  → haiku (change/fix/color/font ≤120 chars)
  default                → sonnet
```

### Layer 7C — Harness V3 Gates

When `HARNESS_V3=1`, 10 safety gates intercept every tool call inside `runAgentTurn()`:

```
Phases: pre-tool | post-tool | post-response | pre-turn-end

Key gates:
  readBeforeFixGate          — must read a file before writing it
  preferApplyDiffOverRewrite — nudge to apply_diff if file already written this turn
  verifyAfterApplyGate       — must typecheck after applying a diff
  noEmptyBatchWriteGate      — block empty write_file calls
  scaffoldBeforeWriteGate    — block writes before scaffold is confirmed
  conversationalWriteTerminationGate — terminate turn if agent loops on blocked writes

Actions: pass | block (nudge sent back to LLM) | terminate (hard stop)
```

---

### Layer 8 — MCP Server + Dev Worker (Python / AI Core)

```
onenexium-ai-core/

  mcp_server.py  (port 8000)
    FastAPI + FastMCP, namespaced tool sets:
      workspace/  → read / write / list files on project SSD
      codegen/    → generation helpers
      build/      → build lifecycle hooks
      devserver/  → start / stop / status per-project dev servers
      quality/    → typecheck (tsc-service warm path, subprocess fallback), lint
      deploy/     → artifact deployment
      infra/      → infra provisioning
    Auth: HS256 JWT scoped to userId + workspaceId + projectId (MCP_AUTH_TOKEN)

  dev_worker.py  (port 8001)
    → per-project dev server process lifecycle
    → file I/O on local SSD
    → /worker/capacity  (slot availability)

  tsc_service.js  (port 8002)
    → warm per-project ts.WatchProgram instances
    → POST /check {project_id} → {passed, errors[], error_count}
    → avoids cold tsc startup cost on every verify
```

---

### Layer 9 — Data Layer

| Store | What lives there |
|---|---|
| **Postgres** | users, workspaces, projects, project_messages, ai_build_jobs, oce_jobs, credit_tokens, credit_sessions, payment_orders, project_memory_facts, user_memory_facts, ai_episodic_memory, knowledge_patterns, ai_generation_runs, project_execution |
| **Redis** | Distributed lock (lease+renew), SSE event stream (XADD/XRANGE), BuildProgressState JSON (30m TTL), MCP tool cache, rate limits |
| **MinIO** | Project file snapshots, workspace backups (S3-compatible) |
| **Hatchet** | Durable workflow state, child task memoization, concurrency groups |

Key tables not obvious from the name:
- `project_execution` — **Project Execution Record (PER)**: single authority for lifecycle phase (`created→placed→scaffolded→provisioned→building→verified→preview`), assigned worker IP, placement fencing token. Every actor reads phase from here, never recomputes it.
- `ai_episodic_memory` — failure/success pattern learning with pgvector embeddings; scope `"global"` entries shared across all projects
- `knowledge_patterns` — curated engineering patterns injected into LLM context

Drizzle ORM (`server/db/`) with singleton connection (`client.ts`) reused across Next.js HMR cycles.

---

### Layer 10 — SSE Event Flow Back to Browser

```
durableEmit(projectId, jobId)(event)
  ├── appendEvent(projectId, event)       → Redis Stream (XADD, max 500 events, 30m TTL)
  └── updateBuildProgress(projectId, ...) → Redis JSON (BuildProgressState, 30m TTL)
                                             — NOT Postgres; survives reconnect via XRANGE replay

Browser SSE: live turn = POST /api/ai/chat response body;
             reconnect = GET /api/projects/{projectId}/build-stream?lastEventId=…
  └── streams from Redis append log (replay-then-tail)
        → React renders:
            progress bar (phase, round, files written, pages done/remaining)
            milestone pause card  (with continue button → POST /api/ai/chat {mode:continue_building})
            question card         (ai_question — options → POST /api/ai/chat with the answer)
            live preview iframe   (dev_preview_url)
            live URL card         (live_url on deploy)
```

Milestone continue flow:
```
Browser POST /api/ai/chat (continue_building)
  → pushContinue(projectId, reply)
  → events.push("continue:<projectId>")   [Hatchet event bus]
  → durable modules loop resumes from waitForEvent
```

---

## Concurrency & Fairness

```
Per-user cap:    HATCHET_USER_MAX_RUNS = 2   (expression: input.userId, GROUP_ROUND_ROBIN)
Fleet cap:       HATCHET_WORKER_SLOTS = 40   (total across all users / builds)
Fill fan-out:    Promise.allSettled(spawn.map(runChild(scopedWf))) — one child per OCE scope;
                 allSettled barrier tolerates a dead child (NOT bulkRunChildren, which rejects on
                 first failure and abandoned in-flight fills → the false-green bug)
Verify→Heal:     Promise.allSettled barrier — a failed heal child does not abandon siblings
LLM timeouts:    executionTimeout = "20m" per fill/verify/heal task
Module timeout:  executionTimeout = "120m" for the modules loop guard task
```

---

## Complete End-to-End Flow

```
User types message
       │
       ▼
[Browser]
  POST /api/ai/chat ─────────────────────────────── SSE stream back ◄──────────┐
       │                                                                          │
       ▼                                                                          │
[Next.js API]                                                                     │
  auth → classify intent (6 intents)                                             │
    │                                                                             │
    ├─ ask ──────────────► runAskMode() (inline)                                 │
    │                        LLM Q&A rounds → RequirementsDocument               │
    │                        completeness ≥ 85 → mode_change(plan_complete)      │
    │                                                                             │
    ├─ operate ──────────► devserver toolMode, ≤8 rounds (restart/rebuild/logs)  │
    ├─ clarification_answer ► fold answers → resume spec stage                   │
    ├─ continue_building ──► pushContinue() → Hatchet event bus                  │
    │                                                                             │
    └─ build / follow_up ──► credit check → INSERT ai_build_jobs (queued)        │
                                                                                  │
       ▼  (poll every BUILD_WORKER_POLL_MS)                                       │
[PM2: build-orchestrator]                                                         │
  job-runner.ts                                                                   │
    distrib lock → credit check → MCP JWT → freeze flags                         │
       │                                                                          │
       ▼                                                                          │
[HarnessFacade]                                                                   │
    HATCHET_ENABLED? ──yes──► dispatchHatchetBuild()                             │
    │                              Hatchet picks up "oce-build"                  │
    │                              scaffold→spec→design→compile→modules→finalize │
    │                                                                             │
    no (default)                                                                  │
    └──────────────► runOceStageDriver()                                          │
                       PgJobStore + runner.step() loop                            │
                                                                                  │
       ▼  (both paths converge)                                                   │
[Stage Handlers]  (production-runtime.ts)                                         │
    spec    → spec-interpreter.ts  → Universal LLM Client → AppSpec JSON         │
               _confidence < 90? → clarification pause (C1 gate)                 │
    design  → design-agent.ts     → Universal LLM Client → design.md tokens     │
    fill    → runAgentTurn()       → Universal LLM Client + V3 gates             │
    heal    → runAgentTurn()       → Universal LLM Client + V3 gates             │
    compile → OCE engine (deterministic, in-process)                             │
    verify  → MCP typecheck (tsc-service) + smoke gate + route integrity         │
    preview → startDevServer() → dev URL                                         │
       │                                                                          │
       ▼                                                                          │
[Universal LLM Client]                                                            │
    provider = platform_settings DB (admin-configurable)                          │
    anthropic (direct/vertex/bedrock) | openai | google (direct/vertex) | glm    │
       │                                                                          │
       ▼                                                                          │
[McpWorkspace]                                                                    │
    → MCP server :8000  → dev_worker :8001  → project files on SSD               │
                                                                                  │
       ▼                                                                          │
[durableEmit()]                                                                   │
    → Redis Stream (XADD) + Redis BuildProgressState ────────────────────────►─┘
                                                        (browser SSE stream)
```

---

## Follow-up Flow (message on an already-built project)

The flow above is the first build. A **follow-up** (`done → building → done`) routes by what it
CHANGES, not by keywords:

```
built project + message
  → sanitizeResolvedMode R3 → "conversational" → classifyMessage:
       question / operate            → inline answer / devserver op (no build)
       edit|fix (bounded)            → in-place EDIT AGENT (singleEdit)
       structural / compound         → full follow-up job
  → worker executeBuildJob (Hatchet) pre-dispatch gates:
       1. clarify gate  — planFollowup not confident → pause job_paused_user + ai_question
                          (threshold 90, MAX_ROUNDS 3; answer re-dispatches, folded in)
       2. edit-first router:
            media | edit | fix | modify | RENAME | field-add → IN-PLACE EDIT AGENT
            {add | remove}                                   → OCE GROWTH BUILD
  ├─ EDIT AGENT: runAgentTurn edit toolMode (read_file + apply_diff + apply_data_change; no run_command);
  │    forceEditMode pins it; apply_data_change does add_field/rename_entity → compiler regen + data-safe ALTER TABLE
  └─ OCE GROWTH: resolveAppSpec → growAppSpec (chains add=unionSpecs[shrink-proof] · remove=subtractSpec
       [keeps data tables] · rename=ALTER TABLE · modify · edit; own clarify gate; one validate)
       → compile emits __deltaSpawn (changed scopes only) → modules delta pre-pass fills+verifies just those
       → preview → production-gate (regression guard) → finalize.  Injects .onenexium/design.md so new pages match.
```

Data-safety is the whole point: `add`/`rename`/`remove` go through deterministic executors +
migrations (never a blind file edit that would corrupt the schema); pure content/style edits stay in
the fast in-place agent. See LLD → *Follow-up Flow* for the full trace.

---

## Key Design Decisions (brief)

| Decision | Why |
|---|---|
| Compiler-first (OCE) + LLM fill | Deterministic scaffold = fast, correct structure; LLM only touches bounded regions |
| Hatchet durable execution | Survives process eviction/restart; child memoization prevents double-LLM-spend on replay |
| AsyncLocalStorage flag freeze | A mid-build env change cannot split a job across pipelines |
| allSettled heal barrier | One bad heal child does not abandon siblings (partial progress) |
| Redis distributed lock | Single writer per project; lease + renew prevents stale locks on crash |
| Dedicated MCP JWT per job | Scoped credential; MCP server rejects cross-project tool calls |
| tsc-service warm WatchProgram | Avoids cold tsc startup (~3-5s) on every verify round |
| Dead child unblocks parent | OCE §4.1: partial progress is better than a stuck pipeline |
| Universal LLM Client | Provider is DB-configured (admin panel); swap anthropic↔openai↔google without code change |
| Spec/design as targeted calls | spec-interpreter + design-agent are single-shot LLM calls, not multi-round agent loops — faster, cheaper, more predictable output |
| Ask Mode completeness floor (85) | LLM cannot self-declare completion without objective coverage — prevents thin 1-round specs |
| C1 clarification gate | Pause mid-build if spec confidence < 90 rather than guessing — stops ambiguous builds |
| Project Execution Record (PER) | Single authority for lifecycle phase + worker placement; illegal state transitions are structurally prevented |
| Archetype seeds | Starter partial AppSpecs reduce hallucinated structure and steer tier (basic/fullstack) correctly |
| Memory dual-write (.onenexium/ + DB) | Dev worker EC2 loss doesn't lose build context; Postgres snapshot is the fallback |
| S3 sync before trigger_build | CodeBuild reads from S3; without sync it compiles a stale/empty tree |
| Context budget tiers | Prevents any one source (knowledge patterns, AST) from starving conversation history |
| EKS knowledge patterns | Curated engineering reference injected per turn; pgvector semantic search at Tier 3 |
| Loop guards (apply_diff cap + scope violation cap) | Stops deterministic loops early; retrying a compiler-owned file is permanently futile |
| Between-turn compressor (deterministic) | Compresses prior-turn assistant messages without an LLM call — faster, cheaper, no hallucination risk |
| Safety rules in every system prompt | Non-negotiable guardrails against mass delete / hardcoded secrets / framework conversions |
| `operate` intent (6th PrimaryAction) | Dev-env commands ("restart the dev server", "refresh preview") were misrouted to `question` — agent couldn't act. Now routed to devserver toolMode with ≤8 rounds |
| `forceEditMode` pinning | Follow-up router's confirmed edit decision is authoritative; prevents re-classification from upgrading a layout edit to a 100-round full-build config (was: 185 reads / 9 min → now: 25 rounds / 142s) |
| Deterministic route-collision resolution | `next build` parallel-pages errors caused infinite heal loops (agent created stubs → re-introduced collision). Now resolved at the gate: delete stub, keep real page — deterministically, before spending an LLM repair turn |
| Smoke role elevation step | Protected admin features correctly return 401/403 to a default-role user — demanding 200 was unsatisfiable (drove 69-min heal loop). Smoke now promotes the user to the highest declared role before checking admin-gated endpoints |
| `seed` fragment type (LLM-owned files) | `app/(protected)/layout.tsx` was `exclusive` → OCE rebuild reverted sidebar/topbar edits. Changed to `seed`: written on first build, preserved on rebuild. Auth enforced in compiler-owned API handlers, not in the layout |
| Edit toolMode uses clean toolset (no run_command) | Moderate edit turns no longer include `run_command` — the dev-worker sandbox rejected shell commands → wasted rounds. Clean edit toolset: read_file + apply_diff only |

---

## Builder Mode State Machine (Full)

`projects.builderMode` has **14 states**, not the simplified 5 shown earlier:

```
asking → ask_complete → planning → plan_complete → building
                                                      │
                   ┌──────────────────────────────────┤
                   │                                  │
              job_running                        phase_paused (milestone)
              preview_ready                      job_paused_credits
              job_paused_infra                   job_paused_user (clarification)
              job_blocked                        done / error
```

All transitions enforced by `transitionBuilderMode()`. `forceBuilderMode()` is recovery-only.

---

## Context Assembly

Each `runAgentTurn()` rebuilds the system prompt from **5 parallel sources** + memory:

```
context.ts assembles per turn:
  1. workspaces row        — brand (name, industry, brandColor)
  2. projects row          — lifecycle, productionUrl, builderMode
  3. project_pages[]       — declared routes (current app structure)
  4. project_messages[-10] — last 10 turns (short-term memory)
  5. MCP list_files        — live file tree (prevents hallucinated paths)
  + project_memory_facts, user_memory_facts, ai_episodic_memory, knowledge_patterns

Context Budget Controller (199K total):
  Tier 1 (always):       brief + project memory
  Tier 2 (builds):       AST + phase summary
  Tier 3 (first build):  EKS knowledge patterns
  Tier 4 (returning):    episodic memory + memory fork
  → lower tiers trimmed or omitted to guarantee 60K conversation minimum
```

---

## EKS — Engineering Knowledge System

Curated engineering patterns (`knowledge_patterns` table) injected into build context:

```
EKS_ENABLED=1 → selectPatterns() runs on every build turn:
  1. Tag match from build plan (synonym expansion: rbac/auth/dashboard/ecommerce/…)
  2. Industry match from requirements
  3. Semantic search: pgvector cosine distance (dim-filtered, current embedding model)
  4. Token-budget trim to fit Tier 3 allocation
  → formatted knowledge section injected into system prompt
```

Admin uploads patterns via the Super Admin panel; embeddings stored alongside.

---

## Memory Dual-Write

Every `.onenexium/` workspace file is **dual-written** for durability if the EC2 instance is lost:

```
Primary:   MCP write_file → /home/projects/{tenantId}/.onenexium/*
Secondary: projects.builderContext.memorySnapshot (Postgres)

Covers: brief.md, appspec.json, design.md, page specs, conversation history tail,
        LLM-authored fill content (NOT reproducible from AppSpec alone)

Retry queue: MAX 3 retries at 500ms intervals for failed writes
```

---

## S3 Sync Before Production Build

Before `trigger_build` fires CodeBuild, project files are synced from dev-worker disk to S3:

```
syncProjectToAwsBeforeBuild():
  MCP tool: sync_project_to_aws → rsync disk → s3://…/user-projects/{projectId}/
  Timeout: 180s (large trees)
  Without this: CodeBuild reads empty/stale tree → build fails
```

---

## Agent Turn Safety Layer

Every `runAgentTurn()` applies three safety mechanisms inside the tool loop:

```
1. SAFETY_RULES (system prompt, non-negotiable):
   - No mass delete / framework conversion without confirmation
   - No system command buttons (rm, exec, eval, spawn)
   - No hardcoded secrets / localhost URLs

2. Loop guards (loop-guards.ts):
   - apply_diff fails 3× on same file → strip apply_diff from toolset
   - Scope violations ≥ 6 → hard-stop the turn (deterministic, retries futile)

3. Tool execution policy (tool-exec-policy.ts):
   - Per-tool timeouts (30s–420s based on tool type)
   - FORCE_SEQUENTIAL_TOOLS: trigger_build, batch_write, run_quality_suite run alone
```

---

## Execution Phase Machine (PER)

`project_execution` table is the **single authority** for where a project is in its lifecycle. Every worker reads placement/phase from here — nothing recomputes it independently.

```
Phase lifecycle:
  created → placed → scaffolded → provisioned → building → verified → preview

  Terminal (from any active phase):
    blocked | failed | cancelled

  Paused (recoverable):
    paused_infra | paused_credits

Fencing token: placementEpoch (bumped on each worker (re)assignment).
Precondition guards are pure functions — illegal transitions are structurally refused before any work starts.
```

---

## Layer 11 — Publish / Deploy Pipeline (`publish-from-dev.ts` → CodeBuild → ECR → Traefik)

**User-triggered, not automatic.** Reaching `production-gate` + smoke leaves the project
`preview_ready` (a live DEV preview) and *unlocks the Publish button*. Deploy-to-a-live-URL happens
when the user clicks **Publish** — a separate durable background worker (`publishFromDevPreview`) that
survives refresh and streams over SSE. It also **provisions the production database + pushes schema +
seeds test logins** — a whole phase the old doc omitted:

```
publishFromDevPreview(projectId, userId, emit):   status: validating → syncing → building → deploying → live
  ↓ syncing:  sync_project_to_aws (dev-worker SSD → S3 user-projects/{projectId}/)
  ↓ building: trigger_build → AWS CodeBuild "onenexium-site-builder"
                → Docker build (Next.js standalone) → push image to ECR ({tenantId}:{buildId})
                → poll status (emit building %); on failure → fetch errors[] → throw
  ↓ deploying — PRODUCTION DATA LAYER:
       a. if !prodNeonProjectId: provision_production_database → save projects.prodNeonProjectId
             (LOCAL_INFRA=local → app_<hex>_prod PG; prod → Neon API; assigned ONCE on first publish)
       b. run_production_setup { schema_push, seed_accounts = buildSeedAccounts(owner + role logins) }
       c. persist builderContext.seededLogins = [{email, role, password}]  (one-time test creds)
  ↓ deploying — CONTAINER:
       start_container (ECS task) → productionUrl ; register_traefik_route → {subdomain}.sites.onenexium.com
         (TLS via ACM; optional register_custom_domain) ; verifyDeploymentReachable (health probe)
  ↓ live:
       UPDATE projects SET status="live", productionUrl, liveBuildJobId, previewUrl=null, devServerStatus="stopped"
       emit { status:"live", url, accounts:[{email,role,password}] }   ← passwords delivered ONCE
         (sanitizePublishEventForStorage strips them from the durable log)
```

`status`: `preview_ready` (built, dev preview) → `live` (published). `builderMode` stays `done`.

The deploy MCP namespace (`deploy/`) provides: `build_docker_image`, `start_container`, `start_preview_container`, `promote_preview_to_live`, `stop_preview_container`, `teardown_site`, `register_traefik_route`, `register_custom_domain`, `run_smoke_tests`.

---

## Layer 12 — Skill System

A lightweight, on-demand injection mechanism to deliver focused instructions **only when needed** — avoiding the token waste of always-on specialized instructions:

```
SkillId: crud_api | auth_flow | data_table | form_builder | dashboard_layout
         responsive_nav | image_gallery | search_filter | chart_widget | landing_page

Activation: skill.triggers.some(rx => rx.test(userMessage))
  → skill.instructions appended to system prompt THIS TURN ONLY
  → skill.requiredTools added to available toolset THIS TURN ONLY
```

**Why**: LLM turns are context-budget-constrained (199K). Always injecting all domain instructions wastes ~15–20K tokens per turn. Skills make the instruction set adaptive — a form-builder turn gets form-builder guidance, a chart turn gets charting guidance.

---

## Layer 13 — AWS Infrastructure Layer

### Secrets Management

Project-level secrets (API keys, DB credentials generated at deploy time) are indexed in the `project_secrets` table (metadata only — key names + scope) but **stored in AWS Secrets Manager** at `{AWS_PROJECT_SECRETS_PREFIX}/{projectId}/{key}`. This prevents secret values ever touching Postgres.

Platform-level secrets (ANTHROPIC_API_KEY, MCP_AUTH_TOKEN, database DSN) are loaded from **Secrets Manager / SSM Parameter Store at orchestrator worker startup** (`bootstrap-runtime-env.ts`) — no plaintext in `.env` files on production.

### S3 Buckets

```
user-projects/{projectId}/     ← project source (CodeBuild input)
user-projects/{projectId}/assets/  ← media uploads (indexed by project_assets)
workspace-templates/           ← template preview images
```

### Agent Turn: Remaining Seams

Three additional modules in `agent-turn/` run transparently on every turn:

- **tool-result-shaping**: `trimToolResult` condenses large MCP responses before they re-enter context; `evictOldToolResults` replaces old round results with compact summaries when context > 160K
- **tool-pairing repair**: Anthropic API requires every `tool_use` block to be paired with a `tool_result`. Hatchet replay or message compaction can break this pairing — `repairToolPairing()` inserts synthetic `tool_result` blocks for orphaned `tool_use` blocks before the API call
- **page-progress**: Maps written file paths → route names, derives `buildPhase`, emits `build_progress` SSE events with `pagesCompleted[]` / `pagesRemaining[]`

---

*Last updated: 2026-07-10. Update in the same session you change the system.*
