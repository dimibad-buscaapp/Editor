# Desbloqueio visual GLOBAL e definitivo: limpa cache de layout, compila extensao + workbench, reinicia.
# Admin VPS:
#   powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\unlock-princy-visual-global.ps1 -ProjectRoot C:\Apps\Editor

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$SkipFullCompile
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot
$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:VSCODE_SKIP_PRELAUNCH = "1"
$env:PRINCY_EDITOR_ROOT = $ProjectRoot

Write-Host "=== Desbloqueio visual global Princy ===" -ForegroundColor Cyan

$userDataDir = Join-Path $ProjectRoot ".princy-user-data"
$productionSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
$userSettings = Join-Path $userDataDir "User\settings.json"

if (Test-Path $productionSettings) {
	New-Item -ItemType Directory -Force (Join-Path $userDataDir "User") | Out-Null
	Copy-Item $productionSettings $userSettings -Force
	Write-Host "OK: settings producao" -ForegroundColor Green
}

# Remove TODO cache de layout (state.vscdb) em todos os workspaces
$wsStorage = Join-Path $userDataDir "workspaceStorage"
if (Test-Path $wsStorage) {
	$removed = 0
	Get-ChildItem $wsStorage -Recurse -Filter "state.vscdb" -ErrorAction SilentlyContinue | ForEach-Object {
		try {
			Remove-Item $_.FullName -Force -ErrorAction Stop
			$removed++
		} catch { }
	}
	Write-Host "OK: removidos $removed ficheiros state.vscdb (layout antigo)" -ForegroundColor Green
}

# Global storage que pode guardar layout maximizado
$globalStorage = Join-Path $userDataDir "globalStorage"
if (Test-Path $globalStorage) {
	Get-ChildItem $globalStorage -Recurse -Filter "state.vscdb" -ErrorAction SilentlyContinue | ForEach-Object {
		try { Remove-Item $_.FullName -Force -ErrorAction Stop } catch { }
	}
}

if ($SkipFullCompile) {
	& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "deploy-princy-after-pull.ps1") -ProjectRoot $ProjectRoot
} else {
	& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "force-princy-visual-web.ps1") -ProjectRoot $ProjectRoot
	if ($LASTEXITCODE -ne 0) {
		throw "force-princy-visual-web falhou (exit $LASTEXITCODE). Veja erros de compile acima."
	}
}

$extJs = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"
$revMarker = 'cursor-agent-2026.05.25-r2'
if (-not (Test-Path $extJs)) {
	throw "Falta $extJs - compile nao gerou bundle browser."
}
if (-not (Select-String -Path $extJs -Pattern $revMarker -Quiet)) {
	throw "extension.js sem $revMarker - compile incompleto. Faca git pull e repita o script."
}
Write-Host "OK: extension.js com revisao $revMarker" -ForegroundColor Green

Write-Host ""
Write-Host "=== Concluido ===" -ForegroundColor Green
Write-Host "  1. Ctrl+F5 no https://princyai.com/webeditor/" -ForegroundColor Cyan
Write-Host "  2. F1 -> Force Visual Reload (chat + layout)" -ForegroundColor Cyan
Write-Host "  3. DevTools chat: document.body.dataset.princyUiRev = $revMarker" -ForegroundColor DarkGray
