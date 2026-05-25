# Recuperacao completa: portas 3210/3220 + compile UI r8 + webeditor (sem live routes).
# Admin VPS:
#   pwsh -ExecutionPolicy Bypass -File deploy\windows\code-web\fix-princy-editor-agora.ps1 -ProjectRoot C:\Apps\Editor
# Pagina em branco:
#   pwsh -File deploy\windows\code-web\fix-webeditor-blank-page.ps1 -ProjectRoot C:\Apps\Editor

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$FullCompile,
	[switch]$BundleOnly,
	[switch]$FixSettings
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

. (Join-Path $PSScriptRoot "..\princy-ui-revision.ps1")
$RevMarker = Get-PrincyUiRevision

Write-Host "=== Fix Princy Editor AGORA (rev $RevMarker) ===" -ForegroundColor Magenta
Write-Host "NOTA: git pull so atualiza src/ — dist/ e out/ precisam compilar NESTA maquina." -ForegroundColor Yellow
Write-Host "      NUNCA rode compile-incremental DEPOIS de bundle-server-web-out (causa pagina em branco).`n" -ForegroundColor Yellow

Write-Host "[0] Diagnostico pagina em branco ..." -ForegroundColor Cyan
$diag = Join-Path $PSScriptRoot "diagnose-webeditor-blank.ps1"
if (Test-Path $diag) {
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $diag -ProjectRoot $ProjectRoot
}

Write-Host "`n[1] Teste proxy 3200 -> 3210 ..." -ForegroundColor Cyan
$proxyTest = Join-Path $PSScriptRoot "test-princy-3200-3210-proxy.ps1"
if (Test-Path $proxyTest) {
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $proxyTest -ProjectRoot $ProjectRoot
	if ($LASTEXITCODE -ne 0) {
		Write-Host "AVISO: proxy 3200/3210 com falhas — continuando reparo ..." -ForegroundColor Yellow
	}
}

Write-Host "`n[2] Reparar :3220 (index) e :3210 (agent) ..." -ForegroundColor Cyan
& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "repair-princy-stack-3210-3220.ps1") -ProjectRoot $ProjectRoot
if ($LASTEXITCODE -ne 0) {
	Write-Host "AVISO: stack 3210/3220 com pendencias — continuando ..." -ForegroundColor Yellow
}

Write-Host "`n[3] Caddy + rota /webeditor/ (sem redirect live) ..." -ForegroundColor Cyan
& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "restore-princy-webeditor-route.ps1") -ProjectRoot $ProjectRoot

Write-Host "`n[4] Rebuild PROD + reinicio (fix pagina em branco) ..." -ForegroundColor Cyan
$blankFix = Join-Path $PSScriptRoot "fix-webeditor-blank-page.ps1"
$blankArgs = @{ ProjectRoot = $ProjectRoot }
if ($BundleOnly) { $blankArgs['BundleOnly'] = $true }
& pwsh -NoProfile -ExecutionPolicy Bypass -File $blankFix @blankArgs
if ($LASTEXITCODE -ne 0) { throw "fix-webeditor-blank-page falhou" }

Write-Host "`n[5] Visual r8 + settings + extensao browser ..." -ForegroundColor Cyan
$visual = Join-Path $PSScriptRoot "force-princy-visual-web.ps1"
if (Test-Path $visual) {
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $visual -ProjectRoot $ProjectRoot -SkipFullCompile -SkipRestart
	if ($LASTEXITCODE -ne 0) {
		Write-Host "AVISO: force-princy-visual-web com pendencias — continuando ..." -ForegroundColor Yellow
	}
} else {
	Write-Host "AVISO: ausente force-princy-visual-web.ps1" -ForegroundColor Yellow
}

Write-Host "`n[6] Reinicio final Code Web ..." -ForegroundColor Cyan
$svcFix = Join-Path $PSScriptRoot "fix-princy-code-web-service.ps1"
if (Test-Path $svcFix) {
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $svcFix -ProjectRoot $ProjectRoot
}

Write-Host "`n[7] Verificacao princy-api PRODUCAO + 3200->3210 ..." -ForegroundColor Cyan
$apiProd = Join-Path $PSScriptRoot "verify-princy-api-production.ps1"
if (Test-Path $apiProd) {
	$apiArgs = @{ ProjectRoot = $ProjectRoot }
	if ($FixSettings.IsPresent) { $apiArgs['FixSettings'] = $true }
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $apiProd @apiArgs
	if ($LASTEXITCODE -ne 0) {
		Write-Host "AVISO: verify-princy-api-production com pendencias" -ForegroundColor Yellow
	}
}

Write-Host "`n[8] Verificacao visual/chat ..." -ForegroundColor Cyan
$verify = Join-Path $PSScriptRoot "verify-princy-visual-and-chat.ps1"
if (Test-Path $verify) {
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $verify -ProjectRoot $ProjectRoot
	$verifyExit = $LASTEXITCODE
} else {
	$verifyExit = 0
}

Write-Host ""
Write-Host "=== VSDA (esperado em OSS) ===" -ForegroundColor DarkGray
$vsdaWasm = Join-Path $ProjectRoot "node_modules\vsda\rust\web\vsda_bg.wasm"
if (Test-Path $vsdaWasm) {
	Write-Host "  vsda wasm: presente" -ForegroundColor Green
} else {
	Write-Host "  vsda wasm: ausente — normal; nao bloqueia chat com /princy-api" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=== CHECKLIST NO BROWSER (Ctrl+F5) ===" -ForegroundColor Yellow
Write-Host "1. https://princyai.com/webeditor/ — deve carregar o editor (nao pagina branca)" -ForegroundColor Cyan
Write-Host "2. F12 Network: workbench.js em .../webeditor/static/out/... (200)" -ForegroundColor Cyan
Write-Host "3. Painel e chat fechados no arranque; rev chat = $RevMarker" -ForegroundColor Cyan
Write-Host "4. Sem faixa verde no rodape" -ForegroundColor Cyan
Write-Host "5. F1 -> Princy Ai: Focus Chat; mensagem via /princy-api (agente Princy)" -ForegroundColor Cyan

if ($verifyExit -ne 0) {
	Write-Host "`nAVISO: verificacao reportou pendencias — infra chat/API pode estar OK mesmo assim." -ForegroundColor Yellow
	Write-Host "  Se o editor abre e https://princyai.com/princy-api/api/agent/health = 200, teste o chat no browser." -ForegroundColor Yellow
	exit $verifyExit
}
