# Desbloqueio visual GLOBAL e definitivo: limpa cache de layout, compila extensao + workbench, reinicia.
# Admin VPS (PowerShell 7):
#   pwsh -ExecutionPolicy Bypass -File deploy\windows\code-web\unlock-princy-visual-global.ps1 -ProjectRoot C:\Apps\Editor

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$SkipFullCompile
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot
$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:VSCODE_SKIP_PRELAUNCH = "1"
$env:PRINCY_EDITOR_ROOT = $ProjectRoot

. (Join-Path $PSScriptRoot "Princy-CodeWeb-Build.ps1")

Write-Host "=== Desbloqueio visual global Princy ===" -ForegroundColor Cyan
Write-Host "Shell: $(Get-PrincyPwshExe) (PS $($PSVersionTable.PSVersion))" -ForegroundColor DarkGray

$userDataDir = Join-Path $ProjectRoot ".princy-user-data"
$productionSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
$userSettings = Join-Path $userDataDir "User\settings.json"

if (Test-Path $productionSettings) {
	New-Item -ItemType Directory -Force (Join-Path $userDataDir "User") | Out-Null
	Copy-Item $productionSettings $userSettings -Force
	Write-Host "OK: settings producao" -ForegroundColor Green
}

$wsStorage = Join-Path $userDataDir "workspaceStorage"
if (Test-Path $wsStorage) {
	$removed = 0
	Get-ChildItem $wsStorage -Recurse -Filter "state.vscdb" -ErrorAction SilentlyContinue | ForEach-Object {
		try {
			Remove-Item $_.FullName -Force -ErrorAction Stop
			$removed++
		} catch { }
	}
	Write-Host ('OK: removidos ' + $removed + ' ficheiros state.vscdb (layout antigo)') -ForegroundColor Green
}

$globalStorage = Join-Path $userDataDir "globalStorage"
if (Test-Path $globalStorage) {
	Get-ChildItem $globalStorage -Recurse -Filter "state.vscdb" -ErrorAction SilentlyContinue | ForEach-Object {
		try { Remove-Item $_.FullName -Force -ErrorAction Stop } catch { }
	}
}

if ($SkipFullCompile) {
	$exitCode = Invoke-PrincyDeployScript -ScriptPath (Join-Path $PSScriptRoot "deploy-princy-after-pull.ps1") -ScriptArgs @{ ProjectRoot = $ProjectRoot }
} else {
	$exitCode = Invoke-PrincyDeployScript -ScriptPath (Join-Path $PSScriptRoot "force-princy-visual-web.ps1") -ScriptArgs @{ ProjectRoot = $ProjectRoot }
}
if ($exitCode -ne 0) {
	throw "Deploy visual falhou (exit $exitCode). Veja erros de compile acima."
}

$extJs = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"
. (Join-Path $PSScriptRoot "..\princy-ui-revision.ps1")

$RevMarker = Get-PrincyUiRevision
if (-not (Test-Path $extJs)) {
	throw "Falta $extJs - compile nao gerou bundle browser."
}
if (-not (Select-String -Path $extJs -Pattern [regex]::Escape($RevMarker) -Quiet)) {
	throw "extension.js sem $RevMarker - compile incompleto. Faca git pull e repita o script."
}
Write-Host "OK: extension.js com revisao $RevMarker" -ForegroundColor Green

Write-Host ""
Write-Host "=== Concluido ===" -ForegroundColor Green
Write-Host "  1. Ctrl+F5 no https://princyai.com/webeditor/" -ForegroundColor Cyan
Write-Host "  2. F1 -> Force Visual Reload (chat + layout)" -ForegroundColor Cyan
Write-Host "  3. DevTools chat: document.body.dataset.princyUiRev = $RevMarker" -ForegroundColor DarkGray
