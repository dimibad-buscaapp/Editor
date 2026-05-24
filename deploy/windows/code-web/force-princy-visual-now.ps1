# Forca visual/chat ATUALIZADO sem compile completo (rapido: 1-3 min).
# Use quando compile-full ja rodou mas o browser ainda mostra UI antiga.
#
# VPS (PowerShell 7):
#   pwsh -ExecutionPolicy Bypass -File deploy\windows\code-web\force-princy-visual-now.ps1 -ProjectRoot C:\Apps\Editor

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$SkipCompileWeb
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot
$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:VSCODE_SKIP_PRELAUNCH = "1"
$env:PRINCY_EDITOR_ROOT = $ProjectRoot

. (Join-Path $PSScriptRoot "..\princy-ui-revision.ps1")

$RevMarker = Get-PrincyUiRevision

. (Join-Path $PSScriptRoot "Princy-CodeWeb-Build.ps1")

Write-Host "=== Forcar visual AGORA (sem compile completo) ===" -ForegroundColor Cyan
Write-Host "Shell: $(Get-PrincyPwshExe) (PS $($PSVersionTable.PSVersion))" -ForegroundColor DarkGray

$userDataDir = Join-Path $ProjectRoot ".princy-user-data"
$productionSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
$userSettings = Join-Path $userDataDir "User\settings.json"

if (Test-Path $productionSettings) {
	New-Item -ItemType Directory -Force (Join-Path $userDataDir "User") | Out-Null
	Copy-Item $productionSettings $userSettings -Force
	Write-Host "OK: settings producao aplicados" -ForegroundColor Green
}

# Limpar cache layout + webview
$removed = 0
foreach ($root in @(
		(Join-Path $userDataDir "workspaceStorage"),
		(Join-Path $userDataDir "globalStorage"),
		(Join-Path $userDataDir "Cache"),
		(Join-Path $userDataDir "CachedData"),
		(Join-Path $userDataDir "Code Cache")
	)) {
	if (-not (Test-Path $root)) { continue }
	Get-ChildItem $root -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
		if ($_.Name -eq 'state.vscdb' -or $_.Name -like 'cache*' -or $_.Extension -eq '.vscdb') {
			try { Remove-Item $_.FullName -Force -ErrorAction Stop; $removed++ } catch { }
		}
	}
}
Write-Host ('OK: cache removido (' + $removed + ' ficheiros)') -ForegroundColor Green

$extJs = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"
$needsCompile = -not (Test-Path $extJs) -or -not (Select-String -Path $extJs -Pattern $RevMarker -Quiet)

if ($needsCompile -and -not $SkipCompileWeb) {
	Write-Host "[1] compile-web (bundle chat) ..." -ForegroundColor Cyan
	npm run compile-web
	if ($LASTEXITCODE -ne 0) { throw "compile-web falhou" }
} elseif ($needsCompile) {
	throw "extension.js sem $RevMarker - rode sem -SkipCompileWeb ou compile-full-princy-webeditor.ps1"
} else {
	Write-Host "[1] extension.js ja tem $RevMarker (skip compile-web)" -ForegroundColor Green
}

Write-Host "[2] sync out/extensions ..." -ForegroundColor Cyan
Invoke-PrincyDeployScript -ScriptPath (Join-Path $PSScriptRoot "sync-princy-ai-out-extensions.ps1") -ScriptArgs @{ ProjectRoot = $ProjectRoot } | Out-Null

if (-not (Select-String -Path $extJs -Pattern $RevMarker -Quiet)) {
	throw "extension.js ainda sem $RevMarker apos sync"
}
Write-Host "OK: $RevMarker confirmado em dist/browser/extension.js" -ForegroundColor Green

Write-Host "[3] reiniciar PrincyAiCodeWeb ..." -ForegroundColor Cyan
$stopPort = Join-Path $ProjectRoot "deploy\windows\code-web\Stop-CodeWebPort.ps1"
if (Test-Path $stopPort) {
	Invoke-PrincyDeployScript -ScriptPath $stopPort -ScriptArgs @{ Port = 3200 } | Out-Null
}
$svc = Get-Service PrincyAiCodeWeb -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq 'Running') {
	Restart-Service PrincyAiCodeWeb -Force
	Start-Sleep -Seconds 5
} else {
	Invoke-PrincyDeployScript -ScriptPath (Join-Path $PSScriptRoot "fix-princy-code-web-service.ps1") -ScriptArgs @{ ProjectRoot = $ProjectRoot } | Out-Null
}

try {
	$r = Invoke-WebRequest "http://127.0.0.1:3200/webeditor/" -UseBasicParsing -TimeoutSec 20
	Write-Host "OK: webeditor HTTP $($r.StatusCode)" -ForegroundColor Green
} catch {
	Write-Host "AVISO: webeditor nao respondeu: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== No BROWSER (obrigatorio) ===" -ForegroundColor Yellow
Write-Host "  1. Ctrl+Shift+Delete -> limpar cache de princyai.com (ou janela anonima)" -ForegroundColor Cyan
Write-Host "  2. Ctrl+F5 em https://princyai.com/webeditor/" -ForegroundColor Cyan
Write-Host "  3. F1 -> Force Visual Reload" -ForegroundColor Cyan
Write-Host "  4. F1 -> Unlock Princy Editor Layout" -ForegroundColor Cyan
Write-Host "  5. F12 Console (no painel chat): document.body.dataset.princyUiRev" -ForegroundColor Cyan
Write-Host "     deve ser: $RevMarker" -ForegroundColor DarkGray
