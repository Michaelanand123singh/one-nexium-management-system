# CI/CD

## Overview

| Stage | Trigger | What runs |
|-------|---------|-----------|
| **CI** | Push / PR to `main` | `npm run lint`, `npm run build` |
| **CD** | Push to `main` (non-doc paths) or manual **Deploy Production** | Migrate DB → build Docker image → deploy to GCP VM |

Production target:

- **VM:** `instance-20260606-081151`
- **Zone:** `us-east1-c`
- **External IP:** `35.231.35.242`
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

| Variable | Value |
|----------|--------|
| `GCP_PROJECT_ID` | `onenexium-ai` |
| `GCP_ZONE` | `us-east1-c` |
| `GCP_INSTANCE` | `instance-20260606-081151` |
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
- First-time SSL on a new VM: after DNS points to the VM, run `scripts/enable-https.sh` on the VM (or upload HTTP nginx config first; `vm-deploy.sh` auto-selects HTTP until certs exist).
