# Nexium OS — Role usage guide

**Live app:** https://team.1nexium.com/login  
**Audience:** day-to-day how to run the product with each of the four assignable roles.

Permissions matrix: [`ROLES-AND-PERMISSIONS.md`](./ROLES-AND-PERMISSIONS.md)

---

## Shared basics (every role)

1. Open **https://team.1nexium.com/login** and sign in with your role account.
2. Use the **sidebar** for modules you are allowed to open. Deep-linking into a blocked module sends you home.
3. Use the **phase picker** in the top bar to filter Roadmap / Backlog / Command Centre by workspace phase.
4. **Command Centre (`/`)** — personal dashboard: stats, my tasks, quick actions, recent items.
5. **Inbox** — connect your own mailbox and read/send mail.
6. **Planning** — personal planning board and calendar.
7. **Settings → Account** — change your password. **Settings → Notifications** — in-app alerts. **Settings → Email** — personal mailbox connect (org mail provider keys are Super Admin only).

**Demo passwords (shared Neon DB):**

| Role | Email | Password |
|------|--------|----------|
| Super Admin | `admin@onenexium.com` | `admin123` |
| Product Manager | `pm@onenexium.com` | `pm123` |
| Engineering Lead | `englead@onenexium.com` | `englead123` |
| Developer | `dev@onenexium.com` | `dev123` |

Do **not** use legacy seed logins `gtm@` / `csm@` — those roles are not in the primary nav.

---

## 1. Super Admin — run the organisation

**Job:** people, config, customers, infra, and full product control.

### Typical day
1. **Settings → Team & People** — add users (4 roles only), change roles, reset passwords, deactivate.
2. **Settings → Workspace** — add/remove workspace phases (`Phase 1`, `Phase 2`, …). Navbar phase filter updates after save.
3. **Settings → Email** — configure org Gmail OAuth / Resend / from-address (Mail Provider Configuration).
4. **Customer Success** — manage customers and support tickets.
5. **Roadmap / Backlog** — create and edit everything; only you can mark roadmap items **public**.
6. **HR** — create and manage onboarding records and share links.
7. **Workstation** — register/revoke agent devices and view telemetry.
8. **Infrastructure** — view AWS status; start/stop EC2 when credentials are configured.
9. **AI Terminal** — interpret/run ops commands (when AI/terminal env is configured).
10. Also uses Sprint, Bugs, Documents, Pipeline like other roles.

### Checklist smoke-test
- [x] Login as Super Admin (`admin@onenexium.com`) — verified 2026-07-15  
- [x] All sidebar modules load for SA — verified 2026-07-15  
- [x] MinIO upload + Planning attach + Documents wiki — verified 2026-07-15  
- [x] Full multi-role smoke (`scripts/full-system-smoke.sh`) — **61/61 PASS** 2026-07-15  
- [x] Only SA can add team members; DEV/PM forbidden — verified  
- [ ] Browser: Workspace phases save UI (optional spot-check)  
- [ ] Browser: HR create onboarding + share link (optional)  
- [ ] Set AI API keys if you need Terminal interpret/run  

Full matrix: [`SYSTEM-TEST-CHECKLIST.md`](./SYSTEM-TEST-CHECKLIST.md)

---

## 2. Product Manager — own the product

**Job:** roadmap, backlog, phases, HR onboarding. No Customers / AI Terminal.

### Typical day
1. **Roadmap** — create/edit items, assign team & phase, ship status. Cannot set **public**.
2. **Backlog** — create backlog items; triage **Feature Request Inbox** (accept/reject). Anyone can *submit* a feature request; only you/SA manage the backlog items.
3. **Sprint / Bugs** — plan and edit delivery when needed.
4. **Settings → Workspace** — manage phases with SA.
5. **HR** — create and manage onboarding for joiners.
6. **Workstation** — view telemetry (cannot register devices).
7. **Infrastructure** — view only (no EC2 controls).
8. **Pipeline / Documents** — review delivery funnel and shared docs.

### Checklist smoke-test
- [ ] Create a roadmap item and backlog item  
- [ ] Accept a feature request  
- [ ] HR: create onboarding  
- [ ] `/customers` and `/terminal` redirect home  

---

## 3. Engineering Lead — own delivery & ops

**Job:** sprint, bugs, Engineering roadmap items, AI terminal, infra actions.

### Typical day
1. **Sprint Board** — create sprints/tasks, move columns, assign developers.
2. **Bug Tracker** — triage and update bugs.
3. **Roadmap** — view all; **Edit** only items assigned to **Engineering** (team field is locked so you cannot reassign away from Engineering).
4. **Backlog** — view only (no create backlog / accept requests); you can still open **New feature request** to submit ideas.
5. **AI Terminal** — run/interpret commands for ops.
6. **Infrastructure** — view status and start/stop EC2.
7. **HR** — **view** onboarding list (read-only; cannot create/edit).
8. **Workstation** — view telemetry only.
9. No **Customer Success** module.

### Checklist smoke-test
- [ ] Edit an Engineering roadmap item; Product-team item has no Edit  
- [ ] Create a sprint task  
- [ ] HR list loads (read-only)  
- [ ] Terminal and infra controls visible  

---

## 4. Developer — build day to day

**Job:** sprint tasks and bugs. View product context; no HR/Terminal/Customers/Workstation.

### Typical day
1. **Command Centre** — see **My tasks**; create task via quick action if needed.
2. **Sprint Board** — pick up tasks, update status, add tasks.
3. **Bug Tracker** — log and fix bugs.
4. **Roadmap / Backlog** — read context; submit feature requests; no create/edit of roadmap or backlog *items*.
5. **Planning / Inbox / Documents / Pipeline** — personal plan, mail, docs, analytics.
6. **Infrastructure** — view only.
7. **Settings → Team** — read-only directory.

### Checklist smoke-test
- [ ] Create and move a sprint task  
- [ ] Create/edit a bug  
- [ ] Roadmap has no “New item”; detail has no Edit  
- [ ] `/terminal`, `/hr`, `/workstation`, `/customers` → home  

---

## Module map (what to open for what)

| Need | Where |
|------|--------|
| Who is on the team / add people | Settings → Team (SA only for edits) |
| Change phases | Settings → Workspace (SA + PM) |
| Org mail OAuth / Resend | Settings → Email → provider block (SA) |
| Personal Gmail connect | Settings → Email / Inbox |
| Plan product | Roadmap + Backlog |
| Ship this sprint | Sprint Board |
| Defects | Bug Tracker |
| New joiner paperwork | HR |
| Customers & tickets | Customers (SA) |
| AWS pulse / EC2 | Infrastructure |
| AI ops shell | AI Terminal (SA + Eng Lead) |
| Device agents | Workstation (manage = SA) |
| Shared files | Documents |
| Delivery overview charts | Pipeline |

---

## Wrap-up notes

- **GTM** and **OKRs** pages are soft-archived (redirect home). APIs remain for historical/dashboard data.
- Feature requests: **all primary roles may submit**; only SA/PM accept into backlog.
- If something looks missing for your role, check the permissions table first — it is intentional, not a blank screen bug.
