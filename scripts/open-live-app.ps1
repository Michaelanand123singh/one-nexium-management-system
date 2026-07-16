# Opens the live Nexium OS app (GCP VM). Do NOT use 0.0.0.0:8080 — browsers reject that address.
$LiveUrl = "https://team.1nexium.com/login"
Write-Host "Opening $LiveUrl" -ForegroundColor Cyan
Start-Process $LiveUrl
