# Opens the live Nexium OS app (GCP VM). Do NOT use 0.0.0.0:8080 — browsers reject that address.
$LiveUrl = "http://34.29.114.253/login"
Write-Host "Opening $LiveUrl" -ForegroundColor Cyan
Start-Process $LiveUrl
