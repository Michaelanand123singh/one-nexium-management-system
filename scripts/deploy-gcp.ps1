# Deploy Nexium OS to Google Cloud Run
# Prerequisites: gcloud CLI, Docker, GCP project with billing enabled
#
# Usage:
#   .\scripts\deploy-gcp.ps1 -ProjectId YOUR_GCP_PROJECT
#   .\scripts\deploy-gcp.ps1 -ProjectId YOUR_GCP_PROJECT -Region asia-south1

param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [string]$Region = "asia-south1",
  [string]$ServiceName = "onenexium-os",
  [string]$Repository = "onenexium"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Find-Gcloud {
  $paths = @(
    "gcloud",
    "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    "$env:ProgramFiles\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
  )
  foreach ($p in $paths) {
    if (Get-Command $p -ErrorAction SilentlyContinue) { return $p }
    if (Test-Path $p) { return $p }
  }
  throw "gcloud CLI not found. Install: winget install Google.CloudSDK"
}

function Read-EnvValue([string]$Name) {
  $envFile = Join-Path $Root ".env"
  if (-not (Test-Path $envFile)) { throw ".env not found. Copy .env.example to .env first." }
  $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$Name\s*=" } | Select-Object -First 1
  if (-not $line) { throw "$Name missing in .env" }
  return ($line -split "=", 2)[1].Trim().Trim('"').Trim("'")
}

$Gcloud = Find-Gcloud
Write-Host "Using gcloud: $Gcloud" -ForegroundColor Cyan
Write-Host "Project: $ProjectId | Region: $Region | Service: $ServiceName" -ForegroundColor Cyan

& $Gcloud config set project $ProjectId | Out-Null

Write-Host "`nEnabling required GCP APIs..." -ForegroundColor Yellow
& $Gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com --quiet

Write-Host "Creating Artifact Registry repo (if needed)..." -ForegroundColor Yellow
& $Gcloud artifacts repositories describe $Repository --location=$Region 2>$null
if ($LASTEXITCODE -ne 0) {
  & $Gcloud artifacts repositories create $Repository `
    --repository-format=docker `
    --location=$Region `
    --description="Nexium OS container images"
}

Write-Host "Configuring Docker auth for Artifact Registry..." -ForegroundColor Yellow
& $Gcloud auth configure-docker "$Region-docker.pkg.dev" --quiet

$DatabaseUrl = Read-EnvValue "DATABASE_URL"
$AuthSecret = Read-EnvValue "AUTH_SECRET"
$Image = "$Region-docker.pkg.dev/$ProjectId/${Repository}/${ServiceName}:latest"

Write-Host "Storing secrets in Secret Manager..." -ForegroundColor Yellow
function Set-Secret([string]$Name, [string]$Value) {
  & $Gcloud secrets describe $Name 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    $Value | & $Gcloud secrets versions add $Name --data-file=-
  } else {
    $Value | & $Gcloud secrets create $Name --data-file=-
  }
}
Set-Secret "DATABASE_URL" $DatabaseUrl
Set-Secret "AUTH_SECRET" $AuthSecret

Write-Host "Running database migrations..." -ForegroundColor Yellow
$env:DATABASE_URL = $DatabaseUrl
npx prisma migrate deploy

Write-Host "Building Docker image (this may take several minutes)..." -ForegroundColor Yellow
docker build -t $Image .

Write-Host "Pushing image to Artifact Registry..." -ForegroundColor Yellow
docker push $Image

Write-Host "Deploying to Cloud Run..." -ForegroundColor Yellow
& $Gcloud run deploy $ServiceName `
  --image $Image `
  --region $Region `
  --platform managed `
  --allow-unauthenticated `
  --port 8080 `
  --memory 1Gi `
  --cpu 1 `
  --min-instances 0 `
  --max-instances 3 `
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,AUTH_SECRET=AUTH_SECRET:latest"

$ServiceUrl = (& $Gcloud run services describe $ServiceName --region $Region --format="value(status.url)").Trim()
Write-Host "`nUpdating NEXIUM_APP_URL to $ServiceUrl" -ForegroundColor Yellow
& $Gcloud run services update $ServiceName `
  --region $Region `
  --update-env-vars "NEXIUM_APP_URL=$ServiceUrl"

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  DEPLOYED SUCCESSFULLY" -ForegroundColor Green
Write-Host "  URL: $ServiceUrl" -ForegroundColor Green
Write-Host "  Login: admin@onenexium.com / admin123" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "Optional: add this Google OAuth redirect URI in Google Cloud Console:" -ForegroundColor Cyan
Write-Host "  $ServiceUrl/api/auth/google/callback`n"
