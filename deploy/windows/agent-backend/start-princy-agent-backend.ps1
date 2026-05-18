param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[int]$Port = 3210
)

$ErrorActionPreference = "Stop"

$appRoot = Join-Path $ProjectRoot "apps\ai-dashboard"
Set-Location $appRoot

if (-not (Test-Path ".env")) {
	Copy-Item ".\deploy\windows\princyai.env.example" ".\.env"
}

$env:API_PORT = "$Port"
$env:NODE_OPTIONS = "--max-old-space-size=8192"

Write-Host "Starting Princy Ai agent backend"
Write-Host "Project: $appRoot"
Write-Host "URL: http://127.0.0.1:$Port"

npm run prisma:generate
npm run prisma:deploy
npm run build:backend
npm run start
