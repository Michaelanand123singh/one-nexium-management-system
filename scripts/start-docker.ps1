# Build and run Nexium OS in Docker locally.
# Opens http://localhost:8080 in Chrome — never use 0.0.0.0 (browsers reject it).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "Building Docker image (first run may take a few minutes)..." -ForegroundColor Yellow
docker compose build

Write-Host "Starting container on http://localhost:8080 ..." -ForegroundColor Yellow
docker compose up -d --force-recreate

Start-Sleep -Seconds 6

try {
  $r = Invoke-WebRequest -Uri "http://127.0.0.1:8080/login" -UseBasicParsing -TimeoutSec 30
  Write-Host "App ready: $($r.StatusCode)" -ForegroundColor Green
} catch {
  Write-Host "Waiting for app... check: docker compose logs -f" -ForegroundColor Yellow
}

Write-Host "`nOpening http://localhost:8080/login in your default browser..." -ForegroundColor Cyan
Write-Host "Login: admin@onenexium.com / admin123`n" -ForegroundColor Cyan
Start-Process "http://localhost:8080/login"
