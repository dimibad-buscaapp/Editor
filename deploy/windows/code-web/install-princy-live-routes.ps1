# Instala rotas alternativas LIVE (sem cache) + chat direto.
# Editor live: https://princyai.com/webeditor-live/
# Chat live:   https://princyai.com/princy-chat-live/
#
# pwsh -ExecutionPolicy Bypass -File deploy\windows\code-web\install-princy-live-routes.ps1 -ProjectRoot C:\Apps\Editor

param(
	[string]$ProjectRoot = "C:\Apps\Editor"
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

. (Join-Path $PSScriptRoot "Princy-CodeWeb-Build.ps1")
. (Join-Path $PSScriptRoot "..\princy-ui-revision.ps1")

$RevMarker = Get-PrincyUiRevision
$env:PRINCY_UI_REVISION = $RevMarker

Write-Host "=== Instalar rotas LIVE Princy ===" -ForegroundColor Magenta
Write-Host "Rev UI: $RevMarker" -ForegroundColor DarkGray

Write-Host "`n[1] Compile (web + server + agent chat route) ..." -ForegroundColor Cyan
& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "fix-princy-browser-cache.ps1") -ProjectRoot $ProjectRoot

Write-Host "`n[2] Servico Code Web LIVE :3201 ..." -ForegroundColor Cyan
$liveUserData = Join-Path $ProjectRoot ".princy-user-data-live"
$productionSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
if (Test-Path $productionSettings) {
	New-Item -ItemType Directory -Force (Join-Path $liveUserData "User") | Out-Null
	Copy-Item $productionSettings (Join-Path $liveUserData "User\settings.json") -Force
}

& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "fix-princy-code-web-service.ps1") `
	-ProjectRoot $ProjectRoot `
	-ServiceName "PrincyAiCodeWebLive" `
	-Port 3201 `
	-ServerBasePath "/webeditor-live" `
	-UserDataDirName ".princy-user-data-live" `
	-LiveMode `
	-WorkspacePath (Join-Path $ProjectRoot "workspaces\default")

Write-Host "`n[3] Agent backend (rota /princy-chat-live) ..." -ForegroundColor Cyan
$agentDir = Join-Path $ProjectRoot "apps\ai-dashboard"
if (Test-Path (Join-Path $agentDir "package.json")) {
	Push-Location $agentDir
	npm run build:backend
	if ($LASTEXITCODE -ne 0) { throw "build:backend falhou" }
	Pop-Location
	Restart-Service PrincyAiAgentBackend -Force -ErrorAction SilentlyContinue
	Start-Sleep -Seconds 4
}

Write-Host "`n[4] Caddyfile ..." -ForegroundColor Cyan
$caddySrc = Join-Path $PSScriptRoot "Caddyfile"
$caddyDest = "C:\Caddy\Caddyfile"
if (Test-Path $caddySrc) {
	Copy-Item $caddySrc $caddyDest -Force
	Write-Host "  Copiado para $caddyDest" -ForegroundColor Green
	Restart-Service PrincyCaddy -Force -ErrorAction SilentlyContinue
	Start-Sleep -Seconds 3
}

Write-Host "`n[5] Probes ..." -ForegroundColor Cyan
$probes = @(
	@{ L = "Editor LIVE"; U = "https://princyai.com/webeditor-live/" },
	@{ L = "Chat LIVE"; U = "https://princyai.com/princy-chat-live/" },
	@{ L = "API health"; U = "https://princyai.com/princy-api/api/agent/health" }
)
foreach ($p in $probes) {
	try {
		$r = Invoke-WebRequest $p.U -UseBasicParsing -TimeoutSec 25
		Write-Host "  OK $($p.L) HTTP $($r.StatusCode)" -ForegroundColor Green
	}
	catch {
		Write-Host "  FALHA $($p.L): $_" -ForegroundColor Red
	}
}

Write-Host ""
Write-Host "=== USE ESTAS URLs (nao /webeditor/ antigo) ===" -ForegroundColor Green
Write-Host "  Editor (visual novo, sem cache 1 ano): https://princyai.com/webeditor-live/" -ForegroundColor Cyan
Write-Host "  Chat isolado (testar API):            https://princyai.com/princy-chat-live/" -ForegroundColor Cyan
Write-Host "  Console chat: document.body.dataset.princyUiRev = $RevMarker" -ForegroundColor DarkGray
