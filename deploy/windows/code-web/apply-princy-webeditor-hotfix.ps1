# Hotfix: tema Princy Black + chat lateral + API :3210 no webeditor.
# Rode no VPS como Admin apos git pull (30-90 min na 1a vez).
# powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\apply-princy-webeditor-hotfix.ps1

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[int]$CodeWebPort = 3200,
	[string]$EditorBasePath = "/webeditor",
	[switch]$SkipBundle
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Princy-CodeWeb-Build.ps1")

$base = $EditorBasePath.Trim()
if (-not $base.StartsWith('/')) { $base = "/$base" }

Write-Host "=== Hotfix Webeditor (Princy IA) ===" -ForegroundColor Cyan
Write-Host "Pasta: $ProjectRoot"
Set-Location $ProjectRoot

$userDataDir = Join-Path $ProjectRoot ".princy-user-data"
$productionSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
if (Test-Path $productionSettings) {
	New-Item -ItemType Directory -Force (Join-Path $userDataDir "User") | Out-Null
	Copy-Item $productionSettings (Join-Path $userDataDir "User\settings.json") -Force
	Write-Host "Settings producao copiados para .princy-user-data\User\settings.json" -ForegroundColor Green
}

# 1) Backend :3210
Write-Host "`n[1] Agent API :3210" -ForegroundColor Cyan
try {
	$h = Invoke-WebRequest "http://127.0.0.1:3210/api/agent/health" -UseBasicParsing -TimeoutSec 15
	Write-Host "  OK HTTP $($h.StatusCode)" -ForegroundColor Green
}
catch {
	Write-Host "  FALHA: agent backend nao responde na 3210" -ForegroundColor Red
	Write-Host "  Rode: deploy\windows\agent-backend\start-princy-agent-backend.ps1" -ForegroundColor Yellow
	exit 1
}

# 2) Compile extensao + bundle (obrigatorio para tema/chat)
if (-not $SkipBundle) {
	Write-Host "`n[2] Compile producao (compile-web + bundle) ..." -ForegroundColor Cyan
	& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "compile-princy-code-web-production.ps1") `
		-ProjectRoot $ProjectRoot -SkipRestart
}
else {
	Write-Host "`n[2] Skip bundle (-SkipBundle)" -ForegroundColor DarkGray
	npm run compile-web
	if ($LASTEXITCODE -ne 0) { throw "compile-web falhou" }
}

$extJs = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"
if (-not (Test-Path $extJs)) {
	throw "Falta $extJs - compile-web falhou"
}
Write-Host "  OK extension.js" -ForegroundColor Green

& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "sync-princy-ai-out-extensions.ps1") -ProjectRoot $ProjectRoot

# 3) Patch HTML em out/ (meta builtin)
Write-Host "`n[3] Patch workbench HTML (meta princy-ai)" -ForegroundColor Cyan
& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "patch-workbench-princy-meta.ps1") -ProjectRoot $ProjectRoot

# 4) Reiniciar servico
Write-Host "`n[4] Reiniciar PrincyAiCodeWeb" -ForegroundColor Cyan
& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "fix-princy-code-web-service.ps1") -ProjectRoot $ProjectRoot

Start-Sleep -Seconds 6

# 5) Probes HTTP
Write-Host "`n[5] Probes" -ForegroundColor Cyan
$url = "http://127.0.0.1:${CodeWebPort}${base}/"
try {
	$html = (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 30).Content
	$hasMeta = $html -match 'vscode-workbench-builtin-extensions'
	$hasPrincy = $html -match 'princy-ai'
	Write-Host "  GET $url -> meta=$hasMeta princy=$hasPrincy" -ForegroundColor $(if ($hasMeta -and $hasPrincy) { 'Green' } else { 'Red' })
	if (-not ($hasMeta -and $hasPrincy)) {
		Write-Host "  AVISO: HTML servido sem princy-ai - server-main.js antigo. Rode compile SEM -SkipBundle." -ForegroundColor Yellow
	}
}
catch {
	Write-Host "  FALHA GET webeditor: $($_.Exception.Message)" -ForegroundColor Red
}

try {
	$p = Invoke-WebRequest "http://127.0.0.1:${CodeWebPort}/princy-api/api/agent/health" -UseBasicParsing -TimeoutSec 15
	Write-Host "  Proxy /princy-api -> $($p.StatusCode)" -ForegroundColor Green
}
catch {
	Write-Host "  Proxy /princy-api FALHOU (recompile server)" -ForegroundColor Red
}

Write-Host "`nAbra https://princyai.com${base}/ e Ctrl+F5. Painel direito: icone sparkle Princy IA." -ForegroundColor Green
