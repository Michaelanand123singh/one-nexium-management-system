# CI/CD

## Overview

| Stage | Trigger | What runs |
|-------|---------|-----------|
| **CI** | Push / PR to `main` | `npm run lint`, `npm run build` |
| **CD** | Push to `main` (non-doc paths) or manual **Deploy Production** | Migrate DB → build Docker image → deploy to GCP VM |

Production target:

- **VM:** `onenexium-vm-4gb`
- **Zone:** `us-central1-a`
- **URL:** https://team.1nexium.com

Manual deploy (local) is still available via `scripts/deploy-gcp-vm.ps1`.

## GitHub setup (one-time)

### 1. Repository secrets

| Secret | Description |
|--------|-------------|
| `GCP_SA_KEY` | Full JSON for a GCP service account with Compute SSH/SCP access |
| `DATABASE_URL` | Neon PostgreSQL URL (for `prisma migrate deploy`) |
| `PRODUCTION_ENV` | Full production `.env` file contents (no `NEXIUM_APP_URL` line required; deploy sets it) |

### 2. Repository variables (Settings → Secrets and variables → Actions → Variables)

| Variable | Example |
|----------|---------|
| `GCP_PROJECT_ID` | `onenexium-ai` |
| `GCP_ZONE` | `us-central1-a` |
| `GCP_INSTANCE` | `onenexium-vm-4gb` |
| `APP_URL` | `https://team.1nexium.com` |

### 3. GitHub Environment (optional but recommended)

Create an environment named **`production`** and add required reviewers if you want manual approval before deploy.

## Workflows

- `.github/workflows/ci.yml` — lint + build on every PR and push to `main`
- `.github/workflows/deploy-production.yml` — production deploy

## Notes

- Never commit `.env` — it is gitignored.
- The deploy job builds the Docker image on the GitHub runner and uploads it to the VM (same as the PowerShell script).
- Pushes that only change markdown under `docs/` do not trigger auto-deploy.
