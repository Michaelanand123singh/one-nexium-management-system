# OneNexium — Low-Level Design (LLD)

> **Source**: Live codebase, feat/prince-chat-panel branch, 2026-07-10.  
> Paired with `ONENEXIUM_HLD_V2.md`. Update both when the system changes.

---

## Table of Contents

1. [Layer 0 — Browser / Frontend](#layer-0--browser--frontend)
2. [Layer 1 — Next.js API Route](#layer-1--nextjs-api-route)
3. [Layer 2 — Build Orchestrator Worker](#layer-2--build-orchestrator-worker)
4. [Layer 3 — Job Runner (per-job gate)](#layer-3--job-runner-per-job-gate)
5. [Layer 4 — Pipeline Router (HarnessFacade)](#layer-4--pipeline-router-harnessfacade)
6. [Layer 5A — OCE Stage Driver (non-Hatchet)](#layer-5a--oce-stage-driver-non-hatchet)
7. [Layer 5B — Hatchet Durable Execution](#layer-5b--hatchet-durable-execution)
8. [Layer 6 — OCE Compiler Engine](#layer-6--oce-compiler-engine)
9. [Layer 7 — Stage Handlers (production-runtime)](#layer-7--stage-handlers-production-runtime)
10. [Layer 8 — MCP Server + Dev Worker](#layer-8--mcp-server--dev-worker)
11. [Layer 9 — Data Layer (Full Schema)](#layer-9--data-layer-full-schema)
12. [Layer 10 — SSE Event System](#layer-10--sse-event-system)
13. [Cross-Cutting: Distributed Lock](#cross-cutting-distributed-lock)
14. [Cross-Cutting: Billing / Credit Engine](#cross-cutting-billing--credit-engine)
15. [Cross-Cutting: Memory System](#cross-cutting-memory-system)
16. [Cross-Cutting: Observability](#cross-cutting-observability)

---

## Layer 0 — Browser / Frontend

### Entry point

`onenexium_platform/features/project-editor/`

### Chat submit flow

Verified against `features/project-editor/lib/use-ai-stream.ts`.

1. User types in the chat input (hook: `use-ai-stream.ts`).
2. Client calls `POST /api/ai/chat` (header `Accept: text/event-stream`) with
   `{ projectId, message, mode?, attachments? }`. **There is no separate events endpoint —
   the POST response body *is* the live SSE stream for this turn.** (`mode` is the field name,
   not `action`; `message` not `content`; `clarifyAnswers` is not sent at submit.)
3. On **423 PROJECT_BUSY** (lock held by an active build): a free-text message (no `mode`) is
   handed to `opts.onQueued(message)` — persisted and fired after `job_completed`; a
   mode-triggered action retries at `[2s, 4s, 8s]` before surfacing a "project is busy" error.
4. Reconnect / durable observation (refresh, dropped stream, browser reopened mid-build) uses
   **two project-scoped endpoints**, keyed by `lastEventId` — never `/api/ai/events`:
     - `GET /api/projects/{projectId}/build-stream?lastEventId=…` — SSE observer
       (`build-stream/route.ts`): if no job is running it returns JSON `{done:true,…}`; otherwise
       it replays missed events from the Redis event store via `getEventsSince()`, then tails
       every **750ms** (`TAIL_INTERVAL_MS`) until the job is terminal (+4.5s quiescence, 6 ticks)
       or a `previewUrl` appears → emits `done`. Max lifetime 5 min.
     - `GET /api/projects/{projectId}/build-status?lastEventId=…` — JSON poll fallback.
5. Events arrive as `text/event-stream` lines and are dispatched to React state:

| Event type | UI action |
|---|---|
| `job_started` | reset progress bar, clear stale pause cards |
| `build_progress` | update phase label, round counter, file counts |
| `dev_preview_url` | inject into preview iframe |
| `live_url` | show LiveUrlCard |
| `milestone_pause` | render MilestonePauseCard with Continue button |
| `ai_question` | render QuestionCard with options (ask mode; one event per question) |
| `text` | stream assistant tokens into the bubble |
| `completeness` / `plan_ready` | ask-mode score / planning blueprint |
| `mode_change` | transition editor state (asking / planning / building / done) |
| `job_completed` / `done` | mark done, fire any pending follow-up messages |
| `error` | show ErrorCard |

### MilestonePause continue

User clicks Continue → `POST /api/ai/chat { mode: "continue_building" }` → server calls `pushContinue(projectId, reply)` → `events.push("continue:<projectId>")` → Hatchet `waitForEvent` resolves.

### Build progress state (persisted across reconnect)

`BuildProgressState` is stored in Redis (30-minute TTL). On reconnect, the `build-stream` observer
replays events from the Redis Stream via `getEventsSince(lastEventId)` (`XRANGE`), then tails. The
milestone pause and `pendingClarification` (question-card) payloads are also persisted in
`BuildProgressState` so they rehydrate correctly without re-querying Postgres.

---

## Layer 1 — Next.js API Route

### Files

- `app/api/ai/chat/route.ts` — main chat handler
- `app/api/ai/build-jobs/route.ts` — status polling endpoint

### `POST /api/ai/chat` — detailed flow

The handler is a **guard chain, then a mode dispatch** — it does NOT classify intent into
PrimaryActions at entry (that only happens inside the `conversational` branch, and inside the
build worker). Dispatch is driven by `resolvedMode`, derived from the client `mode` field
reconciled against DB truth by `sanitizeResolvedMode()`. The route **always returns the SSE
stream** (`new Response(sse.stream)`), never a JSON `{ jobId }`.

**Entry guard chain (exact order, `route.ts`):**

```
1. bootstrapRuntimeSecrets()                              (non-fatal; secrets may already be in env)
2. requireUserId()                                        → 401 Unauthorized
3. parseBody(req)                                         → 400 (projectId+message required,
                                                             message ≤ 12 000 chars, ≤ 5 attachments,
                                                             optional idempotencyKey)
4. assertOwnsProject(userId, projectId)                  → 404 (missing) / 403 (other user)
                                                            returns { workspaceId, builderMode, status }
5. checkRateLimit("chat", userId)                        → 429 (+ Retry-After header)
6. activeUsers.set(userId, now)
7. if idempotencyKey → checkAndSetDedup(projectId, key)  → 409 DUPLICATE_REQUEST { existingRunId }
8. isConversationalMode = (mode === "conversational")
9. project lock:
     conversational → SKIP (fake acquired lock — Q&A must not block on a running build)
     else → acquireProjectLock(projectId, { ttlMs: 180_000, waitMs: 8_000 })
                                                         → 423 PROJECT_BUSY (also clears dedup)
10. checkAiReady() + ANTHROPIC_API_KEY                   → 503 AI_NOT_CONFIGURED
                                                            (releases lock, clears dedup)
────────────────────────────────────────────────────────────────────────────────────────
11. resolvedMode = sanitizeResolvedMode(mode, builderMode, status)   ← the real dispatch key (Layer 1: Mode Resolution)
12. billing reserveForChat() + mode dispatch (ask / plan / conversational / build)  (see below)
13. return new Response(sse.stream)                       ← ALWAYS an SSE stream
```

The per-mode branches (ask, plan, conversational, build-kickoff) and their credit/dispatch
details are documented in the **Mode Resolution** and **Mode Dispatch** subsections that follow.
`classifyMessage()` / `resolveExecutionConfig()` (the 6-PrimaryAction model documented below) run
only for the `conversational` branch and inside the build worker — not at route entry.

### Mode Resolution — `sanitizeResolvedMode()` (`route.ts:853`)

The single source of "what is this turn?". A client button sends a `mode`; this function decides
whether to **trust it or override it with DB truth** (`builderMode`, `status`). The guiding rule:
*only explicit user button-clicks may override the DB; a stale client cache must never force a
build or re-open ask mode.* Evaluated as an ordered ladder — first match wins:

```
sanitizeResolvedMode(clientMode, dbBuilderMode, projectStatus):

  R0  clientMode == "conversational"                         → "conversational"
        (always trusted — questions / status while a build runs; bypasses the lock)

  R1  clientMode == "confirm_requirements"
        AND dbBuilderMode ∈ {planning, scaffolding, building, verifying, done,
                             job_running, job_blocked, job_paused_credits,
                             job_paused_infra, job_paused_user}                  → "conversational"
        (STALE-START GUARD: a replayed "Start building" can't double-start a build already past ask)

  R2  compute `raw` — trust the client mode ONLY if:
        clientMode ∈ {confirm_requirements, approve_plan, continue_building}  (EXPLICIT_ACTION)
        OR  clientMode ∈ {ask, plan} AND isNewProject (dbBuilderMode null|"asking")  (INITIAL_TRUSTED)
      → raw = clientMode
      else → raw = dbBuilderMode            (server truth wins; a stale "build"/"ask" is ignored)

  R3  BUILT-PROJECT REGRESSION GUARD:
        isBuilt = (status=="preview_ready" || dbBuilderMode ∈ {done, building})
        if isBuilt AND raw ∈ {null, done, building, asking, ask, ask_complete,
                              plan_complete, planning, plan, error}             → "conversational"
        (a finished project can never re-enter ask/plan — that path is a tool-less loop;
         any non-action turn becomes a conversational edit via runAgentTurn + write tools)

  R4  return raw
```

**Worked cases:**

| clientMode | dbBuilderMode | status | → resolvedMode | why |
|---|---|---|---|---|
| `ask` | `null` | — | `ask` | new project, initial-trusted |
| `plan` | `asking` | — | `plan` | new project, initial-trusted |
| `confirm_requirements` | `ask_complete` | — | `confirm_requirements` | valid start → build kickoff |
| `confirm_requirements` | `building` | — | `conversational` | R1 stale-start guard |
| `build` (stale cache) | `asking` | — | `asking` | R2 — client mode not trusted, DB wins → ask mode |
| `ask` | `done` | `preview_ready` | `conversational` | R3 regression guard |
| *(none)* | `building` | — | `conversational` | R3 — no client mode, DB fell through |
| `continue_building` | `job_paused_user` | `building` | `continue_building` | explicit action, not a non-action raw |

`resolvedMode` then drives dispatch (Mode Dispatch, next): `ask/asking`→`runAskMode`,
`plan/planning/plan_complete`→`runPlanningMode`, `confirm_requirements|approve_plan|continue_building|
ask_complete`→build kickoff (`dispatchBuildTurn`), `conversational`→`classifyMessage` routing,
default (`building|build|done|error|null`)→detached worker dispatch. `mapResolvedModeToBillingTier()`
maps each to a billing tier (asking / planning / building).

### Mode Dispatch — pre-dispatch setup + the 5 branches (`route.ts:272–685`)

**Pre-dispatch (runs for every mode):**

```
1. isBuildMode = resolvedMode ∈ {confirm_requirements, approve_plan, continue_building,
                                 ask_complete, building, build, null}
2. if isBuildMode → lock.release()   (delegate execution to the PM2 worker; the worker takes
                                       its own lock — holding it here would deadlock job pickup)
3. billingMode = mapResolvedModeToBillingTier(resolvedMode)
     asking|ask|ask_complete → "asking";  conversational → "asking"
     planning|plan|plan_complete|confirm_requirements → "planning"
     building|build|approve_plan|continue_building|default → "building"
4. reservation = reserveForChat({ userId, mode: billingMode, turnId, message })
     ⚠ NON-BLOCKING: insufficient_funds does NOT 402 — the build proceeds on a default budget
       ("credits determine budget SIZE, not access"). engine_disabled|internal → no hold.
     creditSessionId = reservation.ok ? sessionId : null
5. sse = createSseStream(); startSseKeepalive(); updateBuildProgress(phase:"designing")
6. two emitters:
     durableEmit(event) = sse.send(event) + appendEvent(Redis store) + updateBuildProgress(...)
     relayEmit(event,id) = sse.sendWithId(...)  (worker-persisted events — does NOT re-append)
7. runInput = { userId, projectId, workspaceId, userMessage: actionPrompt.runMessage,
                emit: durableEmit (surface-wrapped), isClosed, creditSessionId, correlationId,
                chatSurface = isBuildMode ? "builder" : "conversational", attachments? }
```

**The 5 dispatch branches** (`runner = …`):

```
A. confirm_requirements | approve_plan | continue_building | ask_complete   → BUILD KICKOFF
     emit status + build_progress(planning)
     if continue_building && hatchetEnabled() → pushContinue(projectId, message)  (unpark Hatchet wait)
     if continue_building && paused job → updateBuildJob.checkpoint {
         milestoneResumed:true, questionAnswers (if pendingQuestions), milestoneReply } + clear pause card
     ensureBuilderProjectScaffolded()  →  transitionBuilderMode("building")  →  emit mode_change(building)
     generateAmbientInsights()  (fire-and-forget)
     dispatchBuildTurn(runInput+relayEmit)                 ← creates ai_build_jobs, worker executes

B. conversational                                                            → LLM-ROUTED
     if paused job (job_paused_user, !milestoneResumed) → same checkpoint resume as (A) [free-text resume]
     u = classifyMessage(message)
       isAction   = u.primary ∉ {question, operate}
       useSingleEdit = (u.primary ∈ {edit, fix}) && !u.isCompound
     if isBuiltProject(status=preview_ready|builderMode=done) && isAction && !hasActiveJob:
         emit mode_change(building); lock.release(); dispatchBuildTurn({…, singleEdit: useSingleEdit})
     else: runAgentTurn(runInput)                          ← inline answer, or edit while a job is active

C. asking | ask          → runAskMode(runInput)          (+ emitExecSpan "requirements gathering")
D. planning | plan       → runPlanningMode(runInput)     (+ emitExecSpan "plan review")
   plan_complete         → runPlanningMode(runInput)
E. default (building | build | done | error | null)      → transitionBuilderMode("building") + dispatchBuildTurn()
```

**After `runner` settles** (`.then/.catch/.finally`): `markBuildComplete(status)`, credit
`settleForChat()` (sums generation-run tokens for build turns), dedup link (`setDedupRunId`), lock
release (if not already released to the worker), keepalive stop. The handler then returns
`new Response(sse.stream)`.

> Note: `runAskMode` / `runPlanningMode` are **dedicated engines**, not `runAgentTurn({mode})`.
> Only `conversational` and the build worker use `runAgentTurn`.

### Message Understanding Layer (`server/ai/message-understanding.ts`)

Two-tier classifier — produces `MessageUnderstanding` (rich structured output):

```typescript
PrimaryAction = "build"|"edit"|"fix"|"question"|"deploy"|"continue"|"refactor"|"operate"
MessageUnderstanding = {
  primary: PrimaryAction
  secondary: PrimaryAction | null
  scope: { level: "global"|"module"|"page"|"component"|"style"|"config", targets: string[] }
  constraints: UserConstraint[]     // { type: "exclude"|"priority"|"ordering"|"style", description }
  isCompound: boolean
  complexity: "trivial"|"moderate"|"large"
  confidence: number                // 0.0–1.0
}
```

**Tier 1 — Haiku LLM** (sole authoritative classifier):
- Old regex fast-path removed — it misread bug reports as `question` ("can you check why?" → "question", no code written)
- `classifyWithLlm()`: Haiku + CLASSIFIER_SYSTEM_PROMPT, timeout = AI_CLASSIFIER_TIMEOUT_MS (default 6000ms)
- Response = JSON up to 200 tokens, validated+normalized by `validateAndNormalize()`
- `operate` disambiguation in prompt: target is the key ("rebuild the PAGE" = edit; "rebuild the PREVIEW/server" = operate)

**Tier 2 (fallback)**: `fallbackClassification()` — regex legacy classifier, only when Haiku is unreachable (network/timeout/rate limit). Biases toward ACTION so a transient failure never silently turns a change request into a chat-only reply.

**Legacy compatibility**: `toLegacyIntent()` maps `operate → "question"` for old callers. Real routing is on `primary === "operate"` in execution-resolver, not the legacy value.

### Execution Resolver (`server/ai/execution-resolver.ts`)

`resolveExecutionConfig(understanding, projectState, opts?)` → `ExecutionConfig`:

```typescript
ExecutionConfig = {
  toolMode: "question"|"edit"|"devserver"|"agent"
  maxRounds: number
  modelTier: "editing"|"building"
  outputEffort: "low"|"medium"|"high"
  toolOutputBudget: "compact"|"standard"|"generous"  // decoupled from outputEffort
  enablePhaseDirective: boolean
  enableTaskDecomposition: boolean
  enableFileResolver: boolean
  enableReaderAgent: boolean
  enableSkillActivation: boolean
  enableGoalsInjection: boolean
  enableDevPreview: boolean
  enableSchemaReinjection: boolean
  enableAskModeCompaction: boolean
  constraints: UserConstraint[]
  secondaryAction: PrimaryAction | null
}
```

**toolMode routing**:
```
operate                             → devserver
question (no context)               → question
question (has pageSpecs or plan)    → devserver
deploy                              → agent
forceEditMode || (edit|fix non-large) → edit   // clean toolset: read+apply_diff, NO run_command
everything else                     → devserver
```

**maxRounds**:
```
operate           → 8          (AI_OPERATE_MAX_ROUNDS, env-tunable)
trivial edit/fix  → 25         (AI_EDIT_MAX_ROUNDS)
moderate edit/fix → 60         (AI_EDIT_MODERATE_MAX_ROUNDS)
question (bare)   → 3
build/large       → configuredMax (100, AI_MAX_ROUNDS)
```

**toolOutputBudget** (per-round token budget for tool calls, decoupled from `outputEffort`):
```
question (read-only) → compact  (4096)   — the ONLY place 4096 is correct
large work           → generous (128000)
everything else      → standard (65536)

Why: a message phrased as a question ("can you fix the navbar?") may be promoted to
devserver toolMode. Without this field, it inherited the 4096 outputEffort ceiling
and every large write truncated. toolOutputBudget is driven by what the session can
DO, not how the message was phrased.
```

**`forceEditMode`** (opts.forceEditMode):
```
The upstream follow-up router sets this when it has already decided all planned ops
are targeted in-place edits (no structural change). This decision is AUTHORITATIVE —
the fresh re-classification in resolveExecutionConfig must not override it.

Without this: the classifier independently rated a layout edit as "build/large" →
fell to devserver (100 rounds + run_command) → agent roamed the entire app:
185 reads, 9 minutes. forceEditMode pins to edit (clean toolset, ≤60 rounds).
Measured after fix: same layout edit → 25 rounds, 142 seconds.
```

### Reconnect / observation stream (`GET /api/projects/{projectId}/build-stream`)

There is **no `/api/ai/events` route**. The live turn streams from the `POST /api/ai/chat`
response body; durable reconnection is served by this project-scoped observer
(`app/api/projects/[projectId]/build-stream/route.ts`):

```
1. requireUserId() → 401; requireProjectAccess() → 403
2. lastEventId = ?lastEventId query param
3. if !isBuildSessionRunning(activeJob, progress):
     return JSON { done:true, progress, activeJob }        ← NOT an SSE stream
4. replay: getEventsSince(projectId, lastEventId) → sse.sendWithId(id, event)   (Redis event store)
5. tail loop every TAIL_INTERVAL_MS = 750ms:
     newEvents = getEventsSince(projectId, lastSentId) → emit by id
     if !isBuildSessionRunning: quiescenceCount++
        emit `done` once (quiescenceCount ≥ 6  →  4.5s window)  OR  a previewUrl exists
6. hard stop at MAX_LIFETIME_MS = 5 min → emit `done`
```

`GET /api/projects/{projectId}/build-status?lastEventId=…` is the JSON poll fallback for the
same data (status + incremental events) when SSE isn't used.

---

## Layer 2 — Build Orchestrator Worker

### Build dispatch → `ai_build_jobs` row (platform side: `dispatch.ts` + `orchestrator.ts`)

Before the worker sees anything, the route's build-kickoff branches call `dispatchBuildTurn()`.
This runs **in the platform process**; it creates the durable job row and then only *observes* it.

```
dispatchBuildTurn(params):
  1. persist the kickoff user message to project_messages   (best-effort;
       userMessagePersisted=true so the worker does NOT re-insert it → no chat flooding)
  2. enqueueBuildJob():
       a. clearCancelSignal(projectId)   ← a stale 60s cancel signal would else self-kill this job
       b. startOrResumeBuildJob():
            isSingleEdit ? itemsTotal=1 : load work queue → itemsTotal = queue.items.length
            ── DEDUP (one active job per project) ──
            existing = resumable[0] ?? getActiveBuildJobForProject(projectId)
            if existing → updateBuildJob(existing.id, { status: paused_infra?→queued,
                            itemsTotal, itemsVerified, checkpoint.runContext }) ; return {created:false}
            else        → createBuildJob({ status:"queued", itemsTotal, runContext }) ; {created:true}
       c. saveJobRunContext(jobId, runContext)
  3. emitDurableBuildEvent("build_handoff", { jobId })
  4. observeBuildJob({ projectId, jobId, emit })  ← SSE observer only; the WORKER executes the job
```

A second dispatch for a project with a live job **resumes** it (merges the new `runContext`), never
duplicates — the structural guarantee behind "one build per project".

`ai_build_jobs` row at creation: `status:"queued"`, `checkpoint.runContext` =
`{ userMessage, userMessageDisplay?, workspaceId, correlationId?, creditSessionId?, attachments?,
editorRequestHostname?, singleEdit?, userMessagePersisted? }` (verified against the laptop-store job:
checkpoint held `runContext` + later `hatchetRunId`, `milestonePause`, `milestoneReply`,
`milestoneResumed`).

### File: `server/ai/build-jobs/worker.ts`

### Startup sequence (one-time, ordered)

```
1. registerShutdownHandlers()            — SIGTERM/SIGINT → re-queue in-flight jobs
2. bootstrapRuntimeSecrets()             — load .env / AWS Secrets Manager
3. bootstrapExecutionPlane()             — seed dev_instances table, start health sweep
4. startInstanceHealthSweep()            — periodic ping every instance, flip status
5. ensureBuildJobsSchema()               — idempotent DDL (ai_build_jobs, checkpoints)
6. setOceRuntimeFactory(productionRuntimeFactory)  — inject production handlers
7. getProductionJobStore().init()        — ensure oce_jobs table exists
8. startHatchetWorker()                  — no-op unless HATCHET_ENABLED=1
```

### Poll loop

```
interval = BUILD_WORKER_POLL_MS (default 2000ms)   (setInterval in worker.ts)

if isConcurrentWorkerEnabled():
  tick = fillBuildWorkerPool()    ← non-blocking; pool manages N concurrent jobs
else:
  tick = processBuildJobQueue(8)  ← sequential, drains up to 8 queued jobs
```

### Worker pool internals (`worker-pool.ts`)

```
BuildWorkerPool {
  capacity: BUILD_WORKER_CONCURRENCY (default 12, hard cap 16)
  active: Set<Promise>
}

fillBuildWorkerPool():
  available = capacity - active.size
  jobs = claimExecutableBuildJobs(available)   ← FOR UPDATE SKIP LOCKED
  for each job: active.add(runJob(job))
  return { launched, active: active.size }
```

### Graceful shutdown

On SIGTERM: all `inFlightJobIds` are re-queued to `status: "queued"` before process exits so no build is lost.

---

## Layer 3 — Job Runner (per-job gate)

### File: `server/ai/build-jobs/job-runner.ts`

The per-job path is **two functions**: `processOneJob` (the lock wrapper) calls `executeBuildJob`
(claim + route + run). The credit "gate" is a **resume-gate only** — a fresh `queued` build is never
credit-checked before starting (verified: `checkBuildCredits` is called ONLY in the
`job_paused_credits` branches). Insufficient credits mid-build → the pipeline RETURNS
`job_paused_credits` (a resumable pause + BuildBlockedCard), never a hard abort at start.

**`processOneJob(job, lockWaitMsOverride?)` — the lock wrapper (`job-runner.ts:1184`):**

```
1. if job_paused_user && !milestoneResumed            → return false   (still waiting on the user)
2. if isCancelSignalled(projectId)                    → cancelBuildJob + return false
3. if job_paused_credits: if !checkBuildCredits.canBuild → return false  (RESUME-gate; still can't afford)
4. lock = acquireProjectLock(projectId, {              ← heartbeat-driven LEASE, not a fixed TTL
       ttlMs: LOCK_LEASE_TTL_MS,
       waitMs: queued|paused → BUILD_JOB_LOCK_WAIT_MS ; active job → 0 (skip, retry next tick) })
     if !lock.acquired                                → return false
   renewTimer = setInterval(lock.renew, LOCK_LEASE_RENEW_MS).unref()   ← live worker keeps lease alive;
                                                                          dead worker → lease auto-expires
5. try { await executeBuildJob(job.id); return true }
   finally { clearInterval(renewTimer); await lock.release() }
```

**`executeBuildJob(jobId)` — claim → route → run (`job-runner.ts:467`):**

```
A. Status ladder (make the job runnable):
     job_paused_credits → checkBuildCredits.canBuild ? status=queued : return   (resume path)
     job_paused_infra   → past checkpoint.infraRetryAt ? status=queued : return
     job_paused_user    → milestoneResumed ? (status=queued, clear flag) : return
     guard: status ∈ {queued, building, verifying, scaffolding} else return
     if active + heartbeat stale (> BUILD_JOB_STALE_MS) → requeueStaleJob
B. CLAIM: if queued → claimQueuedBuildJob(id)   ← atomic (FOR UPDATE SKIP LOCKED + claim-lease); !claimed → return
C. loadRunContext(job) ; ensure correlationId
D. HATCHET ROUTING (only if hatchetEnabled()):
     1. if checkpoint.hatchetRunId → return                       (IDEMPOTENCY — already dispatched)
     2. if pauseHatchetFollowupIfUnclear(job, runContext) → return (follow-up clarification gate, pre-dispatch)
     3. editRoute = resumedFromUserPause ? {isEdit:false} : hatchetFollowupIsEdit(job, runContext)
          if isEdit  → runContext.singleEdit=true (+editTargets); FALL THROUGH to inline edit agent
          else       → dispatchHatchetBuild({projectId, userId, jobId, userMessage, clarifyAnswers?})
                       → updateBuildJob(checkpoint.hatchetRunId = runId) → return
                          (the Hatchet workflow runs + finalizes THIS row; see Layer 5B)
E. INLINE EXECUTION (non-Hatchet path, OR an edit-routed follow-up):
     mint MCP credential (createMcpCredential + runWithMcpCredential ALS; heartbeat renews the JWT)
     job heartbeat: setInterval(touchJobHeartbeat, BUILD_JOB_HEARTBEAT_MS)
     runWithHarnessDecision(freeze OCE/HARNESS_V3 flags in ALS) → HarnessFacade.runJobOrchestrator(params)
F. On success:
     forceBuilderMode("done", result.previewUrl ? { status: "preview_ready" } : undefined)
       (forceBuilderMode because done→done is an INVALID transition that would drop the extraField)
     emit job_completed
G. On failure: failure taxonomy (transient / repairable / terminal — below)
```

> On the **Hatchet path**, steps E–F run inside the Hatchet workflow instead (`finalizeBuild` does the
> `forceBuilderMode("done", {status:"preview_ready"})`). Inline path finalizes here.

### Failure taxonomy (`failure-taxonomy.ts`)

| Type | Condition | Action |
|---|---|---|
| `transient` | network/infra/rate-limit errors | retry up to 10× |
| `repairable` | policy/guard rejection | retry up to 3× |
| `terminal` | max retries exceeded, corrupt data | fail job |

Livelock detection: identical `buildFailureFingerprint()` across retries → immediate terminal.

### `durableEmit(projectId, jobId)` → `(event) => void`

```
appendEvent(projectId, event)    — Redis Stream XADD
updateBuildProgress(projectId, …) — Redis SET (BuildProgressState JSON)
```

---

## Layer 4 — Pipeline Router (HarnessFacade)

### File: `server/ai/harness-v3/harness-facade.ts`

### Decision tree

```
HarnessFacade.runJobOrchestrator(params):
  if oceEnabled(params.projectId):    → runOceStageDriver(params)
  if harnessV3Enabled(projectId):     → runCoordinatorOrchestrator(params)
  else:                               → runBuildJobOrchestrator(params)  [legacy]
```

### Feature flag internals (`feature-flags.ts`)

```
AsyncLocalStorage<boolean> decisionStore

runWithHarnessDecision(projectId, fn):
  decision = readEnvDecision(projectId)   ← HARNESS_V3 + allowlist
  decisionStore.run(decision, fn)

harnessV3Enabled():
  snapshot = decisionStore.getStore()
  if snapshot != null: return snapshot    ← frozen for current job
  return readEnvDecision()               ← live read (scripts/tests)

oceEnabled(projectId):
  env OCE_ENABLED=1 + optional OCE_ALLOWLIST_PROJECTS

hatchetEnabled():
  env HATCHET_ENABLED=1
```

### Hatchet path (inside `executeBuildJob`, before the inline HarnessFacade path)

Full routing is in Layer 3 → `executeBuildJob` step D. It is **not** a bare "dispatch if enabled" —
there are three gates before dispatch:

```
if hatchetEnabled():
  1. if checkpoint.hatchetRunId → return                        (IDEMPOTENCY — no second run on re-claim)
  2. if pauseHatchetFollowupIfUnclear(job, runContext) → return (FOLLOW-UP CLARIFY GATE — pre-dispatch,
       because the in-build spec clarify signal is stripped on the Hatchet path)
  3. editRoute = hatchetFollowupIsEdit(job, runContext):
       isEdit → runContext.singleEdit=true; FALL THROUGH to the inline edit agent (fast, in-place)
       else   → runId = dispatchHatchetBuild({ projectId, userId, jobId, userMessage, clarifyAnswers? })
                updateBuildJob(checkpoint.hatchetRunId = runId) ; return   ← Hatchet runs + finalizes the row
```

---

## Layer 5A — OCE Stage Driver (non-Hatchet path)

### File: `server/ai/harness-v3/oce/oce-stage-driver.ts`

### `runOceStageDriver(params)` — sequence

```
1. Resolve AppSpec:
     existing = loadAppSpecFromWorkspace(projectId)   ← MCP read .onenexium/appspec.json
     if existing && params.userMessage:
       spec = mergeAppSpec(existing, params.userMessage)   ← follow-up delta
     else:
       spec = null   ← spec stage will generate it

2. Build inputHash:
     hash = sha256(stable-JSON({ userMessage, spec }))
     prior = store.findByInputHash(projectId, hash)
     if prior is "done": return earlyResult(prior)   ← idempotent replay (§3 G5)

3. Enqueue root job:
     store.enqueue({
       projectId,
       stage: "scaffold",
       payload: { userMessage, clarifyAnswers, spec },
       inputHash
     })

4. runFleet(store, workspace, handlers, hooks):
     loop:
       job = store.claim()
       if !job: break
       await step(store, workspace, handlers, job, hooks)

5. Map result → OrchestratorResult { pagesBuilt, filesWritten, previewUrl }
```

### `runFleet` — concurrency model

```
OCE_LLM_CONCURRENCY = min(env OCE_LLM_CONCURRENCY, 12)  default 10

det-role slots: unlimited (compile/verify/preview are fast, CPU-bound in-process)
llm-role slots: OCE_LLM_CONCURRENCY (each is an LLM network call)

claim(stages?) lets role-specific workers pull only their stage subset.
```

---

## Layer 5B — Hatchet Durable Execution

### Files: `server/orchestration/hatchet/`

### Worker registration (`worker.ts`)

```
startHatchetWorker():
  hc = HatchetClient.init({ token: HATCHET_TOKEN, host: HATCHET_HOST })
  { build, scopedWf, verifyWf, moduleStepWf } = registerBuildWorkflow(hc)
  worker = hc.worker("build-worker", { maxRuns: HATCHET_WORKER_SLOTS (40) })
  worker.on(build, scopedWf, verifyWf, moduleStepWf)
  worker.start()
```

### Workflow: `oce-build` (`build-workflow.ts`)

**Concurrency policy**:
```
expression: "input.userId"
maxRuns: HATCHET_USER_MAX_RUNS (default 2)
limitStrategy: GROUP_ROUND_ROBIN
```
→ each user builds at most 2 projects simultaneously; different users run in parallel up to fleet cap (40 slots).

**Task graph** — scaffold→spec→design→compile are ordinary sequential `build.task`s chained by
`parents:` (each reads its parent's payload via `ctx.parentOutput`). Only the **modules** task is
durable. Every task inherits `taskDefaults.executionTimeout = "10m"` — a **safety floor**: without it
the Hatchet SDK default is 60s, which killed the LLM stages mid-flight → a fresh differing spec each
retry → an endless scaffold loop. Tasks needing longer override it (modules 120m, preview 20m,
production-gate 30m); the child workflows set 20m.

```
Input: BuildInput { projectId, workspaceId, userId, jobId, userMessage("" on first build), clarifyAnswers? }

scaffold task (retries 2, 10m default):
  appSpec = resolveAppSpec(base)                 ← runtime.resolveAppSpec (spec-interpreter LLM)
                                                   → sanitizeRawSpec → parseAppSpec (Zod, injection-safe)
                                                   → validateAndRepairSpec  (repairs shape-invalid pages)
  runStage("scaffold", { payload: { appSpec } }) ← scaffold HANDLER creates the project skeleton +
                                                   .onenexium/ base files on the SSD via MCP
     the AppSpec is resolved HERE (in scaffold) then passed forward via payload — NOT in the spec task

spec task (parents:[scaffold], retries 2, 10m default):
  runStage("spec", scaffold.payload)             ← persists the AppSpec IR (.onenexium/appspec.json)

design task (parents:[spec], retries 2, 10m default):
  runStage("design", spec.payload)               ← LLM design-agent → .onenexium/design.md (palette/typography)

compile task (parents:[design], retries 0 = 1 attempt, 10m default):
  runStageFull("compile", design.payload)        ← deterministic OCE compile → File[] via McpWorkspace
     uses runStageFull (not runStage) to CAPTURE the handler's `spawn` (follow-up delta fill fan-out,
     carried into the modules task via payload.__deltaSpawn)

modules task (durable, executionTimeout 120m):
  payload = compile.payload

  # FOLLOW-UP DELTA PRE-PASS (empty on a fresh build): fill the scopes compile fanned out
  deltaSpawn = payload.__deltaSpawn ?? [] ; delete payload.__deltaSpawn
  if deltaSpawn.length:
    await Promise.allSettled(deltaSpawn.map(c => ctx.runChild(scopedWf, { stage:c.stage, scope:c.scope })))
    await ctx.runChild(verifyWf, base).catch(() => {})

  # SLICE LOOP
  for guard in 0..500:
    result = await ctx.runChild(moduleStepWf, { ...base, payload })   ← memoized across replay
    step = result.step ; payload = step.payload
    if step.advanceTo == "preview": break
    if step.spawn.length:
      await Promise.allSettled(                                       ← BARRIER (see note)
        step.spawn.map(c => ctx.runChild(scopedWf, { ...base, stage:c.stage, scope:c.scope })))
    await ctx.runChild(verifyWf, { ...base, payload }).catch(() => {}) ← verify scoped to builtCount (heal-churn fix)
    if payload.pauseAtMilestone === true:
      await emitMilestonePause(projectId, jobId, payload)
      await ctx.waitFor(Or(
        new UserEventCondition("continue:<projectId>", ""),
        new SleepCondition(MILESTONE_CONTINUE_TIMEOUT = "10m")        ← auto-continue if no user reply
      ))

preview task (parents:[modules], 20m) → production-gate task (parents:[preview], 30m) → finalize task:
  finalizeBuild(projectId, jobId): updateBuildJob(job_completed) +
    forceBuilderMode("done", { status: "preview_ready" }) + emit mode_change(done)
  onFailure(anywhere) → failBuild(): updateBuildJob(job_failed) + transitionBuilderMode("done") + emit error
```

> **allSettled, not bulkRunChildren (the false-green-barrier fix):** the fill/heal fan-out uses
> `Promise.allSettled` over durable `runChild` — NOT `bulkRunChildren`, whose `Promise.all` semantics
> **reject on the first child failure**. The old `bulkRunChildren(...).catch(() => {})` abandoned the
> healthy in-flight fills the moment one child failed, so those pages kept being written AFTER the
> barrier → unverified code shipped green. `allSettled` tolerates a dead child (partial progress,
> OCE runner §4.1) WITHOUT abandoning its siblings. `bulkRunChildren` is no longer used anywhere in
> the workflow.

`pauseAtMilestone` is set by the **module handler** (Layer 7): `current.isLastInModule &&
builtModules.size < moduleCount` — i.e. a slice that completes a module while modules remain.
`emitMilestonePause` (runtime-adapter) writes a `milestonePause` card to build-progress + emits
`mode_change(job_paused_user)` and `milestone_pause` (completed/pending modules, page counts).

**Durable-determinism rule**: the durable `modules` task may ONLY orchestrate — `ctx.runChild` +
`Promise.allSettled` + `ctx.waitFor`. Non-deterministic work (LLM, file I/O, `runStageFull`) lives
inside child workflows (`moduleStepWf`/`scopedWf`/`verifyWf`). Hatchet evicts and replays the durable
body at every `await runChild`/`waitFor` — memoized child results are returned from Hatchet's state
store on replay, so the LLM is never called twice for the same child.

### Child workflows

| Workflow | Task | executionTimeout | retries | What it does |
|---|---|---|---|---|
| `oce-module-step` | `step` | 20m | 2 | `runStageFull("module", ...)` — fan-out current module's scopes |
| `oce-scoped` | `run` | 20m | 3 | `runStageFull(stage, {scope})` — LLM fill/heal for one scope set |
| `oce-verify` | `verify` | 20m | 2 | verify → `allSettled` heal barrier (up to `MAX_HEAL_CYCLES = 4`) |

**allSettled heal barrier** (in `oce-verify`):
```
for cycle in 0..MAX_HEAL_CYCLES (4):
  result = runStageFull("verify", input, { healCycles: cycle })
  if !result.spawn.length: break  ← clean
  await Promise.allSettled(
    result.spawn.map(c => ctx.runChild(scopedWf, { ...base, stage: c.stage, scope: c.scope }))
  )   ← failed heal children don't abort siblings
```

### `dispatchHatchetBuild` / `pushContinue` (`bridge.ts`)

```
dispatchHatchetBuild(params):
  hc = hatchet()
  run = await hc.admin.runNoWait("oce-build", params)
  return run.workflowRunId

pushContinue(projectId, reply):
  hc = hatchet()
  await hc.events.push("continue:<projectId>", { reply })
```

---

## Layer 6 — OCE Compiler Engine

### Files: `server/engine/`

### AppSpec IR (`app-spec.ts`)

The LLM (spec stage) produces an `AppSpec` JSON blob. Every field is Zod-validated at the boundary.

**Security validators** (injection defense):
```typescript
Identifier = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/)  // entity/field names
RoutePath   = z.string().regex(/^\/$|^(\/[a-z0-9]+(?:-[a-z0-9]+)*)+$/)  // page paths
Slug        = z.string().regex(/^[a-z][a-z0-9-]*$/)  // section/region ids
Href        = z.string().regex(/^(\/$|\/path|https:\/\/...|mailto:...|tel:...)/)
```

Unknown section `kind` values self-heal to `"content"` via `.catch("content")` rather than failing the parse.

**AppSpec shape (abbreviated)**:
```typescript
AppSpec {
  name: Identifier
  description: string
  theme: "minimal" | "modern" | "bold" | "clean" | "vibrant"
  design?: DesignSchema {
    palette: { primary, secondary, accent, background, foreground, muted }
    typography: { headingFont, bodyFont, scale }
    spacing: { unit, container }
    radius: { sm, md, lg }
    surfaces: { card, input, sidebar }
  }
  entities: EntitySchema[] {
    name: Identifier
    fields: FieldSchema[] { name: Identifier, type, required, unique }
    relations: RelationSchema[]
  }
  pages: PageSchema[] {
    name: Identifier
    path: RoutePath
    brief?: string
    content?: PageContentSchema { headline, subhead, tone, sections[], cta }
    layout?: "default" | "sidebar" | "centered" | "dashboard" | "landing"
    access?: "public" | "authenticated" | "role:<name>"
  }
  features: string[]     // Tier 3: arbitrary authored endpoints
  auth?: AuthSchema { provider, roles[], defaultSignupRole }
  rbac?: RbacSchema { roles[], permissions[] }
  reports?: ReportSchema[]
  workflows?: WorkflowSchema[]
}
```

### Compile pipeline (`compile.ts`)

```
compile(spec: AppSpec, ctx: CompileContext): File[]

1. Run all generators in parallel:
   results = await Promise.all([
     schemaGen(spec),     → drizzle schema + migration
     crudGen(spec),       → API route handlers (list/create/get/update/delete)
     pageGen(spec),       → app/**\/page.tsx scaffolds
     formGen(spec),       → React form components
     authGen(spec),       → NextAuth config + sign-in/out pages
     rbacGen(spec),       → middleware + role guards
     reportGen(spec),     → data table pages
     workflowGen(spec),   → multi-step workflow pages
     scaffoldGen(spec),   → root layout, providers, env, tailwind config
   ])

2. Collect all Fragment[] from all generators

3. Partition fragments by mode:
   exclusive fragments  → full files (one fragment = one file, no merging)
   shared fragments     → target the same file, must be merged via assembler

4. assembleByAnchors(sharedFragments) → merged File[]

5. Sort all files deterministically (by path)

6. Return File[]
```

**Pure / side-effect-free invariant**: `compile()` never reads from disk, network, or database. Same `AppSpec` always produces identical bytes.

### Fragment type (`fragment.ts`)

```typescript
type Fragment = {
  path: string         // target file path
  mode: "exclusive" | "shared" | "seed"
  anchor?: string      // anchor id for shared merge (@oce:anchor:<id>)
  content: string      // generated code
  priority?: number    // merge order for shared
}
// mode semantics:
//   exclusive — full-file compiler ownership; reconcile.ts overwrites on every rebuild
//   shared    — merged into target at @oce:anchor placeholders
//   seed      — LLM-owned: written on first build (marker: "@oce:seed" in file header),
//               skipped by reconcile on subsequent rebuilds so LLM edits persist.
//               OCE fill calls dropSeedMarker() after writing a seed file.
//               run-agent-turn.ts also drops the marker on apply_diff to seed files,
//               so a targeted edit preserves the change across future rebuilds.
//
// Example: app/(protected)/layout.tsx is seed — auth enforced in compiler-owned API
// handlers; the sidebar/topbar UI is LLM-authored and must survive OCE rebuilds.

type File = {
  path: string
  content: string
}
```

### Assembler (`assemblers/assemble-by-anchors.ts`)

```
For each unique target path:
  fragments = all shared fragments targeting this path
  sort by priority
  replace @oce:anchor:<id> placeholders with fragment content
  → one File per target
```

### Scopes (`scopes.ts`)

```
customScopes(spec: AppSpec): string[][]

Each scope = a set of file paths assigned to ONE fill worker.
Partitioning strategy:
  - One scope per page (all files for that page)
  - One scope per entity's form/crud cluster
  - Creative regions (enrich scopes) split from logic regions (fill scopes)
```

### Stage transition table (`pipeline/types.ts`)

```
SUCCESS_NEXT: {
  scaffold → spec
  spec     → design
  design   → compile
  compile  → module
  module   → verify     (or advanceTo: preview when all modules done)
  fill     → verify     (fan-in barrier)
  enrich   → verify     (fan-in barrier)
  verify   → milestone  (per-module review check-in)
  milestone → module    (next module)
  heal     → verify     (fan-in barrier)
  preview  → production-gate
  production-gate → done
}

MAX_ATTEMPTS: {
  scaffold: 2, spec: 2, design: 2, compile: 1,
  module: 2, fill: 3, enrich: 2, milestone: 1,
  verify: 2, heal: 3, preview: 1, production-gate: 2
}

MAX_HEAL_CYCLES = 3  (verify→heal→verify cycles before dead-letter)
```

### Worker roles

```
det (deterministic): scaffold, compile, module, verify, milestone, preview, production-gate
llm (LLM-backed):    spec, design, fill, enrich, heal

OCE_LLM_CONCURRENCY = 10 (default), max 12
```

### `step()` runner (`pipeline/runner.ts`)

```
step(store, workspace, handlers, job, hooks?):

1. hooks.isCancelled(job)? → deadLetter("cancelled by user")
2. handlers[job.stage]? else → deadLetter("no handler")
3. hooks.beforeStage(job)? (pipeline jobs only, not fan-out children)
     → "pause": park job (credits/infra) → return
     → "proceed": continue
4. out = await handler(job, { workspace })
5. if out.files: workspace.write(out.files)

6. if job.parentId (child/fan-out):
     job.status = "done"
     store.save(job)
     completeChild(store, parentId)
     ← decrement parent.pendingChildren atomically (SQL UPDATE…SET n=n-1 RETURNING n)
     ← if pendingChildren reaches 0: parent advances
     return

7. if out.spawn (fan-out):
     if job.stage == "verify" && job.healCycles > MAX_HEAL_CYCLES:
       hooks.onHealExhausted(job)?
         "recover": revert failing files to compiled stubs → re-verify once (guarded)
         "dead_letter": fail build
     enqueue all children with parentId=job.id, parent.pendingChildren = spawn.count
     job.status = "waiting"
     store.save(job)
     return

8. advance(store, job, out.advanceTo ?? SUCCESS_NEXT[job.stage])

onFailure(store, job, error, hooks):
  hooks.onError(job, error)?
    "retry":       job.attempts < MAX_ATTEMPTS[stage] → requeue; else → deadLetter
    "pause":       park job (reason from hook)
    "dead_letter": deadLetter immediately
  default: job.attempts < MAX_ATTEMPTS → requeue; else → deadLetter
```

---

## Layer 7 — Stage Handlers (production-runtime)

### File: `server/ai/harness-v3/oce/production-runtime.ts`

### Handler registry (injected via `setOceRuntimeFactory`)

```typescript
productionRuntimeFactory(params): OceRuntime {
  store:     PgJobStore (dedicated pool — never Drizzle's shared pool)
  workspace: McpWorkspace(mcpToken)
  handlers:  {
    scaffold: scaffoldHandler,
    spec:     specHandler,
    design:   designHandler,
    compile:  compileHandler,
    module:   moduleHandler,
    fill:     fillHandler,
    enrich:   enrichHandler,
    verify:   verifyHandler,
    heal:     healHandler,
    milestone: milestoneHandler,
    preview:  previewHandler,
    "production-gate": productionGateHandler,
  }
  hooks: {
    beforeStage: creditAndInfraGuard,
    onError:     failureClassifier,
    isCancelled: cancelSignalCheck,
    onHealExhausted: gracefulDegradation,
  }
}
```

### `scaffold` handler

```
1. ensureDatabaseProvisioned(projectId)  — Neon tenant DB if needed
2. ensureTenantId(projectId)             — generate t_{nanoid(8)}
3. MCP tool call: workspace/create_project(tenantId, tier)
     → dev worker creates /home/projects/{tenantId}/ base structure
4. Write .onenexium/brief.md (project context)
5. Write .onenexium/appspec.json placeholder
6. resolvePageSpec(spec) + generatePageSpecFiles() — write per-module spec stubs
7. assignPageModules(spec) — assign pages to module slots
```

### `spec` handler

```
1. loadBuilderContext(projectId)       — load brief, user memory facts, workspace info
2. buildAppSpecContextSection(spec)    — existing spec for follow-up
3. runAgentTurn({
     projectId, userId,
     mode: "spec",
     systemPrompt: specSystemPrompt,
     userMessage,
     tools: [write_appspec, read_file],
     maxRounds: 10
   })
4. Agent writes .onenexium/appspec.json via MCP write_file tool
5. parseAppSpec(json) — Zod validation + injection check
6. Persist to DB: projects.builderContext.spec = spec
```

### `design` handler

```
1. loadAppSpec() from workspace
2. runAgentTurn({
     mode: "design",
     systemPrompt: designSystemPrompt + spec summary,
     tools: [write_file],
     maxRounds: 5
   })
3. Agent writes .onenexium/design.md (palette, typography, spacing, component style)
4. captureOceSourceSnapshot(projectId) — dual-write to S3 for DR
```

### `compile` handler

```
1. loadAppSpec() → parseAppSpec()
2. loadDesignTokens() from .onenexium/design.md
3. compile(spec, { design }) → File[]
4. reconcileFiles(workspace, files):
     existing = workspace.list()
     for each file:
       if !existing[path] || hash differs: write
       else: skip (no change)
5. Write .onenexium/compiled-manifest.json (path → content-hash)
6. initBuildState(projectId, spec.pages) — tracking which pages are done
```

### `module` handler

```
1. loadBuildState(projectId)     — { completedModules[], pendingModules[] }
2. nextModule = pendingModules[0]
3. scopes = customScopes(spec, nextModule)   — file sets for fill fan-out
4. if scopes.length == 0: advanceTo "preview"  ← all modules done
5. return { spawn: scopes.map(s => ({ stage: "fill", scope: s })) }
     → fans out N fill children for this module
```

### `fill` handler

```
1. context = assembleImplementorContext({
     projectId, scope,
     mode: "fill",
     buildState,   — what's been done
     spec,         — AppSpec for this module's pages
     fileManifest, — component imports/exports across files
     memory        — project memory facts (decisions, patterns, constraints)
   })
2. runAgentTurn({
     mode: "fill",
     scope,
     systemPrompt: fillSystemPrompt + context,
     tools: [
       read_file, write_file,    — via McpWorkspace
       list_files,
       run_typecheck (advisory),
     ],
     maxRounds: BUILD_ITEM_MAX_ROUNDS (100),
     tokenCap: BUILD_ITEM_TOKEN_CAP (1,000,000)
   })
3. markRouteCompleted(projectId, route) for each file in scope
```

### `verify` handler

```
1. callToolByName("quality/run_typecheck", { projectId })
     → MCP → dev_worker → tsc_service (warm WatchProgram)
     → { passed: bool, errors: [{file, message, line}] }

2. runBehavioralSmoke({ projectId, mcpToken, plan: deriveSmokePlan(spec) }):
     Steps in plan order (all derived deterministically from AppSpec):
       render       — GET each route (anon); assert ≠ 4xx, no error boundary
       auth-signup  — POST /api/auth/signup; valid/missing/duplicate cases
       auth-login   — POST /api/auth/login; wrong-password/correct cases
       auth-guard   — GET protected route anon (→ 401) and authed (→ 200)
       role-vocab   — GET /api/auth/me; verify signup role is a declared RBAC role
       list/create  — CRUD round-trip (list + create + read-back) as default role
       elevate      — only when spec has distinct admin role AND ≥1 protected feature:
                        run_db_seed → UPDATE users.role; re-login → fresh JWT
       feature      — check each spec.features[] endpoint (as elevated user if elevated)

3. if all passed:
     return { spawn: [] }   ← no heal needed

4. if errors:
     healScopes = groupErrorsByScope(errors, spec)
     return { spawn: healScopes.map(s => ({ stage: "heal", scope: s })) }
```

**Smoke step: `elevate`** (added to fix unwinnable heal loops):
```
Problem: spec.features[] entries may be admin-only. The smoke seeded one default-role user
         and asserted protected features returned 200 — impossible for correct auth code →
         drove 69-minute unwinnable heal loop ("weaken auth OR return 200" is unsatisfiable).

Fix: elevatedRole(spec) finds the highest declared role (ELEVATED_ROLE_SYNONYMS: admin/owner/
     superadmin/manager). If a distinct elevated role exists AND ≥1 protected feature in the plan:
       insert "elevate" step AFTER CRUD checks (RBAC denial still verified at default role)
                              BEFORE feature checks (now run as authorized elevated user)
     On no distinct admin role or no protected features: elevate step is omitted entirely.

CRUD steps still run as the DEFAULT-ROLE user so RBAC denials remain verified.
Feature checks run as the ELEVATED user so 200 is achievable without weakening auth.
```

### `heal` handler

```
runAgentTurn({
  mode: "heal",
  scope,
  systemPrompt: healSystemPrompt + errorSummary,
  tools: [read_file, write_file, run_typecheck],
  maxRounds: BUILD_ITEM_MAX_ROUNDS,
})
→ agent reads error → reads file → writes fix
```

### `preview` handler

```
1. no-op if !oceStageEnabled("preview")
2. startDevServer({ projectId, mcpToken, reason: "cold_start", emit })
     → dev_worker :8001 boots `npm run dev` (Turbopack) in /home/projects/{tenantId}/;
       migrations ran at boot; emits dev_preview_url via the emit callback
     → if result.status === "failed": THROW (fails the task)
3. DB SMOKE GATE (fullstack only — the runtime data-layer proof, Tier 3):
     read .onenexium/appspec.json → needsPersistence(spec)?
       yes → http_request GET /api/health  (the generated route runs `SELECT 1`)
             if body_json.database === "disconnected" OR status === 503:
               THROW "OCE_DB_SMOKE_FAILED" ← FATAL. A fullstack app whose backend can't reach its
                                             DB is not shippable (static tsc/lint/route gates never
                                             touch the DB, so this is the only thing that catches a
                                             dead/unmigrated database — the "looks done, backend dead" bug).
       best-effort otherwise: a missing health route or a flaky probe never fails the build;
       only an explicit `disconnected`/503 does.
```

> Note (envelope bug, fixed): `callToolByName` UNWRAPS the MCP `{ result: … }` envelope, so `status`
> / `body_json` are TOP-LEVEL. Reading `.result.*` here made the probe always-undefined → the gate
> silently ALWAYS PASSED (a dead DB shipped green).

### `production-gate` handler (`server/ai/production-gate.ts`, `OCE_PRODUCTION_GATE=1`)

Full repair loop — `next build` (via `finalize_build`) + behavioral smoke + repair:

```
runProductionGate(params):
  for attempt = 0..maxAttempts:

    A. ROUTE-COLLISION RESOLUTION (deterministic, before each repair turn):
       resolveRouteCollisionsAtGate(projectId, mcpToken):
         list_files → filter pages → findRouteCollisions()
         for each collision (>1 file same URL):
           read_file each colliding path
           isReExportStub() = single line re-export (`export { default } from '...'`)
           if exactly 1 real page + ≥1 stubs:
             delete_file(stub)   ← keep real page, remove the re-export artifacts
           if all-real or all-stub: leave for LLM repair (ambiguous)
         returns count deleted (0 on clean builds — no-op)

    B. PRODUCTION BUILD: callToolByName("finalize_build", { project_id })
         timeout: 300,000ms
         result: { status, port, errors[], build_log }

    C. if finalize ok (status==="ready"):
         claimDevServerPort(port)  ← swallows conflicts; port record is cosmetic
         previewUrl = devPreviewOrigin(projectId)

         BEHAVIORAL SMOKE GATE: runSmokeGate(projectId, mcpToken):
           read .onenexium/appspec.json → parseAppSpec() → needsPersistence()?
             false → return null (pure frontend — skip smoke)
           plan = deriveSmokePlan(spec)  ← deterministic SmokeStep[] from spec
           http = runBehavioralSmoke({ projectId, mcpToken, plan })
             → exercises: auth-signup, auth-login, auth-guard, role-vocab,
                           CRUD list/create/read-back (default role),
                           elevate step (to highest declared role, re-login),
                           feature checks (protected endpoints as elevated user)
           browser = callToolByName("browser_golden_path", { projectId, steps: plan })
             → headless browser golden-path on the running dev server
             → only NON-advisory failures (crash/error-boundary) block the build
             → advisory failures (timing/cache ambiguity) logged, not gated
             → failure screenshots collected (base64 PNG, up to 3)
           → SmokeResult { passed, failures[], stepsRun } + screenshots[]

         if smoke.passed (or null): advance to done ✓

         if !smoke.passed:
           recordEpisode(failure_pattern, ...) — episodic memory, async non-blocking
           runProductionRepairTurn(kind="behavior", errors, screenshots):
             upload screenshots → S3/MinIO → ChatAttachmentInput[]
             runAgentTurn with behavior repair prompt + vision blocks (if screenshots)
             "trace each check to route handler (app/api/**/route.ts) or lib/auth.ts,
              fix the behavior, preserve the contract — do not weaken auth"
           continue  ← re-run finalize + re-smoke

    D. if finalize failed:
         parseFinalizeErrors():
           sourceFileForError(file): translate .next/types/app/<r>/page.ts → app/<r>/page.tsx
           → max 20 errors, formatted as "<file>:<line> — <message>"
         runProductionRepairTurn(kind="build", errors):
           runAgentTurn("fix ONLY the listed errors, do not touch any other file")
         continue  ← re-run finalize

  → ProductionGateResult { passed, errors, previewUrl, port, attempts }
```

The stage handler wraps this: `if (!gate.passed) throw` → the `production-gate` **task** fails → the
workflow `onFailure` fires `failBuild()` (job_failed). On `passed`, control returns to the workflow,
which runs the **finalize** task → `finalizeBuild()` → `forceBuilderMode("done", {status:"preview_ready"})`.
`platformConfig.productionGate` off ⇒ the gate is a no-op pass (safe to keep in the table).

**Error path translation** (`sourceFileForError`):
```
.next/types/app/dashboard/page.ts  →  app/dashboard/page.tsx
.next/types/app/(protected)/x/page.ts  →  app/(protected)/x/page.tsx
any other path  →  unchanged

Why: next build type errors target generated .next/types/ files, not editable source.
Feeding the generated path to the repair agent caused it to CREATE a new stub file
at that path → route collision → infinite heal loop. Translation redirects the agent
to the actual editable source file.
```

### `milestone` handler

```
1. loadBuildState(projectId)
2. completedModules = buildState.completedModules
3. if milestoneMaxPausesPerBuild reached: bypass (auto-continue)
4. pausePayload = {
     moduleName: lastCompleted,
     completedModules,
     pendingModules,
     pagesCompleted, pagesTotal
   }
5. durableEmit(milestone_pause event)
6. updateBuildProgress({ milestonePause: pausePayload, status: "paused" })
7. job.pauseReason = "milestone:<moduleName>"
8. job.status = "paused"   ← store saves; runner returns
   → Hatchet waitForEvent unblocks on "continue:<projectId>" OR 10m timeout
```

### `runAgentTurn` (`server/ai/run-agent-turn.ts`)

The core LLM turn executor. One call = one Claude API request + tool loop.

```
runAgentTurn(input: RunInput):

  0. Classify + resolve execution config:
       understanding = classifyMessage(input.userMessage, context)
       config = resolveExecutionConfig(understanding, projectState, {
         forceEditMode: input.forceEditMode  // set by follow-up router's confirmed edit path
       })
       → toolMode, maxRounds, toolOutputBudget, feature gates

       operate turns get an OPERATIONS + JUDGMENT directive injected into system prompt:
         "you OWN these controls, DO it and report; never say you can't or ask if they
          meant an app change. ACT on clear+safe ops, ASK only when ambiguous,
          CONFIRM before outward/destructive, report errors."

  1. Build system prompt sections:
       - Project brief (always)
       - Conversation summary (compressed history)
       - Project memory facts (decision/pattern/constraint/entity)
       - Component manifest (file exports/imports)
       - Mode-specific instructions (spec/fill/heal/operate/etc)

  2. Assemble messages array (compacted):
       repairToolPairing(messages)         ← ensure every tool_use has a tool_result
       contextCompactor.compact(messages, tokenBudget)
       → drops oldest turns when over budget, preserves user+assistant bookends

  3. Universal LLM client call:
       client = createLlmClientAsync()     ← provider from platform_settings (admin panel)
       client.messages.create({
         model: selectModelForMode(config.modelTier),
         max_tokens: config.toolOutputBudget → BUDGET_TIERS [16K|32K|64K|128K],
         system: systemPrompt,
         messages,
         tools: getToolSchemas(config.toolMode),  ← toolset by mode
         tool_choice: "auto"
       })

  4. Tool loop (up to config.maxRounds):
       for each tool_use block:
         [loop-guards] decideFileFailureEscalation, isScopeViolationError
         result = callToolByName(tool.name, tool.input, mcpToken, timeout)
           timeout from getToolTimeout(tool.name)   ← tool-exec-policy.ts
         [tool-result-shaping] trimToolResult(result, toolName)
         append tool_result to messages
         [evict] evictOldToolResults(messages, COMPACT_THRESHOLD_TOKENS) when context > 160K

         on apply_diff to a seed file:
           dropSeedMarker(file)  ← remove @oce:seed header so the LLM edit persists
                                    across future OCE rebuilds (mirrors fill handler behavior)

         if round > outputBudgetTruncationThreshold: climb BUDGET_TIERS

  5. Page progress: computePageProgress(writtenFiles, plannedPages)
       deriveBuildPhase(progress) → emit build_progress SSE

  6. Record ai_generation_runs row (tokens, cost, duration, tool calls)
  7. Extract memory facts → upsert project_memory_facts
  8. Return { filesWritten, output }
```

**Tool sets by toolMode** (`getToolSchemas(mode)`):
```
question   → read_file, search_codebase (read-only)
edit       → read_file, search_codebase, apply_diff, run_typecheck
             NO run_command — sandbox rejects shell; its absence stops the agent roaming
devserver  → full MCP toolset + start_dev_server, trigger_build, get_runtime_logs
agent      → full MCP toolset + deploy tools
```

**Output-token escalation** (BUDGET_TIERS):
```
[16000, 32000, 64000, 128000]
When a round hits max_tokens, the next round climbs to the first tier > current budget.
Capped at 128K (Anthropic max output). Prevents premature truncation on large writes.
```

### McpWorkspace (`oce/mcp-workspace.ts`)

```typescript
McpWorkspace implements Workspace {
  write(files: File[]):
    for each file:
      callToolByName("workspace/write_file", { path, content }, token)
  
  read(path: string):
    callToolByName("workspace/read_file", { path }, token) → string | undefined
  
  list():
    callToolByName("workspace/list_files", {}, token) → string[]
}
```

---

## Layer 8 — MCP Server + Dev Worker

### MCP Server (`onenexium-ai-core/mcp_server.py`, port 8000)

#### Auth

Every request carries `Authorization: Bearer <jwt>`. The server verifies:
```python
jwt.decode(token, MCP_AUTH_TOKEN, algorithms=["HS256"])
→ payload { userId, workspaceId, projectId, exp }
```
Cross-project calls are rejected (projectId mismatch).

#### Tool namespaces

| Namespace | Key tools |
|---|---|
| `workspace/` | `read_file`, `write_file`, `list_files`, `delete_file`, `move_file` |
| `codegen/` | `generate_component`, `generate_schema` |
| `build/` | `create_project`, `install_deps`, `get_build_errors` |
| `devserver/` | `start`, `stop`, `status`, `health` |
| `quality/` | `run_typecheck`, `run_lint`, `run_tests` |
| `deploy/` | `deploy_preview`, `deploy_production` |
| `infra/` | `provision_database`, `provision_subdomain` |

#### File storage

Project files live at `/home/projects/{tenantId}/` on the assigned EC2 instance (`dev_instances.privateIp`).

### Dev Worker (`onenexium-ai-core/dev_worker.py`, port 8001)

#### Per-project dev server lifecycle

```python
POST /devserver/start { projectId, port }:
  process = subprocess.Popen(
    ["npm", "run", "dev", "--", "-p", str(port)],
    cwd=f"/home/projects/{tenantId}/",
    env={...PROJECT_ENV_VARS}
  )
  active_processes[projectId] = process

GET /devserver/status { projectId }:
  → { running: bool, port: int, url: str }

POST /devserver/stop { projectId }:
  process.terminate()
  del active_processes[projectId]
```

#### Typecheck

```python
POST /typecheck { projectId }:
  1. Try tsc_service :8002 (warm WatchProgram):
       resp = requests.post(f"http://localhost:8002/check", json={ "project_id": projectId })
       → { passed: bool, errors: [], error_count: int }
  2. Fallback (tsc_service down):
       subprocess.run(["npx", "tsc", "--noEmit"], cwd=project_dir)
```

### tsc-service (`onenexium-ai-core/tsc_service.js`, port 8002)

```javascript
// One warm ts.WatchProgram per project
POST /check { project_id }:
  program = watchPrograms[project_id] ?? createWatchProgram(project_dir)
  diagnostics = ts.getPreEmitDiagnostics(program.getProgram())
  → { passed: diagnostics.length === 0, errors: formatDiagnostics(diagnostics) }
```

Avoids 3–5s cold `tsc` startup on every verify round.

### Execution plane (`server/ai/instance-pool.ts`, `server/ai/execution-plane/`)

```
dev_instances table:
  id, privateIp, status (launching|ready|draining|terminated),
  totalSlots (12), usedSlots, amiId, instanceType (t3.large)

bootstrapExecutionPlane():
  if STATIC_WORKER_IP set: register single static instance
  else: poll EC2 ASG, sync dev_instances table

Project assignment (execution-resolver.ts):
  project_execution.assignedWorkerIp = chosen instance
  project_execution.placementEpoch++    ← fencing token
  MCP credential scoped to that instance's IP
```

---

## Layer 9 — Data Layer (Full Schema)

### Postgres tables (Drizzle ORM, `server/db/schema.ts`)

#### Core identity

| Table | Key columns | Notes |
|---|---|---|
| `users` | `id uuid PK`, `email unique`, `passwordHash`, `creditBalance int`, `reservedCredits int`, `isPlatformAdmin bool` | `creditBalance - reservedCredits` = available |
| `workspaces` | `id uuid PK`, `ownerUserId → users`, `name`, `industry`, `brandColor`, `fontStyle` | Brand context for AI codegen |
| `projects` | `id uuid PK`, `userId → users`, `workspaceId → workspaces`, `tenantId text unique` (t_{nanoid8}), `subdomain unique`, `status`, `builderMode`, `builderContext jsonb`, `devServerPort`, `devInstanceId`, `fileManifest jsonb`, `fileWriteHashes jsonb` | Single source of truth for project lifecycle |
| `project_execution` | `projectId PK → projects`, `lifecyclePhase`, `assignedWorkerIp`, `placementEpoch int`, `scaffoldState`, `secretsReady bool`, `filesPresentOnWorker bool`, `completedModules jsonb` | Placement + phase authority |
| `dev_instances` | `id text PK` (EC2 id), `privateIp`, `status`, `totalSlots 12`, `usedSlots` | Instance pool |

#### Build pipeline

| Table | Key columns | Notes |
|---|---|---|
| `ai_build_jobs` | `id uuid PK`, `projectId`, `userId`, `status` (queued/running/done/failed), `attempt`, `repairAttempt`, `creditsConsumed`, `claimedBy`, `claimedAt`, `checkpoint jsonb`, `metrics jsonb`, `lastHeartbeatAt` | Orchestration queue |
| `build_jobs` | `id uuid PK`, `projectId`, `status`, `imageTag`, `imageUri`, `environment` (preview/production), `publishedAt` | Docker/CodeBuild deploy jobs (separate from ai_build_jobs) |
| `project_messages` | `id`, `projectId`, `role` (user/assistant), `content`, `tokenCount` | Chat transcript |
| `project_pages` | `id`, `projectId`, `route`, `componentName`, `isPublished`, `seoMeta jsonb` | Generated page index |
| `project_changelog` | `projectId`, `turnId`, `intent`, `summary`, `filesCreated`, `filesModified`, `costCents` | Audit log per turn |

#### Billing

| Table | Key columns | Notes |
|---|---|---|
| `credit_tokens` | `id`, `userId`, `transactionType` (purchase/usage/refund/bonus/…), `amount int` (+ = in, - = out), `balanceAfter`, `status`, `expiresAt`, `idempotencyKey unique` | Append-only ledger |
| `credit_sessions` | `id`, `userId`, `featureKey`, `modelId`, `reservedCredits`, `usedCredits`, `settledCredits`, `status` (active/settled/aborted/expired), `expiresAt` | In-flight reservation |
| `payment_orders` | `id`, `userId`, `packId`, `gateway` (stripe/razorpay/cashfree), `amountMinor`, `credits`, `status`, `idempotencyKey unique` | Gateway-agnostic order |

**Credit invariants**:
- `credit_tokens.amount > 0` for inflows, `< 0` for outflows
- `(userId, idempotencyKey)` unique — safe to retry any writer
- `users.credit_balance` never goes negative (SQL guard in `ledger.ts`)
- Available = `creditBalance - reservedCredits`

#### Memory

| Table | Key columns | Notes |
|---|---|---|
| `project_memory_facts` | `projectId`, `category` (decision/error_fix/entity/pattern/constraint), `fact`, `importance real`, `isActive bool`, `supersededBy` | Cross-turn project facts |
| `user_memory_facts` | `userId`, `category` (preference/brand/style/tech_comfort), `fact`, `confidence real` | Cross-project user preferences |
| `ai_episodic_memory` | `projectId`, `scope` (project/global), `episodeType`, `trigger`, `lesson`, `embedding vector`, `embeddingDim`, `occurrences int` | Failure/success patterns; T6 vector search |
| `knowledge_patterns` | `slug unique`, `category`, `docContent`, `embedding vector`, `priority` | Curated engineering patterns for AI context |

#### Observability

| Table | Key columns | Notes |
|---|---|---|
| `ai_generation_runs` | `projectId`, `userId`, `model`, `inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `totalCostCents`, `toolCallsJson`, `durationMs`, `status`, `tokenBreakdown jsonb`, `budgetTrace jsonb` | Per-LLM-turn observability |
| `admin_audit_log` | `actorId`, `actorEmail`, `action`, `targetType`, `targetId`, `details jsonb` | Admin action audit |

#### Indexes (key ones)

```sql
ai_build_jobs: (projectId, status), (userId, status)
projects: (userId), (workspaceId), (status), (userId, lastEditedAt, id)
project_messages: (projectId), (projectId, sentAt, id)  ← cursor pagination
credit_tokens: (userId, idempotencyKey) UNIQUE, (status, expiresAt)  ← expiry sweep
ai_episodic_memory: (projectId, isActive), (scope, isActive)  ← active filter
```

### Redis

| Key pattern | Data | TTL |
|---|---|---|
| `onenexium:lock:project:{projectId}` | lock holder token (nanoid) | `LOCK_LEASE_TTL_MS = 90s` |
| `onenexium:events:{projectId}` | Redis Stream (XADD/XRANGE) | `STREAM_TTL_SECONDS = 30m` |
| `onenexium:progress:{projectId}` | `BuildProgressState` JSON | 30m |
| `onenexium:mcp:cache:{tool}:{hash}` | tool result cache | configurable |
| `onenexium:rate:{userId}` | rate limit counter | per window |

### Postgres job store for OCE (`pipeline/pg-store.ts`)

```sql
oce_jobs: {
  id uuid PK,
  project_id uuid,
  parent_id uuid,
  stage text,
  status text,   -- queued|running|waiting|paused|done|dead_letter
  payload jsonb,
  scope jsonb,
  attempts int,
  pending_children int,   -- fan-in counter (decremented atomically)
  heal_cycles int,
  revision int,
  error text,
  claimed_at timestamptz,
  input_hash text,
  created_at timestamptz
}

Indexes: (project_id, status), (status, claimed_at), (project_id, input_hash)

claim() uses:
  UPDATE oce_jobs SET status='running', claimed_at=now()
  WHERE id = (
    SELECT id FROM oce_jobs
    WHERE status='queued' [AND stage = ANY($stages)]
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING *

decrementPendingChildren(parentId):
  UPDATE oce_jobs SET pending_children = GREATEST(pending_children-1, 0)
  WHERE id = $parentId
  RETURNING pending_children
```

---

## Layer 10 — SSE Event System

### Event types (`server/ai/sse.ts`)

`AiSseEvent` is a large discriminated union — **~44 variants** in `sse.ts` (the authoritative list).
There is **no `clarification` event** — questions are emitted as **`ai_question`** (one per question).
Representative subset:

```typescript
type AiSseEvent =
  // lifecycle / mode
  | { type: "job_started"; jobId }  | { type: "job_completed"; jobId; result }
  | { type: "mode_change"; mode }   | { type: "done"; runId }  | { type: "error"; message; code? }
  | { type: "job_blocked" | "job_paused_credits" | "job_paused_infra"; message? }
  | { type: "build_handoff"; jobId }  | { type: "status"; message }  | { type: "pipeline_phase"; phase }
  // ask / plan
  | { type: "ai_question"; questionIndex; totalQuestions; question; options }   // ← the QuestionCard
  | { type: "completeness"; score; round }  | { type: "plan_ready"; plan }
  // streaming + build progress
  | { type: "text"; content }  | { type: "healing"; ... }
  | { type: "build_progress"; phase: BuildPhase; round; totalRounds; filesWritten;
      pagesCompleted: string[]; pagesRemaining: string[] }
  | { type: "tool_start" | "tool_complete" | "tool_input" | "tool_error"; ... }
  | { type: "item_started" | "item_verifying" | "item_verified" | "item_failed"; ... }
  // preview / deploy
  | { type: "dev_preview_url"; url }  | { type: "preview_url"; url }  | { type: "live_url"; url }
  | { type: "milestone_pause"; moduleName; message; completedModules[]; pendingModules[];
      pagesCompleted; pagesTotal }
  // billing / misc
  | { type: "token_usage" | "budget_update" | "budget_needed" | "low_credit_warning"
        | "build_cost_estimate" | "ambient_insight" | "living_spec" | "queue_updated"
        | "turn_complete" | "turn_metrics" | "ping" | ... ; ... }
```

All events pass `sanitizeForClient()` in `sse.ts` before `appendEvent` (strips server-only fields,
e.g. seeded-login passwords). `BuildProgressState` carries a `pendingClarification` field (the
persisted question-card payload for rehydration) — distinct from the `ai_question` wire event.

### Event store (`server/ai/event-store.ts`)

```
Redis path (REDIS_URL set):
  XADD onenexium:events:{projectId} MAXLEN ~ 500 * { type, data, timestamp }
  XRANGE onenexium:events:{projectId} {lastId} +   ← read since cursor
  EXPIRE onenexium:events:{projectId} 1800          ← 30m TTL

In-memory fallback:
  circular buffer, 500 events per project
  prune projects not accessed in 30m (interval: 60s)
```

### Build progress store (`server/ai/build-progress-store.ts`)

```
BuildProgressState persisted as JSON in Redis (SET with PX 1800000ms).

Fields: runId, phase, round, totalRounds, filesWritten,
        pagesCompleted[], pagesRemaining[],
        liveUrl, devPreviewUrl, lastToolCall,
        startedAt, lastUpdatedAt, status,
        milestonePause?, pendingClarification?, error

On reconnect (GET /api/projects/{projectId}/build-stream — see Layer 0):
  if !isBuildSessionRunning(activeJob, progress): return JSON { done, progress }   ← no SSE
  else: replay getEventsSince(projectId, lastEventId)   ← XRANGE (lastEventId, +];
                                                           null cursor → replay all (bounded by MAXLEN)
        then tail every 750ms until terminal + quiescence
```

The live turn does NOT hydrate from here — it streams straight from the `POST /api/ai/chat` response
body (`durableEmit` = `sse.send` + `appendEvent`). The progress store + event store exist so a
*reconnecting* client rebuilds state without re-querying Postgres.

---

## Follow-up Flow — a message on an already-built project

The 12-layer walk above is the **first build**. A **follow-up** ("add a wishlist", "make the footer
smaller", "rename Customer to Client", "delete the reports page") is a distinct entry. State machine:
`done → building → done`; `status` may already be `preview_ready`/`live`.

### Stage 1 — route resolution (chat route)

```
built project (status=preview_ready | builderMode=done) + user message
  → sanitizeResolvedMode R3 (regression guard) → "conversational"                       (Layer 1: Mode Resolution)
  → conversational branch: u = classifyMessage(message)                                  (Layer 1: Mode Dispatch B)
       primary ∈ {question} → inline answer via runAgentTurn (NO build)
       primary == operate    → inline devserver op (restart/rebuild/logs)
       edit|fix & !isCompound → dispatchBuildTurn({ singleEdit:true })   (bounded in-place edit)
       else (build/structural/compound) → dispatchBuildTurn()            (full follow-up job)
  (both dispatch paths run in the PM2 worker so they survive browser close.)
```

### Stage 2 — worker pre-dispatch gates (`executeBuildJob`, Hatchet path)

Two follow-up-only gates run BEFORE dispatch (both read `.onenexium/appspec.json` + call `planFollowup`):

```
1. pauseHatchetFollowupIfUnclear()  — CLARIFY GATE (job-runner.ts:279)
     planFollowup(spec, msg+foldedAnswers) → if NOT confident (planResult.clarification):
       shouldPauseForClarification({ confidence, clarifyRoundCount })   (threshold 90, MAX_ROUNDS 3)
       → status=job_paused_user, checkpoint.pendingQuestions, emit ai_question ("A quick question before I build…")
       → the user's answer re-dispatches, folded in → now confident → proceeds
     (needed on Hatchet because the in-build spec clarify signal is stripped by parseAppSpec)

2. hatchetFollowupIsEdit()  — EDIT-FIRST ROUTER (job-runner.ts:378), route by what CHANGES (not keywords):
     media attachment (image/video)          → in-place EDIT AGENT (OCE growth is media-blind)
     planFollowup ops include {add | remove}  → OCE GROWTH BUILD (return none → dispatchHatchetBuild)
     everything else                          → in-place EDIT AGENT
       (edit / fix / modify / RENAME / field-add — the edit agent now owns data-model renames/field-adds
        via the deterministic apply_data_change tool. Old default {add,remove,rename}→OCE was NARROWED
        to {add,remove}; rename/field-add moved to the edit agent → killed the "rename→no entity→false green" bug)
```

### Stage 3A — in-place EDIT AGENT (`singleEdit`, inline in `executeBuildJob`)

`runAgentTurn` in **edit toolMode** (execution-resolver): clean toolset **read_file + apply_diff +
apply_data_change** (NO `run_command`), + file-resolver + ProjectGraph + memory. `forceEditMode` pins
it so a second classification can't upgrade a layout edit to a 100-round full build.
`apply_data_change` = `add_field` / `rename_entity` → compiler-regenerates the schema + a
**data-preserving `ALTER TABLE`** migration. Fast, no full rebuild.

### Stage 3B — OCE GROWTH BUILD (`dispatchHatchetBuild` → scaffold `resolveAppSpec` → `growAppSpec`)

`growAppSpec(current, enhancement, attachments)` (`spec-interpreter.ts:595`) — the data-safe compiler grow:

```
plan = planFollowup(current, enhancement)
if plan.clarification: return { spec: current, clarify }        ← growth's OWN clarify gate (no executor runs)
split ops → structural {add,remove,rename} · modify · edit
structuralOps (planner's ORDERED list — compound applies IN FULL, each op sees the running spec):
  add    → unionSpecs(running, proposed)      ← KEEPS everything; never drops an entity (SHRINK-PROOF)
  remove → subtractSpec(running, proposed)    ← removes pages/reports/nav; PRESERVES all data tables (0 loss)
  rename → renameEntityInSpec(from,to)        ← ALTER TABLE old RENAME TO new (data-preserving)
                                                (non-entity "rename" = brand/copy → treated as add)
modify → applySpecChanges(spec, changes)      ← deterministic design/capability mutation (compiler regenerates)
edit   → editScopes(spec, targets, instr)     ← writes instruction into target page briefs → delta re-authors them
ONE validateAndRepairSpec over the fully-folded spec
→ { spec, added, removed?, renames?, clarify? }
```

The grown spec flows through the SAME durable workflow (Layers 8–10): compile emits **`__deltaSpawn`**
(only the CHANGED scopes) → the modules task's **delta pre-pass** fills + verifies just those pages →
preview → **production-gate runs on follow-ups too** (free regression guard) → finalize. Follow-up
builds inject `.onenexium/design.md` so new pages match the existing palette/tokens.

**Compound example** ("add a Comment entity AND remove the admin reports page AND rename Customer→Client"):
`planFollowup` splits it into an ordered op list; `growAppSpec` chains `add`→`remove`→`rename` onto the
running spec (each grounded in the prior), one validate at the end — all three land in a single follow-up.

---

## Layer 11 — Publish / Deploy (`server/project/publish-from-dev.ts`)

**User-triggered, not automatic.** The build's production-gate (Layer 7) runs `next build` + smoke on
the LOCAL dev preview and leaves the project `preview_ready` (which unlocks the Publish button). The
deploy-to-a-live-URL is a **separate durable background worker** started when the user clicks Publish
— it survives browser refresh and streams progress over SSE (`heartbeatSseStream`).

`publishFromDevPreview(projectId, userId, emit)` — ordered steps (each emits a `status`):

```
1. validating
2. syncing   → sync_project_to_aws            (rsync dev-worker SSD → s3://…/user-projects/{projectId}/)
3. building  → trigger_build                  (AWS CodeBuild "onenexium-site-builder" → Docker → ECR image)
                poll status (emit building %); on fail → fetch errors[] → throw
4. deploying (the PROD DATA LAYER — omitted from the old deploy doc):
     a. if !project.prodNeonProjectId:
          provision_production_database  → neonProjectId → save projects.prodNeonProjectId
             (LOCAL_INFRA=local → app_<hex>_prod PG; prod → Neon API. Assigned ONCE, first publish.)
     b. seedAccounts = alreadySeeded ? [] : buildSeedAccounts(projectId, userId, token)  (owner + role logins)
        run_production_setup { schema_push: true, seed_accounts }   → !ok → throw
     c. persist builderContext.seededLogins = [{ email, role, password }]   ← one-time test creds
        (so the editor's Test-Logins card can always show them; this branch's fix)
5. deploying → start_container                (ECS task → productionUrl; register_traefik_route inside)
6. verifyDeploymentReachable(productionUrl)   (HTTP health probe; non-fatal warn)
7. stop_dev_server (best-effort) ; resolve build_jobs UUID from CodeBuild imageTag
8. UPDATE projects SET status="live", productionUrl, liveBuildJobId, previewUrl=null,
     previewBuildJobId=null, devServerStatus="stopped"
9. emit { status:"live", url, accounts:[{ email, role, password }] }   ← passwords delivered ONCE here
     (sanitizePublishEventForStorage strips passwords from the durable event log)
→ { ok:true, productionUrl }
```

Distinction that matters: `status` goes `preview_ready` (build done, dev preview) → `live` (published).
`builderMode` stays `done`. The Publish gate (`canPublishProject`) requires a built artifact AND not
currently building.

---

## Cross-Cutting: Distributed Lock

### File: `server/ai/distributed-lock.ts`

```
Lease-renewal model:
  TTL = LOCK_LEASE_TTL_MS = 90s    ← expires 90s after LAST renew
  RENEW = LOCK_LEASE_RENEW_MS = 30s ← renewed every 30s (3× per TTL window)
  WAIT = BUILD_JOB_LOCK_WAIT_MS = 30s ← max wait to acquire

Redis (REDIS_URL set):
  Acquire: SET onenexium:lock:project:{id} {holder} NX PX 90000
  Renew:   EVAL lua "if redis.call('GET',k)==v then redis.call('PEXPIRE',k,ttl) end"
  Release: EVAL lua "if redis.call('GET',k)==v then redis.call('DEL',k) end"
  → Lua scripts are atomic; stale lock cannot be released by a different holder

In-memory fallback:
  Map<projectId, { holder, expiresAt }>
  Acquired with SET-if-absent semantics + expiry check
```

Lock key: `onenexium:lock:project:{projectId}` — one lock per project, regardless of how many workers are running.

---

## Cross-Cutting: Billing / Credit Engine

### Reservation lifecycle

```
Pre-flight check (before INSERT ai_build_jobs):
  SELECT creditBalance, reservedCredits FROM users WHERE id=userId FOR UPDATE
  available = creditBalance - reservedCredits
  if available < BUILD_MIN_VIABLE_CREDITS (5): reject

reserveSession(userId, featureKey, modelId, reserveAmount):
  INSERT credit_sessions { status: "active", reservedCredits: reserveAmount }
  UPDATE users SET reservedCredits = reservedCredits + reserveAmount

Mid-stream (every ~100 tokens):
  UPDATE credit_sessions SET usedCredits = $used WHERE id = $sessionId

settleSession(sessionId, actualUsed):
  UPDATE credit_sessions SET status="settled", settledCredits=actualUsed
  INSERT credit_tokens { transactionType: "usage", amount: -actualUsed }
  UPDATE users SET
    creditBalance = creditBalance - actualUsed,
    reservedCredits = reservedCredits - reserveAmount
  (all in ONE transaction)
```

### Payment gateways

| Gateway | Region | Webhook verification |
|---|---|---|
| Stripe | Global | `stripe.webhooks.constructEvent` |
| Razorpay | India | HMAC-SHA256 signature |
| Cashfree | India | HMAC-SHA256 + returnUrl flow |

---

## Cross-Cutting: Memory System

### Project memory facts

```
Extracted by memory-extractor.ts after each runAgentTurn():
  categories: decision | error_fix | entity | pattern | constraint
  importance: 0.0–1.0 (recency-weighted)
  isActive: false when superseded

Retrieved into LLM context:
  SELECT * FROM project_memory_facts
  WHERE projectId=$id AND isActive=true
  ORDER BY importance DESC, lastUsedAt DESC
  LIMIT 30
```

### Episodic memory (T5/T6)

```
Scope: "project" (local) or "global" (cross-project)
Types: failure_pattern | success_pattern | performance | build_turn

Promotion rule (fleet-wide consolidation):
  if >= 3 distinct projects learn the same trigger+lesson:
    scope = "global"   ← poisoning-guarded

Vector search (T6, when embedding model configured):
  embedding: pgvector (unbounded dim — model-switchable)
  query: SELECT … ORDER BY embedding <=> $queryVec
  dim-filtered: WHERE embedding_dim = $currentModelDim
```

### Component manifest

```
projects.fileManifest: Record<filePath, { exports: string[], imports: string[] }>
Updated after each fill turn (component-manifest.ts).
Injected into LLM context so the agent knows what's exported without reading every file.
```

---

## Cross-Cutting: Observability

### `ai_generation_runs` — per-turn record

```
model: actual model id (not alias)
inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens
totalCostCents: computed at insert
toolCallsJson: [{ name, ok, durationMs }]
status: running → succeeded | succeeded_with_errors | failed | rate_limited
tokenBreakdown: { systemPromptTokens, conversationTokens, summaryTokens,
                  memoryTokens, manifestTokens, sectionsIncluded, sectionsOmitted,
                  memoryFactsRecalled, compactionMetrics? }
budgetTrace: { truncatedRounds, maxConsecutiveTruncations, tierEscalations,
               finalToolOutputBudget }
```

### Langfuse

If `LANGFUSE_*` env set: `langfuse.ts` creates a trace per `runAgentTurn()` and spans per tool call. Trace ID stored on `ai_generation_runs.traceId`.

### Build events

`server/observability/build-events.ts`: emits `emitBuildEvent` to a structured log sink for dashboards.

`server/observability/harness-events.ts`: emits `emitHarnessEvent` for pipeline-phase timing.

---

## Configuration Reference (env vars)

| Variable | Default | Effect |
|---|---|---|
| `OCE_ENABLED` | off | Enable OCE pipeline |
| `HARNESS_V3` | off | Enable Harness V3 pipeline |
| `HATCHET_ENABLED` | off | Enable Hatchet durable execution |
| `HATCHET_USER_MAX_RUNS` | 2 | Per-user concurrent build cap |
| `HATCHET_WORKER_SLOTS` | 40 | Total fleet slots |
| `HATCHET_MILESTONE_CONTINUE_TIMEOUT` | 10m | Auto-continue after milestone pause |
| `OCE_LLM_CONCURRENCY` | 10 | Parallel LLM fill slots (max 12) |
| `BUILDS_WORKER_CONCURRENCY` | 12 | Jobs per orchestrator process (max 16) |
| `BUILDS_ORCHESTRATOR_POLL_MS` | 2000 | Job poll interval |
| `BUILDS_JOB_HEARTBEAT_MS` | 15000 | Heartbeat interval |
| `BUILDS_JOB_STALE_MS` | 50000 | Stale threshold for job reclaim |
| `BUILDS_TRANSIENT_MAX_RETRIES` | 10 | Max retries for transient failures |
| `BUILDS_REPAIR_MAX_RETRIES` | 3 | Max retries for repairable failures |
| `BUILDS_MIN_VIABLE_CREDITS` | 5 | Min credits to dispatch a job |
| `BUILDS_LINT_ADVISORY` | 1 | ESLint findings are advisory (not blocking) |
| `BUILDS_CLARIFY_CONFIDENCE` | 90 | Proceed without asking when confidence ≥ this |

---

## Layer 11 — Context Assembly (per LLM turn)

### File: `server/ai/context.ts`

Every `runAgentTurn()` call rebuilds the system prompt from five sources **in parallel**:

```
assembleContext(projectId, userId, intent):

  Parallel reads:
    1. workspaces row          — brand (name, industry, brandColor, fontStyle)
    2. projects row            — lifecycle, productionUrl, builderMode, builderContext
    3. project_pages[]         — declared routes/components (current app structure)
    4. project_messages[-10:]  — last 10 messages (short-term turn memory)
    5. MCP list_files          — live file tree (prevents hallucinated paths)

  Parallel memory reads:
    6. project_memory_facts (isActive, top 30 by importance)
    7. user_memory_facts (top 20 by confidence)
    8. ai_episodic_memory (project + global scope, active)
    9. knowledge_patterns (EKS, when EKS_ENABLED)

  Context sections assembled in order:
    systemBase + brief + projectMemory + turnEpisodes + architectureDecisions
    + designSystem + phaseSummary + astIntelligence + knowledgePatterns
    + episodicMemory + memoryFork + implementationSpec + manifestContext

  TokenBreakdown written to ai_generation_runs.tokenBreakdown:
    systemPromptTokens, conversationTokens, summaryTokens, memoryTokens,
    manifestTokens, sectionsIncluded[], sectionsOmitted[], memoryFactsRecalled
```

### Context Budget Controller (`context-budget.ts`)

Allocates the 199K token context window across all sources:

```
Total budget:      199,000 tokens
Output reserve:    -40,000
Conversation min:  60,000 guaranteed

4-tier priority allocation:
  Tier 1 (always):       brief + project memory goals
  Tier 2 (builds):       AST intelligence + phase summary
  Tier 3 (first build):  knowledge patterns (EKS)
  Tier 4 (returning):    memory fork + episodic memory

When a lower-tier source is too large, it is trimmed or omitted.
sectionsOmitted[] in TokenBreakdown records what was dropped.
```

### Between-Turn Compressor (`between-turn-compressor.ts`)

Deterministic (no LLM) compression of prior-turn assistant messages when loading conversation history:

```
compressMessageOnDemand(content, metadata):
  if estimateTokens(content) < 500: return content (no change)

  Extracts via regex:
    - File operations from metadata.toolCalls
    - Schema table names (pgTable mentions)
    - Architectural decisions ("I chose X because…")
    - Error fixes ("Fixed X by Y")

  Output: ~300-500 token structured summary
  Used as fallback when no ai_episodic_memory build_turn episode exists
```

### EKS — Engineering Knowledge System (`knowledge-selector.ts`, `server/db/schema.ts:knowledge_patterns`)

Curated engineering patterns injected into build context when `EKS_ENABLED=1`:

```
knowledge_patterns table:
  slug, category, tags[], industryTags[], docContent (full markdown),
  embedding vector, embeddingDim, priority, tokenEstimate

Pattern selection per turn (selectPatterns / selectPatternsForBuild):
  1. Tag match: extractTagsFromPlan(plan) → synonym expansion (TAG_SYNONYMS map)
  2. Industry match: requirements.industry.detected
  3. Semantic search (when embeddings present):
       WHERE embedding_dim = $currentDim
       ORDER BY embedding <=> $queryVec  (cosine distance)
  4. Filter by tokenEstimate to fit within Tier 3 budget
  5. formatKnowledgeSection() → injected into system prompt
```

---

## Layer 12 — Agent Turn Internals

### Files: `server/ai/agent-turn/`

These modules are extracted from the ~4,600-line `run-agent-turn.ts` body for testability.

### Tool execution policy (`tool-exec-policy.ts`)

```
Per-tool timeouts:
  trigger_build, start_dev_server    → 420,000ms (7 min)
  batch_write, write_file, apply_diff, rename_file → 90,000ms
  run_typecheck, run_lint, run_quality_suite → 120,000ms
  add_dependency, restart_dev_server → 90,000ms
  run_command                        → 30,000ms (INSTANT_FAIL, no override)
  default                            → 30,000ms

FORCE_SEQUENTIAL_TOOLS (run alone, never parallelized):
  trigger_build, start_dev_server, stop_dev_server,
  create_project, create_fullstack_project,
  run_quality_suite, batch_write

NON_CRITICAL_TOOLS (failure not counted in loop guards):
  search_images, web_search
```

### Loop guards (`loop-guards.ts`)

```
APPLY_DIFF_FILE_CAP = 3
  → if apply_diff fails 3× on the SAME file in one turn:
    strip apply_diff from toolset for the rest of the turn
    (agent forced to write_file; cannot evade by read→fail→read loop)

SCOPE_VIOLATION_CAP = 6
  → if agent writes outside assigned scope 6× in one turn (aggregate, non-resetting):
    hard-stop the turn immediately
    (deterministic: file is permanently off-limits, retry is futile)

isScopeViolationError(msg):
  /outside your assigned scope|is a compiler-owned file/i
```

### Safety rules (`system-prompt-augment.ts`)

Appended to every system prompt as non-negotiable overrides:

```
SAFETY_RULES:
  - NEVER delete all files or "start over" — ask first
  - NEVER add buttons/functions that execute system commands (rm, exec, eval, spawn)
  - NEVER remove all TypeScript types
  - NEVER convert entire project to a different framework
  - If request destroys >50% of existing files: REFUSE and explain
  - Destructive mass operations: always ask for confirmation first

Preview env section (buildPreviewEnvSection):
  Injects authoritative NEXTAUTH_URL, NEXT_PUBLIC_APP_URL, JWT_SECRET contract
  so agent never hardcodes localhost or secrets
```

---

## Layer 13 — Memory Dual-Write

### File: `server/ai/memory-dual-write.ts`

Every `.onenexium/` file write is dual-written to ensure durability if the EC2 instance is lost:

```
Primary:   MCP write_file → disk at /home/projects/{tenantId}/.onenexium/*
Secondary: projects.builderContext.memorySnapshot (Postgres)

MemorySnapshot {
  brief?: string           ← project brief (user request + Q&A + plan)
  goals?: string
  spec?: string            ← AppSpec JSON
  checkpoint?: string
  historyTail?: string     ← last 8,192 chars of conversation
  pageSpecs?: Record<route, string>
  appspec?: string         ← OCE IR (full reproducibility)
  appspecPrev?: string     ← prior revision for follow-up delta
  design?: string          ← design tokens (palette, typography)
  sourceSnapshot?: ...     ← LLM-authored fill content (NOT reproducible from AppSpec alone)
}

Retry queue: failed writes queued with MAX_RETRY_ATTEMPTS=3, RETRY_DELAY_MS=500
clearPendingWritesForProject(): called at job start to flush stale queue
captureOceSourceSnapshot(): called after compile to snapshot fill content (DR parity)
```

---

## Layer 14 — S3 Sync Before Production Build

### File: `server/ai/sync-project-to-s3.ts`

Before `trigger_build` is called (which fires CodeBuild), project files must be synced from the dev worker disk to S3, because **CodeBuild reads its source from `s3://…/user-projects/{projectId}/`**.

```
syncProjectToAwsBeforeBuild({ projectId, mcpToken, emit }):
  emit("Syncing project to S3…")
  callToolByName("sync_project_to_aws", { project_id: projectId }, { timeoutMs: 180,000ms })
  → MCP tool rsync/aws s3 sync from /home/projects/{tenantId}/ → S3 bucket
  → On completion: trigger_build can safely reference S3 source
```

Without this sync, `trigger_build` compiles an empty or stale tree.

---

## Layer 15 — Builder Mode State Machine (Full)

### File: `server/ai/builder-state-machine.ts`

14 states, enforced transitions via `transitionBuilderMode()`:

```
BuilderMode states:
  asking              ← Ask Mode Q&A running
  ask_complete        ← requirements gathered
  planning            ← planning mode running
  plan_complete       ← plan ready, ready to build
  building            ← build job dispatched
  build               ← alias (legacy)
  phase_paused        ← milestone pause awaiting continue
  job_running         ← Hatchet workflow active
  preview_ready       ← dev server up
  job_paused_credits  ← paused: insufficient credits
  job_paused_infra    ← paused: no worker capacity
  job_paused_user     ← paused: clarification awaited
  job_blocked         ← terminal failure
  done                ← build complete
  error               ← unrecoverable error

Key valid transitions (selected):
  null         → asking | building | planning
  asking       → ask_complete | building | planning
  plan_complete→ building
  building     → done | error | phase_paused | job_running | preview_ready
                 | job_paused_credits | job_paused_infra | job_paused_user | job_blocked
  job_paused_* → building (on resume)
  done         → building (follow-up build)
```

`forceBuilderMode()` is the only way to bypass the transition guard — used on recovery paths only.

---

## Layer 16 — Billing Internals

### Ledger (`server/billing/ledger.ts`)

4 hard invariants on every ledger write:

```
1. Idempotent: (userId, idempotencyKey) UNIQUE — Stripe webhook retries / run retries
   collapse to one row + one balance delta
2. Never negative: UPDATE users SET credit_balance = credit_balance + amount
   WHERE credit_balance + amount >= 0
   → two concurrent debits: exactly one wins, other returns INSUFFICIENT_FUNDS
3. Append-only: rows never UPDATE/DELETE (only status: active→expired/refunded/reversed)
4. Self-consistent: users.credit_balance == SUM(credit_tokens.amount WHERE status='active')
   at every commit boundary
```

### Stream meter (`server/billing/ai-stream-meter.ts`)

```
createCreditStreamMeter(sessionId, userId):
  every ~100 output tokens:
    UPDATE credit_sessions SET used_credits = $used
  on stream end:
    settleSession(sessionId, actualUsed):
      INSERT credit_tokens { transactionType: "usage", amount: -actualUsed }
      UPDATE users SET creditBalance -= actualUsed, reservedCredits -= reserveAmount
      UPDATE credit_sessions SET status = "settled"
      (all in ONE SQL transaction)
```

### Gateway router (`server/billing/gateway-router.ts`)

```
selectGateway(userId, country):
  user.preferredGateway override (set via billing settings)
  → stripe    (global default)
  → razorpay  (India — INR)
  → cashfree  (India — alternate)

Payment flow per gateway:
  Stripe:    create checkout session → webhook confirms → ledger credit
  Razorpay:  create order → client verify signature → webhook confirm → ledger
  Cashfree:  create order → returnUrl flow → webhook confirm → ledger

All gateways write payment_orders row (idempotencyKey unique) before redirect.
```

### Session sweep (`server/billing/session-sweep.ts`)

```
Stuck active sessions (crashed worker, no settleSession):
  SELECT * FROM credit_sessions WHERE status='active' AND expires_at < now()
  → UPDATE status = 'expired'
  → release reservedCredits back to user
  → no ledger row (no usage credited)
Runs on a periodic schedule to prevent phantom reservations.
```

---

## Layer 17 — Vector Search / Embeddings (T6)

### Files: `server/ai/retrieval/vector-search.ts`, `server/ai/embeddings.ts`

Used by two tables: `ai_episodic_memory` and `knowledge_patterns`.

```
pgvector cosine distance query:
  SELECT … FROM $table
  WHERE embedding IS NOT NULL AND embedding_dim = $currentModelDim
  ORDER BY embedding <=> $queryVec::vector
  LIMIT $limit

Dim-filter is mandatory: pgvector throws on cross-dimension comparisons.
Each row stores embeddingModel + embeddingDim so retrieval safely
filters when the admin switches embedding models.

embedForStorage(text): calls configured embedding provider → number[]
  Providers: Vertex text-embedding-004 (768d), OpenAI 3-small (1536d),
             OpenAI 3-large / Gemini (3072d)
  Provider selected from platform_settings (same admin panel as LLM)

Retriever<T> interface:
  retrieve(query: string, limit: number): Promise<T[] | null>
  Returns null when nothing embedded at current dimension → caller falls back
  to tag/count ranking (graceful degradation)
```

---

## Layer 18 — Deployment Pipeline (trigger_build → live)

### File: `onenexium-ai-core/tools/build_tools.py`

The `trigger_build` MCP tool fires AWS CodeBuild to containerize and deploy the generated app:

```
trigger_build(project_id):
  1. S3 sync must already be done (syncProjectToAwsBeforeBuild)
  2. cb.start_build(projectName="onenexium-site-builder",
       env: PROJECT_ID=project_id)
  3. Poll CodeBuild (adaptive: 10s intervals first 60s, then 5s)
  4. Stream CloudWatch logs back to agent (last 30 lines on failure)
  5. On SUCCEEDED: image pushed to ECR as {tenantId}:{buildId}

MCP deploy/ namespace (post-build):
  build_docker_image       → local Docker build (dev path)
  start_container          → ECS task start
  start_preview_container  → preview environment
  promote_preview_to_live  → swap preview → production
  stop_preview_container   → cleanup
  teardown_site            → full teardown
  register_traefik_route   → {subdomain}.sites.onenexium.com → container
  register_custom_domain   → custom domain + ACM SSL
  run_smoke_tests          → post-deploy HTTP health probes
```

**Full deploy flow**:
```
files on SSD → S3 sync → CodeBuild ("onenexium-site-builder")
  → Docker build → push ECR
  → ECS task start (or swap preview→live)
  → Traefik route registration → {subdomain}.sites.onenexium.com
  → update projects.productionUrl + projects.liveBuildJobId
  → durableEmit(live_url event) → browser LiveUrlCard
```

---

## Layer 19 — Agent Turn: Remaining Seams

### Tool result shaping (`agent-turn/tool-result-shaping.ts`)

```
trimToolResult(result, toolName):
  Condenses MCP response before it re-enters the conversation
  Large write_file results → { ok, file, _compacted: true }
  Large read results → first N chars + "…(trimmed)"

evictOldToolResults(messages, targetTokens):
  Replaces tool_result content from older rounds with compact summaries
  Preserves the last 2 rounds of tool results intact (recency bias)
  Runs when context exceeds COMPACT_THRESHOLD_TOKENS (160K)
```

### Tool pairing repair (`agent-turn/tool-pairing.ts`)

```
repairToolPairing(messages):
  Anthropic API invariant: every tool_use block MUST be followed by
  a tool_result in the next user message. Replay from Hatchet or
  message compaction can break this pairing.
  repairToolPairing() scans and inserts synthetic tool_result blocks
  for any orphaned tool_use → prevents API rejection errors.
```

### Page progress (`agent-turn/page-progress.ts`)

```
computePageProgress(writtenFiles, plannedPages):
  Maps file paths → routes (path↔route mapping)
  Detects route groups (app/(group)/page.tsx patterns)
  deriveBuildPhase(progress) → "designing"|"writing"|"checking"|"previewing"
  emitted as build_progress SSE event (pagesCompleted[], pagesRemaining[])
```

---

## Layer 20 — Skill System

### File: `server/ai/skills/index.ts`

Named, reusable prompt+tool combinations injected into system prompt **on-demand** when a specific pattern is detected — reduces token waste vs always-on instructions.

```
SkillId:
  crud_api | auth_flow | data_table | form_builder | dashboard_layout
  responsive_nav | image_gallery | search_filter | chart_widget | landing_page

Skill { id, name, description, triggers: RegExp[], instructions, requiredTools[] }

Activation: skill.triggers.some(rx => rx.test(userMessage))
  → instructions appended to system prompt for this turn only
  → requiredTools added to available toolset
  → reduces context size vs always including all instructions
```

---

## Layer 21 — AWS Infrastructure Layer

### Secrets

```
project_secrets table: metadata index only — key names, scope (server/client)
Values live in AWS Secrets Manager: {AWS_PROJECT_SECRETS_PREFIX}/{projectId}/{key}

MCP infra/ tools:
  store_secret(key, value) → Secrets Manager PutSecretValue
  get_secret(key) → Secrets Manager GetSecretValue

Runtime bootstrap (server/secrets/bootstrap-runtime-env.ts):
  At orchestrator worker startup: pull platform-level secrets
  (ANTHROPIC_API_KEY, MCP_AUTH_TOKEN, DB credentials) from Secrets Manager / SSM
  into process.env — avoids plaintext in .env files on production

AWS SES (server/aws/ses.ts):
  Transactional emails (signup-verification, password-reset, team-invite)
  Templates stored in email_templates table; rendered server-side before send
```

### S3 (`server/aws/s3.ts`)

```
Buckets:
  user-projects/{projectId}/   ← project source files (CodeBuild input)
  user-projects/{projectId}/assets/  ← uploaded media (project_assets table indexes these)
  workspace-templates/         ← template preview images

Operations: getSignedUrl (presigned upload), getObject, putObject, deleteObject
```

---

## Missing Layers (appended after verification pass)

---

## Ask Mode — Pre-Build Requirements Gathering

### File: `server/ai/ask-mode.ts`

Ask mode runs **before** any build job is created. The route invokes it inline (no job queue) when
`resolvedMode ∈ {ask, asking}`.

**⚠ Not an internal loop — ONE round per HTTP turn.** `runAskMode` runs a *single* LLM stream per
call and returns. The "multi-round" interview is spread across successive `POST /api/ai/chat`
requests (each user reply = one fresh `runAskMode`). The round number is a **persisted counter**
(`requirements.completeness.round` on `builderContext`), not an in-process loop. In the real
laptop-store trace this was **6 separate assistant turns**, not one looping call.

```
runAskMode(input):   // one turn

  1. Insert user message (stamp answeredQuestions = the prior turn's pendingAiQuestions — audit link)
  2. Load project.prompt + last 20 messages + builderContext (accumulated requirements + rubric)
  3. assembleAskContext(): { userProfile, workspace brand, template, projectHistory, promptSpecificity }
  4. FIRST TURN ONLY — if !builderContext.readinessRubric:
       generateReadinessRubric(client, model, prompt)  → persisted, reused every later turn
       rubric = { industry: string, criteria: [{ id, label, weight 1–5, description }] }   (8–12 criteria)
  5. systemPrompt = buildAskModeSystemPrompt(prompt, history, askContext, currentRequirements)
                    + buildRubricSection(rubric)
  6. client.messages.stream({ model = selectModelForMode("asking"), max_tokens 16384 })
  7. AS TOKENS STREAM:
       emit { type:"text" } deltas
       parse the ```nexium-questions | ```questions | ```json fence incrementally →
         emit { type:"ai_question", questionIndex, totalQuestions, question, options } LIVE
         (event is `ai_question`, NOT `clarification`; questions render before the turn finishes)
  8. AFTER STREAM — decide complete vs another round (3-guard gate, below)
```

**Completion gate — three server-side guards (the model's `[REQUIREMENTS_COMPLETE]` is not trusted):**

```
requirementsComplete = assistantText.includes("[REQUIREMENTS_COMPLETE]")
effectiveScore = readiness?.overallScore ?? keywordCompleteness?.overallScore ?? 0
                 (readiness = scoreReadiness(rubric, parseReadinessCoverage(text)) — LLM-judged, primary;
                  keyword completeness = computeCompleteness(requirementsDoc) — fallback)

GUARD A  floorVeto = requirementsComplete && effectiveScore < COMPLETION_FLOOR(85) && round < MAX_ASK_ROUNDS(6)
           → SYNTHESIZE gap questions (generateGapQuestions from rubric.unsatisfied →
             staticGapQuestions → synthesizeGapQuestions(snapshot)) and force another round;
             displayPersist = "Almost there — just a couple more quick details so I build exactly…"
GUARD B  forceComplete = (!requirementsComplete && round >= MAX_ASK_ROUNDS) || stranded
GUARD C  stranded = floorVeto && no questions could be synthesized  → allow completion anyway

effectiveComplete = (requirementsComplete && !floorVeto) || forceComplete
```

```
IF effectiveComplete:
   requirementsSummary = model's "## Requirements Summary" section
                         ?? synthesizeSummaryFromRequirements(doc) (when forced at the cap)
   transitionBuilderMode("ask_complete", { builderContext: { requirementsSummary,
       pendingAiQuestions:null, readinessRubric, requirements } })
   emit { mode_change: "ask_complete", "Requirements gathered. Ready to plan your project." }
ELSE (another round):
   parse+accumulate RequirementsDocument { businessAreas[], nonFunctional{}, industry, completeness }
   round++ ; emit { completeness, score, round }
   forceBuilderMode("asking", { builderContext: { readinessRubric, pendingAiQuestions, requirements } })
```

**Completeness floor**: `COMPLETION_FLOOR = 85`. Below it, a self-declared `[REQUIREMENTS_COMPLETE]`
is vetoed and another round forced (raised from 75 → 85 to force coverage of trailing categories,
which is exactly why the laptop store asked 6 times). `MAX_ASK_ROUNDS = 6` is the hard backstop.
On completion the transition is **`ask_complete`** (NOT `plan_complete`/`planning`).

---

## Clarification Gate (C1) — Mid-Build Confidence Pause

### File: `server/ai/build-jobs/clarification.ts`

The spec interpreter emits a `_confidence` field (0–100) and optional `_clarifications[]` alongside the AppSpec JSON. The clarification gate reads these before dispatching the build.

```
shouldPauseForClarification({ confidence, clarifications, clarifyRoundCount }):

  confidence_pct = confidence <= 1 ? confidence * 100 : confidence

  if confidence_pct >= CLARIFY_CONFIDENCE_THRESHOLD (90): return null  ← proceed
  if clarifyRoundCount >= CLARIFY_MAX_ROUNDS (3): return null           ← stop asking
  valid = clarifications.filter(q => q.id && q.question.trim())
  if valid.length == 0: return null
  return valid.slice(0, CLARIFY_MAX_PER_ROUND (5))   ← batch this round
```

**Pause flow**:
```
1. spec handler writes AppSpec + _confidence < 90 + _clarifications[]
2. clarification gate returns questions[]
3. job.status = "paused", job.pauseReason = "clarification"
4. updateBuildProgress({ pendingClarification: { questions }, status: "paused" })
5. durableEmit(clarification event) → QuestionCard renders in browser
6. User answers → POST /api/ai/chat { clarifyAnswers: { [id]: answer } }
7. applyAnswersToContext(answers) → compact constraint block → re-run spec stage
```

`CLARIFY_FREEFORM_KEY = "__freeform__"` — user can also answer in free prose (not just option picks).

---

## Universal LLM Client

### File: `server/ai/llm-client.ts`

All LLM calls go through a single `createLlmClientAsync()` factory. Every caller uses Anthropic SDK types regardless of underlying provider.

```
UniversalLlmClient {
  messages: {
    create(body: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>
    stream(body: Anthropic.MessageStreamParams): UniversalMessageStream
  }
}
```

**Provider selection priority**:
```
1. platform_settings (DB) → Super Admin → System → AI Models panel
2. Environment variables
3. Default: anthropic / direct
```

**Supported providers**:

| Company | Deployment | SDK used |
|---|---|---|
| `anthropic` | `direct` | `@anthropic-ai/sdk` (native) |
| `anthropic` | `vertex` | `@anthropic-ai/vertex-sdk` |
| `anthropic` | `bedrock` | `@anthropic-ai/bedrock-sdk` |
| `openai` | `direct` | `openai` SDK → Anthropic format adapter |
| `google` | `direct` | `@google/generative-ai` → Anthropic format adapter |
| `google` | `vertex` | `@google/genai` + `google-auth-library` → adapter |
| `glm` | `direct` | OpenAI-compat SDK with custom `baseURL` |

**Auto-region probe**: when `deployment = "auto"`, the client pings Vertex regions and picks the lowest-latency one. Result cached for the process lifetime.

---

## Model Routing

### Files: `server/ai/model-routing.ts`, `server/config/ai-config.ts`

Model IDs come from the **Super Admin → System → AI Models** panel (stored in `platform_settings`), never hardcoded.

```
ModelTierIds {
  opus:   models.buildingModel   || DEFAULT  ← heavy reasoning / first build turn
  sonnet: models.askingModel     || DEFAULT  ← ask mode, follow-ups
  haiku:  models.classifierModel || DEFAULT  ← classification, quick checks
}

Admin model config (platform_settings key "ai_models"):
  buildingModel:   model id used for fill/heal/spec (build stages)
  planningModel:   model id used for planning mode
  askingModel:     model id used for ask mode
  editingModel:    model id used for editing follow-ups
  classifierModel: model id used for intent classification

Tier selection per message (selectTier):
  isFirstUserTurn → "opus"
  COMPLEX_SIGNALS match (architect/refactor entire/redesign/from scratch) → "opus"
  oneLiner (≤120 chars, no newline) + SIMPLE_EDIT_SIGNALS (change/fix/color/font) → "haiku"
  default → "sonnet"
```

Config cache TTL: 60 seconds (re-reads DB if stale so admin changes take effect without restart).

---

## Harness V3 Gates

### Files: `server/ai/harness-v3/gates/`

10 gates run inside each `runAgentTurn()` call (Harness V3 mode only). Gates intercept the tool loop at four phases and either nudge the agent or terminate the turn early.

```
GatePhase: "pre-tool" | "post-tool" | "post-response" | "pre-turn-end"
GateAction: pass | block { nudge: string } | terminate { reason: string }
```

**Gate list** (in evaluation order):

| Gate | Phase | Condition → Action |
|---|---|---|
| `readBeforeFixGate` | pre-tool | Agent calls write_file without reading it first → block (nudge: read first) |
| `coordinatorDelegatedVerificationGate` | pre-tool | Agent tries to verify inside a coordinator turn → block |
| `actionClaimEnforcementGate` | pre-tool | Agent claims fix/preview before doing the work → block |
| `verifyAfterApplyGate` | post-tool | Agent applied a diff but didn't run typecheck → block |
| `routeVerificationBlockingGate` | post-tool | Agent skips route verification → block |
| `noEmptyBatchWriteGate` | pre-tool | Agent calls write_file with empty content → block |
| `scaffoldBeforeWriteGate` | pre-tool | Agent writes before scaffold is confirmed → block |
| `preferApplyDiffOverRewriteGate` | pre-tool | Agent rewrites a file already written this turn → block (nudge: use apply_diff) |
| `devServerBeforePreviewClaimGate` | pre-tool | Agent claims preview before dev server is started → block |
| `conversationalWriteTerminationGate` | pre-turn-end | Repeated blocked writes without change → terminate |

Gate disabled per-gate via env: `HARNESS_V3_GATE_{GATE_ID_UPPER}=0`.

`terminate` is decisive — stops gate evaluation and hard-stops the turn. Used when `blockedWriteCount` shows the agent is stuck in a loop.

---

## AppSpec Archetypes

### File: `server/engine/archetypes/index.ts`

Archetypes are **partial AppSpec seeds** (pure data, not code paths). The spec interpreter picks the closest archetype based on the user's request and uses it as a starting template, reducing hallucinated structure.

```typescript
AppClass: "pure-frontend" | "frontend-light-backend" | "fullstack-lob" | "fullstack-saas"

Archetype {
  ref: string         // key used in AppSpec.archetypeRef
  title: string
  appClass: AppClass
  description: string
  seed: Partial<AppSpec>   // omits schemaVersion + name
}
```

**Registered archetypes** (selected):

| ref | appClass | Description |
|---|---|---|
| `landing` | `pure-frontend` | Single marketing page, no DB, no auth |
| `portfolio` | `pure-frontend` | Static multi-page site (portfolio, docs, brochure) |
| `blog` | `pure-frontend` | Content site with listing/detail pattern |
| `saas-basic` | `frontend-light-backend` | SaaS with auth + dashboard, light data model |
| `lob-crud` | `fullstack-lob` | Line-of-business CRUD app with RBAC |
| `marketplace` | `fullstack-saas` | Multi-sided marketplace with payments |

The interpreter emits `archetypeRef` in the AppSpec JSON. The compile stage reads it to apply archetype-specific defaults (page kinds, scaffold tier).

---

## Spec Interpreter — LLM → AppSpec

### File: `server/ai/harness-v3/oce/spec-interpreter.ts`

The `spec` stage handler calls the universal LLM client to translate the user's prompt into a validated AppSpec JSON object.

```
interpretSpec({ projectId, userMessage, clarifyAnswers?, existingSpec? }):

  1. listArchetypes() → inject catalog into system prompt
  2. describeProject(projectId) → workspace/industry context
  3. selectModelForMode("spec") → opus-tier (first build / complex request)
  4. createLlmClientAsync() → UniversalLlmClient
  5. messages.create({
       system: SPEC_SYSTEM_PROMPT (tier classification rules + AppSpec shape),
       messages: [{ role: "user", content: userMessage }],
       max_tokens: 4096
     })
  6. Parse JSON from response
  7. Apply archetype defaults: applyArchetypeDefaults(spec)
  8. Ensure auth pages present: ensureAuthPages(spec)
  9. parseAppSpec(spec) — Zod validation + injection sanitization → throws on invalid
  10. Emit:
        _confidence: 0..100  ← clarification gate reads this
        _clarifications: []  ← questions to ask if confidence < threshold
        _tier: "basic" | "fullstack"

Tier decision (built into system prompt):
  "basic"     = static/presentational, no accounts, nothing to store
  "fullstack" = stores data OR has user accounts OR RBAC OR payments

Offline stub (no LLM credentials):
  returns a deterministic minimal spec (confident, no clarifications)
  keeps the pipeline runnable in CI / dev without API keys
```

---

## Context Compactor

### File: `server/ai/context-compactor.ts`

Every `runAgentTurn()` call runs the compactor before sending messages to the LLM, to keep the context within the model's window.

```
Token budget constants:
  MAX_CONTEXT_TOKENS         = 199,000
  COMPACT_THRESHOLD_TOKENS   = 160,000
  SYSTEM_PROMPT_RESERVE      = 8,000
  OUTPUT_RESERVE             = 40,000
  USABLE_CONVERSATION_BUDGET = MAX - SYSTEM_RESERVE - OUTPUT_RESERVE = 151,000

Token estimation: chars / 4 (approximation)

3-tier message importance:
  HIGH:   schema.ts / layout.tsx / types/index.ts edits; architecture/decision keywords
  MEDIUM: write_file / apply_diff tool calls; error/fix discussions; long tool results
  LOW:    everything else

Compaction strategy (when conversationTokens > COMPACT_THRESHOLD_TOKENS):
  1. Tool results > 200 chars → summarize to { ok, file, _compacted: true } or truncate to 150 chars
  2. Assistant text > 500 chars → truncate to 300 + "…(earlier text compacted)"
  3. LOW-importance messages dropped first (oldest → newest)
  4. MEDIUM-importance messages dropped next if still over budget
  5. HIGH-importance messages never dropped
  6. First user message and last assistant message always preserved (conversation bookends)
```

---

## Execution Phase Machine

### Files: `server/ai/execution-plane/phase-machine.ts`, `server/ai/execution-plane/per.ts`

The **Project Execution Record (PER)** (`project_execution` table) is the single authority for a project's lifecycle phase. Every actor reads placement/phase from here — no actor recomputes it independently.

```
ExecutionPhase lifecycle:
  created          ← row inserted on first build dispatch
    ↓
  placed           ← assignedWorkerIp + placementEpoch set (fencing token)
    ↓
  scaffolded       ← scaffold stage complete, base files on worker
    ↓
  provisioned      ← Neon DB provisioned + secrets ready (if needsDatabase)
    ↓
  building         ← fill/verify waves running
    ↓
  verified         ← all modules verified
    ↓
  preview          ← dev server up, preview URL emitted

  Terminal (reachable from any active phase):
    blocked        ← build failed, needs operator intervention
    failed         ← unrecoverable error
    cancelled      ← user cancelled

  Paused (recoverable):
    paused_infra   ← waiting for worker capacity
    paused_credits ← waiting for credit top-up
```

**Precondition guards** (pure, in `phase-machine.ts`):
```
canTransitionTo(snapshot, targetPhase):
  placed:      assignedWorkerIp != null
  scaffolded:  scaffoldState == "complete" && filesPresentOnWorker
  provisioned: !needsDatabase OR (dbProvisionState == "ready" && secretsReady)
  building:    phase == "provisioned"
  verified:    phase == "building"
  preview:     phase == "verified"
```

**Fencing token** (`placementEpoch`): bumped on every (re)assignment. Stale-epoch writes are rejected — prevents a crashed worker from re-assigning after a new one claimed the project.

---

## Build State — Job-Scoped Operational Memory

### File: `server/ai/harness-v3/memory/build-state.ts`

Tracks what has been done within a single build job so LLM turns don't repeat work or install packages already present.

```typescript
BuildStateDoc {
  jobId: string
  installedPackages: InstalledPackage[]   // { name, version, addedBy: route | "tarball" }
  writtenFiles: WrittenFile[]             // { path, exports[], writtenBy, verified }
  completedModules: string[]              // module slugs whose verify passed
}
```

**Pre-installed tarball packages** (always available without `add_dependency`):
```
next@15.1.0, react@19.2.7, react-dom@19.2.7, lucide-react@1.21.0,
clsx@2.1.1, tailwind-merge@2.6.1, framer-motion@12.40.0,
recharts@3.8.1, zustand@5.0.14, sonner@2.0.7, zod@4.4.3,
@tanstack/react-table@8.21.3, drizzle-orm@0.45.2,
@neondatabase/serverless@0.10.0, typescript@5.x, tailwindcss@3.x
```

Persisted in `projects.builderContext.buildState` → survives process restarts and is readable by all parallel fill workers in the same wave.

---

## Brief Composer — Rich Context Assembly

### File: `server/ai/harness-v3/oce/brief-composer.ts`

Aggregates every available source of truth into a structured `brief.md` written at `spec` stage and read by `fill`, `enrich`, `heal` handlers. This is why fill agents have full project context without re-running ask mode.

**Workspace file paths** (all under `.onenexium/`):
```
APPSPEC_PATH       = ".onenexium/appspec.json"      ← compiled IR
APPSPEC_PREV_PATH  = ".onenexium/appspec.prev.json" ← prior revision (follow-up delta)
BUILT_MARKER_PATH  = ".onenexium/built.json"        ← durable "full build done" marker
SCHEMA_RENAMES_PATH= ".onenexium/schema-renames.json" ← table renames for safe migrations
BRIEF_PATH         = ".onenexium/brief.md"          ← this module writes here
DESIGN_PATH        = ".onenexium/design.md"         ← design agent writes here
PAGES_DIR          = ".onenexium/pages/"            ← per-page spec stubs
```

**brief.md sections** (in order, each section added only if data exists):
```
1. ## User Request         ← raw userMessage (always present)
2. ## Requirements Summary ← ask-mode distilled summary (if different from userMessage)
3. ## Industry             ← requirements.industry.detected
4. ## Business Areas       ← confirmed businessAreas[] with priority + details
5. ## Non-Functional Requirements ← needed NFRs (auth, perf, i18n, etc.)
6. ## Constraints          ← hard constraints from Q&A
7. ## Builder Plan         ← pages[], components[], styling, features, techDecisions
8. ## Data Model           ← entities[] from AppSpec (names, fields, relations)
9. ## Auth & RBAC          ← roles, providers, defaultSignupRole
```

---

## Design Agent

### File: `server/ai/harness-v3/oce/design-agent.ts`

The `design` stage runs a **separate, dedicated LLM call** (not `runAgentTurn`) through the universal LLM client. Its sole job is to produce design tokens that make every generated app look visually distinct.

```
runDesignAgent({ projectId, spec, plan, userPreferences }):

  Authority chain (explicit user input always wins):
    1. Style preferences from ask-mode Q&A (hard constraints)
    2. Workspace brandColor + fontStyle
    3. BuilderPlan.styling (colorScheme / fontStyle / layout)
    4. Industry / voice-derived defaults (agent's creative fill)

  Output shape (strictly validated):
  {
    palette: { primary, secondary, accent, background, foreground, muted }
    typography: { heading: fontFamily, body: fontFamily }
    radius: "none"|"sm"|"md"|"lg"|"xl"
    density: "compact"|"comfortable"|"spacious"
    shadowStyle: "none"|"soft"|"sharp"
    surfaceStyle: "flat"|"soft"|"glassy"
    layout: { navStyle: "static"|"sticky", containerWidth: "md"|"lg"|"xl" }
    voice: string   ← one-phrase brand voice
  }

Validation:
  - All colors validated as #hex via DesignSchema.safeParse()
  - foreground WCAG AA ≥7:1 contrast on background (checked post-parse)
  - muted WCAG AA ≥4.5:1 contrast on background
  - Injection guard: colors cannot contain CSS variables or calc() expressions

Offline fallback (no LLM credentials):
  Deterministic derivation from spec.theme.preset → varied but functional tokens
  Never blocks the build.

Written to .onenexium/design.md → compile stage reads and bakes into:
  - globals.css (CSS custom properties: --color-primary, --font-heading, etc.)
  - tailwind.config.ts (extend.colors, extend.fontFamily)
  - Component kit base styles
```

---

*Last updated: 2026-07-10. This document tracks the actual code — update it when the system changes.*
