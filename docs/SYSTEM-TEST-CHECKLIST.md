# Nexium OS — Full-System Verification Checklist

> **Product:** OneNexium **Management System** (this repo) — live at https://team.1nexium.com  
> **Not the AI app-builder mono** (projects / OCE / Hatchet / Stripe). That checklist does not apply here.  
> **Last full smoke:** 2026-07-15 via [`scripts/full-system-smoke.sh`](../scripts/full-system-smoke.sh) on production VM.  
> **Result:** **61/61 PASS** (login all 4 roles, module GETs, CRUD+cleanup, role guards, MinIO, Planning IDOR). Extra checks: team-add forbid for non-SA, HR forbid for DEV, workstation forbid for DEV — all OK.  
> **Rule:** Prefer GET + create/delete cleanup; do not leave `sys-smoke-*` rows.

**Legend** — Priority: P0 blocker · P1 core · P2 secondary.  
Mark `[x]` when verified. Failures note observed result + date.

**Demo accounts**

| Role | Email | Password |
|------|--------|----------|
| Super Admin | `admin@onenexium.com` | `admin123` |
| Product Manager | `pm@onenexium.com` | `pm123` |
| Engineering Lead | `englead@onenexium.com` | `englead123` |
| Developer | `dev@onenexium.com` | `dev123` |

---

## 1. Authentication & Accounts  (`app/login`, `app/api/auth`)

| Status | Item | Notes |
|--------|------|--------|
| [x] | P0 **Login** — all 4 demo roles | 200 each |
| [x] | P0 **Login (wrong password)** | 401 |
| [x] | P0 **Session** | Cookie works for subsequent APIs |
| [x] | P0 **Auth boundary** | No cookie → middleware 307 → `/login` |
| [x] | P0 **Logout** | Admin logout 200 |
| [x] | P2 **Google OAuth route** | `/api/auth/google` reachable when configured |
| N/A | Signup / verify-email / forgot-password | Invite via Settings (SA) |
| Manual | P1 Browser Google allowlist sign-in | Needs human + allowlisted Google account |

---

## 2. Shell & Module pages  (HTML with session)

| Status | Role / path | Notes |
|--------|-------------|--------|
| [x] | ADMIN all main modules | 200 (incl. `/customers`, `/terminal`) |
| [x] | DEV `/planning`, `/bugs` | 200 |
| [x] | DEV `/customers`, `/terminal`, `/hr` | Redirect home (deny) |
| [x] | PM `/roadmap`, `/hr` | 200 |
| [x] | PM `/customers`, `/terminal` | Redirect home |
| [x] | EL `/terminal`, `/hr` | 200 |
| [x] | EL `/customers` | Redirect home |

---

## 3. Core module APIs (GET as admin)

| Status | API |
|--------|-----|
| [x] | `/api/dashboard` |
| [x] | `/api/notifications` |
| [x] | `/api/planning/board` |
| [x] | `/api/roadmap` |
| [x] | `/api/backlog` |
| [x] | `/api/tasks` |
| [x] | `/api/sprints` |
| [x] | `/api/bugs` |
| [x] | `/api/documents` |
| [x] | `/api/pipeline` |
| [x] | `/api/customers` |
| [x] | `/api/hr/onboarding` |
| [x] | `/api/infrastructure/status` |
| [x] | `/api/workstation/devices` |
| [x] | `/api/settings/team-members` |
| [x] | `/api/settings/phases` |
| [x] | `/api/mail/accounts` |
| [x] | `/api/quarters` |
| [x] | `/api/feature-requests` |
| [x] | `/api/support-tickets` |

---

## 4. File storage (MinIO)

| Status | Item | Notes |
|--------|------|--------|
| [x] | P0 Upload `POST /api/upload` | MinIO URL under `/api/files/…` |
| [x] | P0 Download `GET /api/files/…` | 200 with session |
| [x] | P0 Planning attach + cleanup | Covered in prior + board CRUD |
| [x] | P1 Documents create/delete wiki | 200 |

---

## 5. Delivery CRUD (create → delete cleanup)

| Status | Item | Notes |
|--------|------|--------|
| [x] | Admin roadmap create/delete | 200 |
| [x] | Admin backlog create/delete | 200 |
| [x] | Admin bug create/delete | 200 |
| [x] | Admin customer create/delete | 200 |
| [x] | PM roadmap create | 200 (+ cleanup) |
| [x] | DEV bug create | 200 (+ cleanup) |
| [x] | DEV cannot create backlog/roadmap | 403 |

---

## 6. Role & security gates

| Status | Item | Notes |
|--------|------|--------|
| [x] | Docs matrix | `docs/ROLES-AND-PERMISSIONS.md` |
| [x] | DEV/PM customers API | 403 |
| [x] | DEV HR API | 403 |
| [x] | DEV workstation devices | 403 |
| [x] | Only SA can `POST /api/settings/team-members` | DEV/PM → 403 |
| [x] | Planning IDOR | EL PATCH on admin card → **404** |
| Config | AI Terminal interpret | 400 if no `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` — expected until keys set in `.env` |

---

## 7. Settings / HR / Infra / Mail (API level)

| Status | Item | Notes |
|--------|------|--------|
| [x] | Phases GET | Returns org phases e.g. `Phase 1`, `Phase 2` |
| [x] | Team members GET | 200 |
| [x] | HR onboarding list (admin) | 200 |
| [x] | Infrastructure status | 200 (view; EC2 actions need AWS creds) |
| Manual | Browser: Workspace phases save UI | Spot-check |
| Manual | Browser: HR create + public token | Spot-check |
| Manual | Inbox Gmail OAuth | Needs Google OAuth client |
| Manual | Workstation agent register | Needs laptop agent |
| Manual | Infra EC2 start/stop | Needs AWS keys on VM |

---

## 8. Planning UX

| Status | Item | Notes |
|--------|------|--------|
| [x] | MinIO upload UX on cards | Deployed earlier |
| Note | Boards are **personal** per user | Different column names across users is expected |

---

## 9. Infra health (production VM)

| Status | Item |
|--------|------|
| [x] | `onenexium-app-1` + `onenexium-minio-1` |
| [x] | HTTPS `team.1nexium.com` |
| [x] | Neon + migrations on deploy |

---

## 10. Automated suites

| Status | Item | Notes |
|--------|------|--------|
| [x] | Production smoke script | `scripts/full-system-smoke.sh` — 61/61 pass (2026-07-15) |
| [x] | `npm run build` | Used on every GCP deploy |
| Manual | `npm run lint` locally when changing code | |

---

## How to re-run

On the GCP VM (or any host that can reach the app):

```bash
# Against local container bind
BASE=http://127.0.0.1:8080 bash scripts/full-system-smoke.sh
```

Or SCP the script and run after `gcloud compute ssh onenexium-vm-4gb`.

---

## Mapping from legacy Downloads checklist

AI-builder sections (projects, OCE, Hatchet, Stripe, PM2) remain **out of scope** for this management system.

---

## Verdict (2026-07-15)

**Core product features respond correctly under role rules.** No API/module regressions found in the smoke suite. Remaining gaps are **environment/config** (AI Terminal keys, optional AWS/mail OAuth, browser-only UI spot-checks), not broken application code.
