# Nexium OS — Roles & Permissions

**Status:** Finalized and enforced in code (page guards + APIs + sidebar).  
**Source of truth:** `lib/constants.ts` (`NAV_MODULES`), `lib/permissions.ts`, `lib/route-access.ts`  
**Primary roles (assignable in Settings → Add user):** Super Admin · Product Manager · Engineering Lead · Developer

| Legend | Meaning |
|--------|---------|
| ✅ | Allowed |
| 👁 | View / use only (limited or no create-edit-admin) |
| ❌ | Not allowed / not in sidebar (deep links redirect home) |
| — | Soft-archived (page redirects home; not part of primary product) |

---

## 1. Who each role is for

| Role | Job in one line |
|------|-----------------|
| **Super Admin** | Runs the organisation — people, mail config, infra, everything |
| **Product Manager** | Owns product direction — roadmap, backlog, phases, HR onboarding |
| **Engineering Lead** | Owns delivery & ops — sprint, bugs, AI terminal, infra actions |
| **Developer** | Day-to-day build — sprint tasks & bugs |

> **GTM Manager** and **Customer Success** still exist in the database for older seed data. They are **not** offered when adding users. Customer Success **page** is visible only to Super Admin.

---

## 2. Sidebar pages (can open the module?)

| Page | Path | Super Admin | Product Manager | Eng Lead | Developer |
|------|------|:-----------:|:---------------:|:--------:|:---------:|
| Command Centre | `/` | ✅ | ✅ | ✅ | ✅ |
| Inbox | `/inbox` | ✅ | ✅ | ✅ | ✅ |
| Planning | `/planning` | ✅ | ✅ | ✅ | ✅ |
| Roadmap | `/roadmap` | ✅ | ✅ | ✅ | ✅ |
| Backlog | `/backlog` | ✅ | ✅ | ✅ | ✅ |
| Sprint Board | `/sprint` | ✅ | ✅ | ✅ | ✅ |
| Bug Tracker | `/bugs` | ✅ | ✅ | ✅ | ✅ |
| Customer Success | `/customers` | ✅ | ❌ | ❌ | ❌ |
| Documents | `/documents` | ✅ | ✅ | ✅ | ✅ |
| Pipeline | `/pipeline` | ✅ | ✅ | ✅ | ✅ |
| Infrastructure | `/infrastructure` | ✅ | ✅ | ✅ | ✅ |
| AI Terminal | `/terminal` | ✅ | ❌ | ✅ | ❌ |
| HR | `/hr` | ✅ | ✅ | ✅ | ❌ |
| Workstation | `/workstation` | ✅ | ✅ | ✅ | ❌ |
| Settings | `/settings` | ✅ | ✅ | ✅ | ✅ |
| GTM (archived) | `/gtm` | — | — | — | — |
| OKRs (archived) | `/okrs` | — | — | — | — |

Unauthorized deep links to a module redirect to `/` via `requireModuleAccess`.

---

## 3. Feature / action permissions

### Product delivery

| Action | Super Admin | Product Manager | Eng Lead | Developer |
|--------|:-----------:|:---------------:|:--------:|:---------:|
| Edit roadmap (create / update / delete) | ✅ | ✅ | ❌* | ❌ |
| Edit Engineering roadmap items only | ✅ | ✅ | ✅ | ❌ |
| Set roadmap item public | ✅ | ❌ | ❌ | ❌ |
| Update Engineering item status | ✅ | ✅ | ✅ | ❌ |
| Edit backlog / feature requests (create backlog, accept/reject) | ✅ | ✅ | ❌ | ❌ |
| Submit feature request (inbox) | ✅ | ✅ | ✅ | ✅ |
| Edit sprint & tasks | ✅ | ✅ | ✅ | ✅ |
| Edit bugs | ✅ | ✅ | ✅ | ✅ |
| Use planning board | ✅ | ✅ | ✅ | ✅ |

\*Eng Lead can edit items assigned to **Engineering** team only.

### Ops & tools

| Action | Super Admin | Product Manager | Eng Lead | Developer |
|--------|:-----------:|:---------------:|:--------:|:---------:|
| View infrastructure | ✅ | ✅ | ✅ | ✅ |
| Manage infrastructure (e.g. EC2 start/stop) | ✅ | ❌ | ✅ | ❌ |
| Use AI Terminal | ✅ | ❌ | ✅ | ❌ |
| View workstation telemetry | ✅ | ✅ | ✅ | ❌ |
| Manage workstation devices | ✅ | ❌ | ❌ | ❌ |

### People & org settings

| Action | Super Admin | Product Manager | Eng Lead | Developer |
|--------|:-----------:|:---------------:|:--------:|:---------:|
| Add / edit / remove team members | ✅ | ❌ | ❌ | ❌ |
| Reset member passwords | ✅ | ❌ | ❌ | ❌ |
| Manage workspace phases (Settings → Workspace) | ✅ | ✅ | ❌ | ❌ |
| Manage mail provider config (Gmail / Resend) | ✅ | ❌ | ❌ | ❌ |
| View Settings → Team (read-only if not admin) | ✅ | ✅ | ✅ | ✅ |
| View HR module | ✅ | ✅ | ✅ | ❌ |
| Manage HR onboarding | ✅ | ✅ | ❌ | ❌ |

### Customer Success (page for Super Admin)

| Action | Super Admin | Notes |
|--------|:-----------:|-------|
| View / edit customers, tickets, etc. | ✅ | CS role in DB also allowed by API; not assignable in UI |

---

## 4. Demo logins (shared Neon DB)

| Role | Email | Password |
|------|--------|----------|
| Super Admin | `admin@onenexium.com` | `admin123` |
| Product Manager | `pm@onenexium.com` | `pm123` |
| Engineering Lead | `englead@onenexium.com` | `englead123` |
| Developer | `dev@onenexium.com` | `dev123` |

Live app: https://team.1nexium.com/login

---

## 5. Locked decisions

| # | Decision | Locked |
|---|----------|--------|
| 1 | Only 4 assignable roles | Yes |
| 2 | Customer Success page = Super Admin only | Yes |
| 3 | Developer can open Roadmap/Backlog but not edit | Yes |
| 4 | Eng Lead AI Terminal + infra manage | Yes |
| 5 | Only Super Admin manages team | Yes |
| 6 | GTM / OKR stay archived | Yes |

---

## 6. Code reference

| What | Where |
|------|--------|
| Sidebar who sees which page | `lib/constants.ts` → `NAV_MODULES` |
| Route deep-link guard | `lib/auth.ts` → `requireModuleAccess` / `lib/route-access.ts` |
| Feature allow / deny | `lib/permissions.ts` |
| Add-user role list | `lib/constants.ts` → `TEAM_ASSIGNABLE_ROLES` |
| Team edit gate | `components/settings/team-tab.tsx` → `canEdit = role === "SUPER_ADMIN"` |
| How to use by role | `docs/USER-GUIDE-BY-ROLE.md` |
