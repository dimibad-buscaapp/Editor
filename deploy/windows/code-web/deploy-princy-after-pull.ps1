# Aplica alteracoes da extensao princy-ai apos git pull (OBRIGATORIO: dist/ nao vai no Git).
# Admin VPS:
#   cd C:\Apps\Editor
#   git pull --no-rebase origin main
#   powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\deploy-princy-after-pull.ps1

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$FullCompile,
	[switch]$SkipRestart
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot
$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:VSCODE_SKIP_PRELAUNCH = "1"
$env:PRINCY_EDITOR_ROOT = $ProjectRoot

Write-Host "=== Deploy Princy apos git pull ===" -ForegroundColor Cyan
Write-Host "Pasta: $ProjectRoot"
Write-Host ""
Write-Host "NOTA: git pull so atualiza src/. A UI do chat usa extensions\princy-ai\dist\browser\extension.js" -ForegroundColor Yellow
Write-Host "      (pasta dist/ esta no .gitignore - precisa compilar nesta maquina)." -ForegroundColor Yellow
Write-Host ""

$userDataDir = Join-Path $ProjectRoot ".princy-user-data"
$productionSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
$userSettings = Join-Path $userDataDir "User\settings.json"
if (Test-Path $productionSettings) {
	New-Item -ItemType Directory -Force (Join-Path $userDataDir "User") | Out-Null
	Copy-Item $productionSettings $userSettings -Force
	Write-Host "OK: settings producao -> $userSettings" -ForegroundColor Green
}

$wsStorage = Join-Path $userDataDir "workspaceStorage"
if (Test-Path $wsStorage) {
	Get-ChildItem $wsStorage -Recurse -Filter "state.vscdb" -ErrorAction SilentlyContinue | ForEach-Object {
		try {
			Remove-Item $_.FullName -Force -ErrorAction Stop
			Write-Host "Layout cache removido: $($_.FullName)" -ForegroundColor DarkGray
		} catch { }
	}
}

foreach ($svcName in @('PrincyAiAgentBackend', 'PrincyAiCodeWeb')) {
	$svc = Get-Service $svcName -ErrorAction SilentlyContinue
	if ($svc -and $svc.Status -ne 'Running') {
		Write-Host "Iniciando $svcName ..." -ForegroundColor Cyan
		Start-Service $svcName -ErrorAction SilentlyContinue
		Start-Sleep -Seconds 3
	}
}

if ($FullCompile) {
	$prod = Join-Path $PSScriptRoot "compile-princy-code-web-production.ps1"
	& powershell -ExecutionPolicy Bypass -File $prod -ProjectRoot $ProjectRoot -SkipRestart
} else {
	Write-Host "[1] Compilar extensao princy-ai (browser bundle) ..." -ForegroundColor Cyan
	$extDir = Join-Path $ProjectRoot "extensions\princy-ai"
	if (-not (Test-Path (Join-Path $extDir "esbuild.browser.mts"))) {
		throw "Ausente extensions\princy-ai\esbuild.browser.mts"
	}
	Push-Location $extDir
	try {
		npm run bundle-web
		if ($LASTEXITCODE -ne 0) { throw "npm run bundle-web falhou em extensions\princy-ai" }
	} finally {
		Pop-Location
	}

	& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "sync-princy-ai-out-extensions.ps1") -ProjectRoot $ProjectRoot
}

$extJs = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"
if (-not (Test-Path $extJs)) {
	throw "Falta $extJs - compile falhou"
}

# Marcadores presentes no bundle JS (ids do package.json como princy-create nao entram no esbuild)
$requiredMarkers = @(
	'cursor-agent-2026.05.25-r3',
	'cursor-agent-track',
	'princyCreate.actions',
	'offlineBanner',
	'reconnectBackend',
	'princyai.create.project',
	'princyai.create.app'
)
$found = @()
$missing = @()
foreach ($m in $requiredMarkers) {
	if (Select-String -Path $extJs -Pattern $m -Quiet) { $found += $m } else { $missing += $m }
}
Write-Host ""
Write-Host "[2] Verificacao extension.js ($extJs)" -ForegroundColor Cyan
Write-Host "  OK: $($found.Count)/$($requiredMarkers.Count) marcadores" -ForegroundColor $(if ($missing.Count -eq 0) { 'Green' } else { 'Red' })
if ($missing.Count -gt 0) {
	Write-Host "  FALTAM: $($missing -join ', ')" -ForegroundColor Red
	throw "extension.js ANTIGO - rode apos git pull com commit a7064242+ (git log -1)."
}
Write-Host "  Rev UI: cursor-agent-2026.05.25-r3" -ForegroundColor Green

Write-Host ""
Write-Host "[3] Health API (agent + proxy Code Web) ..." -ForegroundColor Cyan
$apiOk = $false
$proxyOk = $false
try {
	$r = Invoke-WebRequest "http://127.0.0.1:3210/api/agent/health" -UseBasicParsing -TimeoutSec 12
	if ($r.Content -match '"ok"\s*:\s*true') { $apiOk = $true }
	Write-Host "  Agent :3210 -> HTTP $($r.StatusCode)" -ForegroundColor Green
} catch {
	Write-Host "  Agent :3210 FALHOU: $_" -ForegroundColor Red
	Write-Host "  Rode: deploy\windows\agent-backend\start-princy-agent-backend.ps1" -ForegroundColor Yellow
}
try {
	$p = Invoke-WebRequest "http://127.0.0.1:3200/princy-api/api/agent/health" -UseBasicParsing -TimeoutSec 12
	if ($p.Content -match '"ok"\s*:\s*true') { $proxyOk = $true }
	Write-Host "  Proxy :3200/princy-api -> HTTP $($p.StatusCode)" -ForegroundColor Green
} catch {
	Write-Host "  Proxy :3200/princy-api FALHOU: $_" -ForegroundColor Red
	Write-Host "  Recompile servidor: -FullCompile ou compile-incremental + reinicie PrincyAiCodeWeb" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[3b] Repair agent :3210 + proxy ..." -ForegroundColor Cyan
$repairAgent = Join-Path $ProjectRoot "deploy\windows\agent-backend\repair-princy-agent-3210.ps1"
if (Test-Path $repairAgent) {
	& powershell -ExecutionPolicy Bypass -File $repairAgent -ProjectRoot $ProjectRoot -SkipRestartCodeWeb
} else {
	Write-Host "  AVISO: ausente $repairAgent" -ForegroundColor Yellow
}

if (-not $SkipRestart) {
	Write-Host ""
	Write-Host "[4] Reiniciar PrincyAiCodeWeb ..." -ForegroundColor Cyan
	$svc = Get-Service PrincyAiCodeWeb -ErrorAction SilentlyContinue
	if ($svc) {
		if ($svc.Status -eq 'Running') { Restart-Service PrincyAiCodeWeb -Force }
		else { Start-Service PrincyAiCodeWeb }
		Start-Sleep -Seconds 5
	} else {
		& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "fix-princy-code-web-service.ps1") -ProjectRoot $ProjectRoot
	}
}

Write-Host ""
Write-Host "=== Concluido ===" -ForegroundColor Green
Write-Host "  Browser: Ctrl+F5 em https://princyai.com/webeditor/" -ForegroundColor Cyan
Write-Host "  DevTools painel chat: document.body.dataset.princyUiRev = cursor-agent-2026.05.25-r3" -ForegroundColor DarkGray
Write-Host "  Activity bar: icone + (Criar) com 5 acoes" -ForegroundColor DarkGray
if (-not $apiOk) {
	Write-Host "  AVISO: backend :3210 offline - chat ficara offline ate iniciar o agent" -ForegroundColor Red
}
if (-not $proxyOk) {
	Write-Host "  AVISO: proxy /princy-api na :3200 falhou - recompile servidor com -FullCompile" -ForegroundColor Red
}
