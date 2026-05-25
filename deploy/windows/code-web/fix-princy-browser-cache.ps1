# Corrige browser com JS antigo em cache (1 ano no servidor).
# Obrigatorio apos mudancas de visual/chat: recompila servidor + extensao e reinicia.
#
# pwsh -ExecutionPolicy Bypass -File deploy\windows\code-web\fix-princy-browser-cache.ps1 -ProjectRoot C:\Apps\Editor

param(
	[string]$ProjectRoot = "C:\Apps\Editor"
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot
$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:VSCODE_SKIP_PRELAUNCH = "1"
$env:PRINCY_EDITOR_ROOT = $ProjectRoot

. (Join-Path $PSScriptRoot "Princy-CodeWeb-Build.ps1")
. (Join-Path $PSScriptRoot "..\princy-ui-revision.ps1")

$RevMarker = Get-PrincyUiRevision
$env:PRINCY_UI_REVISION = $RevMarker

Write-Host "=== Fix cache browser (workbench + princy-ai) ===" -ForegroundColor Cyan
Write-Host "Rev UI: $RevMarker" -ForegroundColor DarkGray

Write-Host "`n[1] compile PROD (incremental -> compile-web -> bundle; bundle por ultimo) ..." -ForegroundColor Cyan
$prodScript = Join-Path $PSScriptRoot "compile-princy-code-web-production.ps1"
& pwsh -NoProfile -ExecutionPolicy Bypass -File $prodScript -ProjectRoot $ProjectRoot -SkipRestart
if ($LASTEXITCODE -ne 0) { throw "compile-princy-code-web-production falhou" }

Invoke-PrincyDeployScript -ScriptPath (Join-Path $PSScriptRoot "sync-princy-ai-out-extensions.ps1") -ScriptArgs @{ ProjectRoot = $ProjectRoot } | Out-Null

$extJs = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"
if (-not (Select-String -Path $extJs -Pattern $RevMarker -SimpleMatch -Quiet)) {
	throw "extension.js sem $RevMarker"
}

$serverOut = Join-Path $ProjectRoot "out\vs\server\node\webClientServer.js"
if (-not (Select-String -Path $serverOut -Pattern "princyDisallowsLongLivedCache" -SimpleMatch -Quiet)) {
	throw "Servidor nao recompilado com fix de cache - compile-incremental falhou?"
}
Write-Host "OK: servidor com princyDisallowsLongLivedCache" -ForegroundColor Green

Write-Host "`n[4] Reiniciar Code Web + Caddy ..." -ForegroundColor Cyan
Invoke-PrincyDeployScript -ScriptPath (Join-Path $PSScriptRoot "fix-princy-code-web-service.ps1") -ScriptArgs @{ ProjectRoot = $ProjectRoot } | Out-Null
Restart-Service PrincyCaddy -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 5

Write-Host "`n[5] Headers HTTP (devem ser no-cache ou ?v=$RevMarker) ..." -ForegroundColor Cyan
$urls = @(
	"http://127.0.0.1:3200/webeditor/",
	"http://127.0.0.1:3200/webeditor/static/out/vs/code/browser/workbench/workbench.js"
)
foreach ($u in $urls) {
	try {
		$r = Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 20
		$cc = $r.Headers['Cache-Control']
		$hasBust = $r.Content -match [regex]::Escape("workbench.js?v=$RevMarker")
		Write-Host "  $u" -ForegroundColor DarkGray
		Write-Host "    Cache-Control: $cc" -ForegroundColor $(if ($cc -match '31536000') { 'Red' } else { 'Green' })
		if ($u -match 'workbench\.html|/webeditor/$') {
			Write-Host "    workbench.js?v= : $hasBust" -ForegroundColor $(if ($hasBust) { 'Green' } else { 'Yellow' })
		}
	}
	catch {
		Write-Host "  FALHA $u : $_" -ForegroundColor Red
	}
}

Write-Host ""
Write-Host "OK. No browser: Ctrl+Shift+Delete + Ctrl+F5" -ForegroundColor Green
Write-Host "  document.body.dataset.princyUiRev = $RevMarker" -ForegroundColor DarkGray
