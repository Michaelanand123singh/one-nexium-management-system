# Nexium OS — Modular Monolithic Architecture

This document describes the **modular monolithic** structure of the codebase: a single deployable application with clear **module boundaries** and a **shared kernel**.

---

## Principles

- **One deployable app** (monolith): one Next.js app, one database, one auth domain.
- **Modules by feature/domain**: each module owns its API routes, UI, and types within the app.
- **Shared kernel**: auth, db, API client, permissions, layout, and UI primitives are shared.
- **Explicit boundaries**: modules import from the kernel and from each other only via public API (e.g. shared types or routes), not by reaching into another module’s internals.

---

## Directory Layout

```
├── app/                          # Next.js App Router
│   ├── (main)/                   # Authenticated area (layout: sidebar + main)
│   │   ├── layout.tsx            # Requires session, renders MainLayoutClient
│   │   ├── page.tsx              # Command Centre (dashboard)
│   │   ├── roadmap/
│   │   ├── backlog/
│   │   ├── sprint/
│   │   ├── bugs/
│   │   └── ...                   # One folder per module
│   ├── api/                      # API routes by resource
│   │   ├── auth/
│   │   ├── roadmap/
│   │   ├── backlog/
│   │   ├── feature-requests/
│   │   ├── sprints/
│   │   └── ...
│   ├── login/
│   └── layout.tsx                # Root layout (theme, toaster, command palette)
├── components/
│   ├── layout/                   # Shared layout (kernel)
│   │   ├── app-sidebar.tsx
│   │   ├── main-layout-client.tsx
│   │   └── page-shell.tsx        # Title + actions + content for module pages
│   ├── ui/                       # Shared primitives (shadcn-style)
│   ├── dashboard/                # Command Centre module UI
│   ├── roadmap/                  # Roadmap module UI
│   ├── backlog/                  # Backlog module UI
│   ├── empty-state.tsx          # Shared empty state
│   ├── command-palette.tsx
│   └── theme-provider.tsx
├── lib/                          # Shared kernel
│   ├── auth.ts                   # Session, login helpers
│   ├── db.ts                     # Prisma client
│   ├── api.ts                    # Client-side api() fetch helper
│   ├── api-guard.ts              # getSessionOr401, forbidden(), notFound()
│   ├── permissions.ts            # Role-based: canEditRoadmap, canEditBacklog, etc.
│   ├── constants.ts              # ROLES, NAV_MODULES, QUARTERS
│   └── utils.ts                  # cn() etc.
├── hooks/
│   └── use-module-data.ts        # useModuleData, useModuleDataMany (fetch + loading)
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── scripts/
│   └── clean.mjs
└── middleware.ts                 # Auth redirect for protected routes
```

---

## Kernel (Shared)

- **Auth**: `lib/auth.ts` — `getSession()`, `requireSession()`, `createSession()`, cookie helpers.
- **DB**: `lib/db.ts` — Prisma client singleton.
- **API client**: `lib/api.ts` — `api<T>(path, options)` for client-side fetch with credentials and error handling.
- **API guards**: `lib/api-guard.ts` — `getSessionOr401()`, `forbidden()`, `notFound()` for route handlers.
- **Permissions**: `lib/permissions.ts` — `canEditRoadmap`, `canEditBacklog`, `canEditRoadmapItem`, `canSetPublicRoadmap`, etc.
- **Constants**: `lib/constants.ts` — `ROLES`, `NAV_MODULES`, `QUARTERS`.
- **Layout**: `components/layout/` — sidebar, main layout client, `PageShell` for module pages.
- **UI**: `components/ui/` — Button, Card, Input, Sheet, Badge, Skeleton, etc.
- **Hooks**: `hooks/use-module-data.ts` — shared data-fetch patterns with loading/error.

---

## Modules

Each **module** is a vertical slice:

- **Route**: `app/(main)/<module>/page.tsx` — loads session, renders module view.
- **API**: `app/api/<module>/` (or related resource names, e.g. `feature-requests` for backlog).
- **UI**: `components/<module>/` — views, lists, detail sheets, create sheets.
- **Types**: either in the module’s view file(s) or in a shared `types` file if used across modules.
- **Permissions**: implemented in `lib/permissions.ts` and used by API and UI.

Current modules:

| Module           | Route(s)     | API prefix          | Main components              |
|------------------|-------------|---------------------|------------------------------|
| Auth             | /login      | /api/auth           | login page                   |
| Dashboard        | /           | —                   | command-centre               |
| Roadmap          | /roadmap    | /api/roadmap        | roadmap-view, timeline, list |
| Backlog          | /backlog    | /api/backlog, /api/feature-requests, /api/sprints | backlog-view, list, sheets |
| Sprint           | /sprint     | (to be added)       | placeholder                  |
| Bugs             | /bugs       | (to be added)       | placeholder                  |
| OKRs             | /okrs       | (to be added)       | placeholder                  |
| GTM              | /gtm        | (to be added)       | placeholder                  |
| Customers        | /customers  | (to be added)       | placeholder                  |
| Team             | /team       | (to be added)       | placeholder                  |
| Documents        | /documents  | (to be added)       | placeholder                  |
| Notifications    | /notifications | (to be added)   | placeholder                  |
| Workstation      | /workstation | /api/workstation (devices, samples, analytics, ingest, agent-endpoints) | workstation-view, workstation-analytics |

The **ingest** route (`POST /api/workstation/ingest`) is authenticated with a per-device Bearer token (not the browser session). It is allow-listed in `middleware.ts`. Agents use the same public **domain** as the app; `GET /api/workstation/agent-endpoints` (session) returns the canonical `apiBaseUrl` and `ingestUrl` for IT copy/paste.

---

## Conventions

1. **API routes**: Use `getSessionOr401()` from `lib/api-guard`; then check permissions with `lib/permissions` and return `forbidden()` or `notFound()` when needed.
2. **Module pages**: Use `requireSession()` in server component, pass `role` and `organisationId` to the client view.
3. **Module views**: Use `PageShell` for title + actions + content; use `api()` from `lib/api` for client fetches; use permission helpers to show/hide actions.
4. **Constants**: Shared domain constants (e.g. quarters, status lists) live in `lib/constants.ts`.
5. **New modules**: Add nav entry in `NAV_MODULES`, create `app/(main)/<module>/page.tsx`, add API under `app/api/`, add UI under `components/<module>/`.

---

## Data flow

- **Server**: `(main)/layout` and page server components call `requireSession()` and pass session data to client components.
- **Client**: Module views call `api()` to hit `app/api/...`; middleware sends cookies so session is available to API routes.
- **Org scope**: All API routes that touch data use `session.organisationId` so data is scoped by organisation.

This keeps a single codebase and deployment while scaling by adding clear modules and reusing a small, consistent kernel.
