# Deploy Nexium OS to a GCP Compute Engine VM (http://YOUR_IP on port 80)
#
# Example (matches http://34.24.200.244):
#   .\scripts\deploy-gcp-vm.ps1 -ProjectId YOUR_PROJECT -Zone us-central1-a -Instance YOUR_VM_NAME -AppUrl "http://34.24.200.244"
#
# Prerequisites: gcloud auth login, VM with port 80 open in firewall, Docker optional (installed automatically)

param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $true)]
  [string]$Zone,

  [Parameter(Mandatory = $true)]
  [string]$Instance,

  [string]$AppUrl = "http://34.24.200.244",
  [string]$RemoteDir = "/opt/onenexium"
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
  throw "gcloud CLI not found. Run: winget install Google.CloudSDK"
}

function Read-EnvValue([string]$Name) {
  $envFile = Join-Path $Root ".env"
  if (-not (Test-Path $envFile)) { throw ".env not found" }
  $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$Name\s*=" } | Select-Object -First 1
  if (-not $line) { throw "$Name missing in .env" }
  return ($line -split "=", 2)[1].Trim().Trim('"').Trim("'")
}

$Gcloud = Find-Gcloud
& $Gcloud config set project $ProjectId | Out-Null

Write-Host "Deploying to VM: $Instance ($Zone)" -ForegroundColor Cyan
Write-Host "Public URL: $AppUrl" -ForegroundColor Cyan

# Run migrations from local machine (same Neon DB)
Write-Host "`nRunning database migrations..." -ForegroundColor Yellow
$env:DATABASE_URL = Read-EnvValue "DATABASE_URL"
npx prisma migrate deploy

# Prepare production .env for the VM (must set an active NEXIUM_APP_URL, not only commented examples)
$envContent = Get-Content (Join-Path $Root ".env") -Raw
if ($envContent -match '(?m)^NEXIUM_APP_URL=') {
  $envContent = $envContent -replace '(?m)^NEXIUM_APP_URL=.*$', "NEXIUM_APP_URL=$AppUrl"
} else {
  $envContent += "`nNEXIUM_APP_URL=$AppUrl`n"
}
$envProd = Join-Path $Root ".env.production.deploy"
$envContent | Set-Content $envProd -NoNewline

Write-Host "Building Docker image locally..." -ForegroundColor Yellow
docker build -t onenexium-os:latest .

$ImageArchive = Join-Path $env:TEMP "onenexium-image.tar"
if (Test-Path $ImageArchive) { Remove-Item $ImageArchive -Force }
docker save onenexium-os:latest -o $ImageArchive

# Package source (exclude heavy/local folders)
$Archive = Join-Path $env:TEMP "onenexium-deploy.tar.gz"
if (Test-Path $Archive) { Remove-Item $Archive -Force }

Write-Host "Packaging app..." -ForegroundColor Yellow
tar -czf $Archive `
  --exclude=node_modules `
  --exclude=.next `
  --exclude=.git `
  --exclude=.env `
  --exclude=.env.production.deploy `
  -C $Root .

Write-Host "Uploading to VM..." -ForegroundColor Yellow
# Always land files in /tmp first — /opt/onenexium may be root-owned (scp cannot sudo).
& $Gcloud compute ssh $Instance --zone=$Zone --command="sudo mkdir -p $RemoteDir"
& $Gcloud compute scp $Archive "${Instance}:/tmp/onenexium-deploy.tar.gz" --zone=$Zone
& $Gcloud compute scp $ImageArchive "${Instance}:/tmp/onenexium-image.tar" --zone=$Zone
& $Gcloud compute scp $envProd "${Instance}:/tmp/onenexium.env" --zone=$Zone
& $Gcloud compute scp (Join-Path $Root "scripts\vm-deploy.sh") "${Instance}:/tmp/vm-deploy.sh" --zone=$Zone

Write-Host "Building and starting on VM (5-10 min)..." -ForegroundColor Yellow
# Install .env with sudo (fixes Permission denied on /opt/onenexium/.env), then deploy.
$deployCmd = @"
set -e
sudo mkdir -p $RemoteDir
sudo install -m 600 /tmp/onenexium.env $RemoteDir/.env
sudo chown -R "`$(whoami):`$(whoami)" $RemoteDir || true
cd $RemoteDir
tar xzf /tmp/onenexium-deploy.tar.gz
chmod +x /tmp/vm-deploy.sh
bash /tmp/vm-deploy.sh
rm -f /tmp/onenexium.env
"@
& $Gcloud compute ssh $Instance --zone=$Zone --command=$deployCmd

Remove-Item $Archive -Force -ErrorAction SilentlyContinue
Remove-Item $ImageArchive -Force -ErrorAction SilentlyContinue
Remove-Item $envProd -Force -ErrorAction SilentlyContinue

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  DEPLOYED TO GCP VM" -ForegroundColor Green
Write-Host "  URL:  $AppUrl" -ForegroundColor Green
Write-Host "  Login: admin@onenexium.com / admin123" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "If port 80 is blocked, open it in GCP:" -ForegroundColor Cyan
Write-Host "  VPC network -> Firewall -> allow tcp:80`n"
