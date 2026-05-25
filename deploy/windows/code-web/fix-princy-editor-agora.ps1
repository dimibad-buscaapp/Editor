# Recuperacao completa: portas 3210/3220 + compile UI r8 + webeditor (sem live routes).
# Admin VPS:
#   pwsh -ExecutionPolicy Bypass -File deploy\windows\code-web\fix-princy-editor-agora.ps1 -ProjectRoot C:\Apps\Editor
# Pagina em branco:
#   pwsh -File deploy\windows\code-web\fix-webeditor-blank-page.ps1 -ProjectRoot C:\Apps\Editor

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$FullCompile,
	[switch]$BundleOnly
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

. (Join-Path $PSScriptRoot "..\princy-ui-revision.ps1")
$RevMarker = Get-PrincyUiRevision

Write-Host "=== Fix Princy Editor AGORA (rev $RevMarker) ===" -ForegroundColor Magenta
Write-Host "NOTA: git pull so atualiza src/ — dist/ e out/ precisam compilar NESTA maquina." -ForegroundColor Yellow
Write-Host "      NUNCA rode compile-incremental DEPOIS de bundle-server-web-out (causa pagina em branco).`n" -ForegroundColor Yellow

Write-Host "[1] Reparar :3220 (index) e :3210 (agent) ..." -ForegroundColor Cyan
& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "repair-princy-stack-3210-3220.ps1") -ProjectRoot $ProjectRoot
if ($LASTEXITCODE -ne 0) {
	Write-Host "AVISO: stack 3210/3220 com pendencias — continuando ..." -ForegroundColor Yellow
}

Write-Host "`n[2] Caddy + rota /webeditor/ (sem redirect live) ..." -ForegroundColor Cyan
& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "restore-princy-webeditor-route.ps1") -ProjectRoot $ProjectRoot

Write-Host "`n[3] Build PROD workbench (ordem correta: incremental -> compile-web -> bundle) ..." -ForegroundColor Cyan
$prodScript = Join-Path $PSScriptRoot "compile-princy-code-web-production.ps1"
$prodArgs = @{ ProjectRoot = $ProjectRoot; SkipRestart = $true }
if ($BundleOnly) { $prodArgs['BundleOnly'] = $true }
elseif (-not $FullCompile) {
	# Atualizacao normal: rebuild completo evita pagina em branco apos pull
	$prodArgs['BundleOnly'] = $false
}
& pwsh -NoProfile -ExecutionPolicy Bypass -File $prodScript @prodArgs
if ($LASTEXITCODE -ne 0) { throw "compile-princy-code-web-production falhou" }

$env:PRINCY_UI_REVISION = $RevMarker
$prodSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
$userSettings = Join-Path $ProjectRoot ".princy-user-data\User\settings.json"
if (Test-Path $prodSettings) {
	New-Item -ItemType Directory -Force (Split-Path $userSettings -Parent) | Out-Null
	Copy-Item $prodSettings $userSettings -Force
	Write-Host "OK: settings producao aplicados" -ForegroundColor Green
}

Write-Host "`n[4] Reiniciar servicos ..." -ForegroundColor Cyan
& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "fix-princy-code-web-service.ps1") -ProjectRoot $ProjectRoot | Out-Host
Restart-Service PrincyCaddy -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 5

Write-Host "`n[5] Verificacao assets (pagina em branco = workbench.js 404) ..." -ForegroundColor Cyan
$staticJs = "http://127.0.0.1:3200/webeditor/static/out/vs/code/browser/workbench/workbench.js"
try {
	$wj = Invoke-WebRequest $staticJs -UseBasicParsing -TimeoutSec 25
	Write-Host "  workbench.js: HTTP $($wj.StatusCode) ($([int]($wj.Content.Length/1KB)) KB)" -ForegroundColor Green
}
catch {
	Write-Host "  workbench.js FALHOU: $_" -ForegroundColor Red
	Write-Host "  Rode: pwsh -File deploy\windows\code-web\fix-webeditor-blank-page.ps1" -ForegroundColor Yellow
	throw "workbench.js inacessivel — editor ficara em branco"
}

$verify = Join-Path $PSScriptRoot "verify-princy-visual-and-chat.ps1"
if (Test-Path $verify) {
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $verify -ProjectRoot $ProjectRoot
}

Write-Host ""
Write-Host "=== CHECKLIST NO BROWSER (Ctrl+F5) ===" -ForegroundColor Yellow
Write-Host "1. https://princyai.com/webeditor/ — deve carregar o editor (nao pagina branca)" -ForegroundColor Cyan
Write-Host "2. F12 Network: workbench.js em .../webeditor/static/out/... (200)" -ForegroundColor Cyan
Write-Host "3. Painel e chat fechados no arranque; rev chat = $RevMarker" -ForegroundColor Cyan
Write-Host "4. Sem faixa verde no rodape" -ForegroundColor Cyan
