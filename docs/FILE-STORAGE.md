# File storage (MinIO)

Nexium OS stores uploads in **self-hosted MinIO** (S3-compatible).

## How it works

1. UI uploads via `POST /api/upload` (Documents, Bugs, Planning) — unchanged for callers.
2. App writes the object to MinIO bucket `nexium` under `{organisationId}/...`.
3. DB stores a same-origin URL: `https://team.1nexium.com/api/files/...`.
4. Opening a file streams through `GET /api/files/[...key]` (session + org-scoped).

Cloudinary remains an optional fallback if MinIO env is not set (`STORAGE_DRIVER=cloudinary`).

## Env (production)

```
STORAGE_DRIVER=minio
MINIO_ENDPOINT=http://minio:9000   # set by docker-compose for the app service
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET=nexium
MINIO_REGION=us-east-1
NEXIUM_APP_URL=https://team.1nexium.com
```

## Compose services

- `minio` — object store (Docker network only; not exposed on the public internet)
- `minio-init` — creates the bucket once
- `app` — Next.js; reaches MinIO at `http://minio:9000`

Data volume: `onenexium_minio_data`.
