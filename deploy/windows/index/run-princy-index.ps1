# Landing / index Princy Ai — porta 3220
param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$HostName = "0.0.0.0",
	[int]$Port = 3220
)

$ErrorActionPreference = "Stop"
. (Join-Path $ProjectRoot "deploy\windows\princy-hosts.ps1")

$dashboardRoot = Join-Path $ProjectRoot "apps\ai-dashboard"
$distIndex = Join-Path $dashboardRoot "dist\frontend\index.html"
if (-not (Test-Path $distIndex)) {
	Write-Host "Build do frontend..." -ForegroundColor Yellow
	Set-Location $dashboardRoot
	npm run build:frontend
}

$nodeExe = (Get-Command node -ErrorAction Stop).Source
$indexJs = Join-Path $dashboardRoot "dist\backend\indexServer.js"
if (-not (Test-Path $indexJs)) {
	Write-Host "Build do index server..." -ForegroundColor Yellow
	Set-Location $dashboardRoot
	npm run build:backend
}

$env:INDEX_PORT = "$Port"
$env:INDEX_HOST = $HostName
$env:PRINCY_VPS_HOST = $PrincyVpsIp

Write-Host "Princy index: http://${PrincyVpsIp}:$Port (bind $HostName`:$Port)" -ForegroundColor Cyan
Set-Location $dashboardRoot
& $nodeExe $indexJs
