# Recupera pagina em branco: diagnostico + rebuild PROD + reinicio servicos.
# Admin VPS:
#   pwsh -ExecutionPolicy Bypass -File deploy\windows\code-web\fix-webeditor-blank-page.ps1 -ProjectRoot C:\Apps\Editor

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$BundleOnly,
	[switch]$DiagnoseOnly
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

. (Join-Path $PSScriptRoot "Princy-CodeWeb-Build.ps1")
. (Join-Path $PSScriptRoot "..\princy-ui-revision.ps1")

$base = "/webeditor"
$port = 3200
$RevMarker = Get-PrincyUiRevision
$env:PRINCY_UI_REVISION = $RevMarker

Write-Host "=== Fix webeditor pagina em branco ===" -ForegroundColor Magenta

$diag = Join-Path $PSScriptRoot "diagnose-webeditor-blank.ps1"
if (Test-Path $diag) {
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $diag -ProjectRoot $ProjectRoot -CodeWebPort $port
}

if ($DiagnoseOnly) { exit $LASTEXITCODE }

Write-Host "`n[Rebuild PROD] incremental -> compile-web -> bundle (bundle SEMPRE por ultimo) ..." -ForegroundColor Cyan
$prodScript = Join-Path $PSScriptRoot "compile-princy-code-web-production.ps1"
$prodArgs = @{ ProjectRoot = $ProjectRoot; SkipRestart = $true }
if ($BundleOnly) { $prodArgs['BundleOnly'] = $true }
& pwsh -NoProfile -ExecutionPolicy Bypass -File $prodScript @prodArgs
if ($LASTEXITCODE -ne 0) { throw "compile-princy-code-web-production falhou" }

$info = Get-PrincyWorkbenchBundleInfo -ProjectRoot $ProjectRoot
if (-not $info.IsBundled) {
	throw "workbench.js ainda pequeno ($($info.JsBytes) bytes) — bundle falhou. Nao reinicie o servico."
}
Write-Host "OK: workbench.js bundled ($([math]::Round($info.JsBytes/1MB, 2)) MB)" -ForegroundColor Green

$patch = Join-Path $PSScriptRoot "patch-workbench-princy-meta.ps1"
if (Test-Path $patch) {
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $patch -ProjectRoot $ProjectRoot
}

$prodSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
$userSettings = Join-Path $ProjectRoot ".princy-user-data\User\settings.json"
if (Test-Path $prodSettings) {
	New-Item -ItemType Directory -Force (Split-Path $userSettings -Parent) | Out-Null
	Copy-Item $prodSettings $userSettings -Force
}

Write-Host "`n[Reiniciar PrincyAiCodeWeb + PrincyCaddy]" -ForegroundColor Cyan
& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "fix-princy-code-web-service.ps1") -ProjectRoot $ProjectRoot -Port $port
if ($LASTEXITCODE -ne 0) { throw "fix-princy-code-web-service falhou" }
Restart-Service PrincyCaddy -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 6

Write-Host "`n[Verificacao pos-restart]" -ForegroundColor Cyan
& pwsh -NoProfile -ExecutionPolicy Bypass -File $diag -ProjectRoot $ProjectRoot -CodeWebPort $port
if ($LASTEXITCODE -ne 0) {
	throw "Diagnostico ainda reporta problemas apos rebuild"
}

Write-Host ""
Write-Host "OK. Browser: Ctrl+Shift+Delete + Ctrl+F5 em https://princyai.com/webeditor/" -ForegroundColor Green
Write-Host "  F12 -> Network: workbench.js 200 em .../webeditor/static/out/.../workbench.js" -ForegroundColor DarkGray
Write-Host "  Chat UI rev: $RevMarker" -ForegroundColor DarkGray
