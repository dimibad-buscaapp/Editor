# Compile COMPLETO do Princy Web Editor (workbench + chat + visual Cursor).
# O git pull NAO aplica UI — este script gera os bundles que o browser carrega.
#
# VPS Admin (PowerShell 7 recomendado):
#   pwsh -ExecutionPolicy Bypass -File deploy\windows\code-web\compile-full-princy-webeditor.ps1 -ProjectRoot C:\Apps\Editor
#
# Etapas (15-45 min tipico):
#   [1] compile-incremental  -> out/ (workbench layout.ts, princy contrib, extensao out/)
#   [2] compile-web          -> extensions/princy-ai/dist/browser/extension.js (chat UI)
#   [3] bundle-server-web-out -> out/vs/code/browser/workbench/workbench.js + .css (PROD)

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$SkipLayoutCacheClear,
	[switch]$SkipPull
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot
$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:VSCODE_SKIP_PRELAUNCH = "1"
$env:PRINCY_EDITOR_ROOT = $ProjectRoot

$RevMarker = 'cursor-agent-2026.05.25-r2'

. (Join-Path $PSScriptRoot "Princy-CodeWeb-Build.ps1")

Write-Host "=== Compile COMPLETO Princy Web Editor ===" -ForegroundColor Cyan
Write-Host "Shell: $(Get-PrincyPwshExe) (PS $($PSVersionTable.PSVersion))" -ForegroundColor DarkGray
Write-Host "Pasta: $ProjectRoot"
Write-Host ""
Write-Host "O browser NAO le src/ — le estes artefactos compilados:" -ForegroundColor Yellow
Write-Host "  - out/vs/code/browser/workbench/workbench.js   (editor + layout)" -ForegroundColor DarkGray
Write-Host "  - extensions/princy-ai/dist/browser/extension.js (chat Princy IA)" -ForegroundColor DarkGray
Write-Host ""

if (-not $SkipPull) {
	Write-Host "[0] git pull origin main ..." -ForegroundColor Cyan
	git pull --no-rebase origin main
	if ($LASTEXITCODE -ne 0) { throw "git pull falhou" }
	Write-Host "  HEAD: $(git log -1 --oneline)" -ForegroundColor Green
}

$userDataDir = Join-Path $ProjectRoot ".princy-user-data"
$productionSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
$userSettings = Join-Path $userDataDir "User\settings.json"
if (Test-Path $productionSettings) {
	New-Item -ItemType Directory -Force (Join-Path $userDataDir "User") | Out-Null
	Copy-Item $productionSettings $userSettings -Force
	Write-Host "OK: settings producao" -ForegroundColor Green
}

if (-not $SkipLayoutCacheClear) {
	$wsStorage = Join-Path $userDataDir "workspaceStorage"
	$removed = 0
	if (Test-Path $wsStorage) {
		Get-ChildItem $wsStorage -Recurse -Filter "state.vscdb" -ErrorAction SilentlyContinue | ForEach-Object {
			try { Remove-Item $_.FullName -Force -ErrorAction Stop; $removed++ } catch { }
		}
	}
	$globalStorage = Join-Path $userDataDir "globalStorage"
	if (Test-Path $globalStorage) {
		Get-ChildItem $globalStorage -Recurse -Filter "state.vscdb" -ErrorAction SilentlyContinue | ForEach-Object {
			try { Remove-Item $_.FullName -Force -ErrorAction Stop; $removed++ } catch { }
		}
	}
	Write-Host ('OK: cache layout removido (' + $removed + ' ficheiros state.vscdb)') -ForegroundColor Green
}

$compileScript = Join-Path $PSScriptRoot "compile-princy-code-web-production.ps1"
$exitCode = Invoke-PrincyDeployScript -ScriptPath $compileScript -ScriptArgs @{ ProjectRoot = $ProjectRoot }
if ([int]$exitCode -ne 0) {
	throw "compile-princy-code-web-production falhou (exit $exitCode)"
}

Write-Host ""
Write-Host "=== Verificacao pos-compile ===" -ForegroundColor Cyan

$extJs = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"
$wbJs = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.js"
$layoutOut = Join-Path $ProjectRoot "out\vs\workbench\contrib\princy\browser\princyLayoutUnlock.contribution.js"

$checks = @(
	@{ Name = "Chat bundle (extension.js)"; Path = $extJs; Pattern = $RevMarker },
	@{ Name = "Chat UI track (extension.js)"; Path = $extJs; Pattern = "cursor-agent-track" },
	@{ Name = "Chat shell (extension.js)"; Path = $extJs; Pattern = "cursor-shell" },
	@{ Name = "Workbench bundle (workbench.js)"; Path = $wbJs; Pattern = $null },
	@{ Name = "Layout unlock (out/)"; Path = $layoutOut; Pattern = "princyLayoutUnlock" },
	@{ Name = "Layout no-maximize (out/layout)"; Path = (Join-Path $ProjectRoot "out\vs\workbench\browser\layout.js"); Pattern = "forceMaximized" }
)

$allOk = $true
foreach ($c in $checks) {
	if (-not (Test-Path $c.Path)) {
		Write-Host "  FALTA: $($c.Name) -> $($c.Path)" -ForegroundColor Red
		$allOk = $false
		continue
	}
	if ($c.Pattern -and -not (Select-String -Path $c.Path -Pattern $c.Pattern -Quiet)) {
		Write-Host "  FALTA marcador '$($c.Pattern)' em $($c.Name)" -ForegroundColor Red
		$allOk = $false
		continue
	}
	Write-Host "  OK: $($c.Name)" -ForegroundColor Green
}

if (-not $allOk) {
	throw "Verificacao pos-compile falhou — UI pode continuar antiga no browser."
}

Write-Host ""
Write-Host "=== Concluido ===" -ForegroundColor Green
Write-Host "  1. Ctrl+F5 em https://princyai.com/webeditor/" -ForegroundColor Cyan
Write-Host "  2. F1 -> Unlock Princy Editor Layout (se chat maximizado)" -ForegroundColor Cyan
Write-Host "  3. DevTools chat: document.body.dataset.princyUiRev = $RevMarker" -ForegroundColor DarkGray
