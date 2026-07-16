# Nexium OS

Internal product management software for the OneNexium team — from ideation to shipping across product, engineering, GTM, and customer success.

## Stack

- **Frontend:** Next.js 15 (App Router), Tailwind CSS, shadcn/ui, Zod, Recharts
- **Backend:** Next.js API routes
- **Database:** PostgreSQL (Neon) with Prisma ORM
- **Auth:** Custom (session-based, 6 roles)
- **File storage:** Cloudinary (ready)
- **Email:** Resend (ready)

## Roles

| Role | Access |
|------|--------|
| Super Admin | Full access |
| Product Manager | Roadmap, backlog, sprints, bugs, OKRs; no finance |
| Engineering Lead | Engineering tasks, bugs, tech docs; no GTM/finance |
| Developer | Own tasks only, read-only roadmap |
| GTM Manager | Campaigns, partners, assets; no engineering/finance |
| Customer Success | Customers, feedback, NPS, support; no engineering |

## Setup

1. **Install**
   ```bash
   npm install
   ```

2. **Environment**
   - Copy `.env.example` to `.env`
   - Set `DATABASE_URL` to your Neon PostgreSQL connection string  
   - See **[NEON_SETUP.md](./NEON_SETUP.md)** for Neon CLI (`npx neonctl@latest init`) and getting a connection string

3. **Database**
   ```bash
   npm run db:generate
   npm run db:push      # or: npm run db:migrate  (then db:migrate:deploy for production)
   npm run db:seed      # Creates org + admin user
   ```
   **After schema changes or deploy:** Run `npm run db:migrate:deploy` so the database has the latest columns (e.g. `phases`, `targetPhase`). If you see a 500 or "Something went wrong" after deploying, run this then reload.
   **Windows:** If `db:generate` fails with **EPERM** (file in use), the Prisma query engine is locked by another process (e.g. the dev server or your IDE). Stop `npm run dev`, close other terminals running the app, then run `npm run db:generate` again.

4. **Run**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000). Log in with seed user:

**Build (Windows)**  
- `npm run build` runs `prebuild` first, which removes the `.next` folder to avoid EPERM / stuck builds.  
- **Stop the dev server** before running `npm run build` (otherwise the build can hang or hit permission errors).  
- If build still fails with EPERM, close any terminal or IDE using the project folder and run `npm run build` again.

**Sign in with Google (internal only)**  
- Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `ALLOWED_GOOGLE_EMAILS` (comma-separated) in `.env`.  
- In Google Cloud Console, add redirect URI: `https://your-app-url/api/auth/google/callback`.  
- Only emails in `ALLOWED_GOOGLE_EMAILS` can sign in; others see “Your email is not authorised”. New users get the default role (`DEFAULT_GOOGLE_SIGNIN_ROLE`, default `DEVELOPER`) in the first organisation.

   - **Email:** `admin@onenexium.com`
   - **Password:** `admin123`

## Modules (sidebar)

- **Command Centre** — Role-specific dashboard
- **Planning** — Personal buckets, drag-and-drop cards, calendar, **Today** view. **Rich notes** (TipTap: headings, lists, links, inline images via Cloudinary). **Attachments** (PDF, Office, video, images, archives) uploaded with `/api/upload`, stored on the card (max 30 per card). `notesJson` + `PlanningCardAttachment` in DB — run **`npm run db:migrate:deploy`** after pull. All roles.
- **Roadmap** — Timeline/list, quarters, epics, milestones (placeholder)
- **Backlog** — Feature backlog, request inbox, epics (placeholder)
- **Sprint Board** — Kanban, velocity, burndown (placeholder)
- **Bug Tracker** — Report, triage, SLA (placeholder)
- **OKR & Goals** — Company/team/individual OKRs (placeholder)
- **GTM** — Campaigns, partners, assets, events (placeholder)
- **Customer Success** — Accounts, feedback, NPS, tickets (placeholder)
- **Team & People** — Directory, roles (Super Admin only)
- **Documents** — Wiki, specs, runbooks (placeholder)
- **Notifications** — Bell + activity feed (placeholder)
- **Infrastructure** — AWS status (EC2, RDS, Redis, ALB, CloudWatch alarms) and quick actions (EC2 start/stop). Visible to Super Admin, Engineering Lead, Product Manager, Developer. Requires AWS credentials in `.env` (see `.env.example`; resource IDs default to `Onenexium_aws_setup`).
- **AI Terminal** — Manage your full AWS infra from the dashboard: type in plain English, AI suggests the command (AWS CLI, Docker, etc.), you run it. Supports EC2, RDS, S3, ECR, CloudWatch, ECS, Secrets Manager, and more. Super Admin and Engineering Lead only. Set `TERMINAL_SSH_*` so commands run on a host with AWS CLI (e.g. Platform EC2).

## Project structure

- `app/(main)/` — Authenticated app (sidebar layout)
- `app/login/` — Login page
- `app/api/auth/` — Login, logout, session
- `components/` — UI and feature components
- `lib/` — Auth, db, constants, aws-config, aws-client (Infrastructure)
- `prisma/` — Schema, seed

## Design

- Dark mode by default; theme persists via `next-themes`
- Sidebar collapsible to icons only
- Nav items filtered by role
