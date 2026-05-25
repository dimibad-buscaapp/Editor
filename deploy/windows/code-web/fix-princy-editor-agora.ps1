# Recuperacao completa: portas 3210/3220 + compile UI r8 + webeditor (sem live routes).
# Admin VPS:
#   pwsh -ExecutionPolicy Bypass -File deploy\windows\code-web\fix-princy-editor-agora.ps1 -ProjectRoot C:\Apps\Editor
#   pwsh ... -FullCompile   # se layout unlock / strip verde ainda falharem

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$FullCompile
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

. (Join-Path $PSScriptRoot "..\princy-ui-revision.ps1")
$RevMarker = Get-PrincyUiRevision

Write-Host "=== Fix Princy Editor AGORA (rev $RevMarker) ===" -ForegroundColor Magenta
Write-Host "NOTA: git pull so atualiza src/ — dist/ e out/ precisam compilar NESTA maquina.`n" -ForegroundColor Yellow

Write-Host "[1] Reparar :3220 (index) e :3210 (agent) ..." -ForegroundColor Cyan
& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "repair-princy-stack-3210-3220.ps1") -ProjectRoot $ProjectRoot
if ($LASTEXITCODE -ne 0) {
	Write-Host "AVISO: stack 3210/3220 com pendencias — continuando compile UI ..." -ForegroundColor Yellow
}

Write-Host "`n[2] Caddy + rota /webeditor/ (sem redirect live) ..." -ForegroundColor Cyan
& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "restore-princy-webeditor-route.ps1") -ProjectRoot $ProjectRoot

Write-Host "`n[3] Cache browser + settings producao ..." -ForegroundColor Cyan
& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "fix-princy-browser-cache.ps1") -ProjectRoot $ProjectRoot

if ($FullCompile) {
	Write-Host "`n[4] Compile completo (workbench + web + extensao) ..." -ForegroundColor Cyan
	& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "compile-full-princy-webeditor.ps1") -ProjectRoot $ProjectRoot -SkipPull
} else {
	Write-Host "`n[4] Compile incremental servidor + bundle extensao ..." -ForegroundColor Cyan
	$env:NODE_OPTIONS = "--max-old-space-size=8192"
	$env:VSCODE_SKIP_PRELAUNCH = "1"
	npm run compile-incremental
	if ($LASTEXITCODE -ne 0) { throw "compile-incremental falhou" }
	& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "deploy-princy-after-pull.ps1") -ProjectRoot $ProjectRoot -SkipRestart
}

Write-Host "`n[5] Reiniciar servicos ..." -ForegroundColor Cyan
foreach ($name in @('PrincyAiCodeWeb', 'PrincyCaddy')) {
	$svc = Get-Service $name -ErrorAction SilentlyContinue
	if ($svc) {
		if ($svc.Status -eq 'Running') { Restart-Service $name -Force } else { Start-Service $name }
		Start-Sleep -Seconds 3
	}
}

Write-Host "`n[6] Verificacao ..." -ForegroundColor Cyan
$verify = Join-Path $PSScriptRoot "verify-princy-visual-and-chat.ps1"
if (Test-Path $verify) {
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $verify -ProjectRoot $ProjectRoot
}

Write-Host ""
Write-Host "=== CHECKLIST NO BROWSER (Ctrl+F5) ===" -ForegroundColor Yellow
Write-Host "1. https://princyai.com/webeditor/ — painel e chat FECHADOS no arranque" -ForegroundColor Cyan
Write-Host "2. Sem faixa verde no rodape" -ForegroundColor Cyan
Write-Host "3. Abrir chat (✦): visual Cursor; rev = $RevMarker" -ForegroundColor Cyan
Write-Host "4. Chat usa /princy-api (nao :3210 no browser)" -ForegroundColor Cyan
Write-Host "5. https://princyai.com/ — landing :3220" -ForegroundColor Cyan
