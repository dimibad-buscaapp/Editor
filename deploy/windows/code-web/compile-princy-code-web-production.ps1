# Compile producao do Code-OSS Web (workbench.html + esbuild bundle CSS/JS) e reinicia PrincyAiCodeWeb.
# Admin, VPS: pode demorar 30-90 min na primeira vez; -BundleOnly so esbuild+ext (10-30 min).
# pwsh -ExecutionPolicy Bypass -File deploy\windows\code-web\compile-princy-code-web-production.ps1
# pwsh -ExecutionPolicy Bypass -File deploy\windows\code-web\compile-princy-code-web-production.ps1 -BundleOnly

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$SkipRestart,
	[switch]$BundleOnly
)

$ErrorActionPreference = "Stop"

Set-Location $ProjectRoot
$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:VSCODE_SKIP_PRELAUNCH = "1"

. (Join-Path $PSScriptRoot "Princy-CodeWeb-Build.ps1")

Write-Host "=== Compile Code Web PRODUCAO ===" -ForegroundColor Cyan
Write-Host "Shell: $(Get-PrincyPwshExe) (PS $($PSVersionTable.PSVersion))" -ForegroundColor DarkGray
Write-Host "Pasta: $ProjectRoot"
Write-Host ""

$stopPort = Join-Path $ProjectRoot "deploy\windows\code-web\Stop-CodeWebPort.ps1"
if (Test-Path $stopPort) {
	Invoke-PrincyDeployScript -ScriptPath $stopPort -ScriptArgs @{ Port = 3200 } | Out-Null
}

$svc = Get-Service PrincyAiCodeWeb -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq 'Running') {
	Stop-Service PrincyAiCodeWeb -Force
	Start-Sleep -Seconds 3
}

$serverMainPath = Join-Path $ProjectRoot "out\server-main.js"
if (-not $BundleOnly) {
	Write-Host "[1/3] compile-incremental (TypeScript -> out/) ..." -ForegroundColor Cyan
	$env:PRINCY_SKIP_GULP_CLEAN = "1"
	npm run compile-incremental
	if ($LASTEXITCODE -ne 0) {
		throw "compile-incremental falhou"
	}
} elseif (-not (Test-Path $serverMainPath)) {
	Write-Host "[1/3] compile-incremental (obrigatorio: out/ foi limpo pelo bundle anterior) ..." -ForegroundColor Yellow
	$env:PRINCY_SKIP_GULP_CLEAN = "1"
	npm run compile-incremental
	if ($LASTEXITCODE -ne 0) {
		throw "compile-incremental falhou"
	}
} else {
	Write-Host "[skip] compile-incremental (-BundleOnly, out/ intacto)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "[2/3] compile-web (extensao princy-ai browser - antes do bundle) ..." -ForegroundColor Cyan
npm run compile-web
if ($LASTEXITCODE -ne 0) {
	throw "compile-web falhou"
}

$extJs = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"
if (-not (Test-Path $extJs)) {
	throw "Ausente apos compile-web: extensions\princy-ai\dist\browser\extension.js"
}
Write-Host "OK: princy-ai browser bundle" -ForegroundColor Green

Invoke-PrincyDeployScript -ScriptPath (Join-Path $PSScriptRoot "sync-princy-ai-out-extensions.ps1") -ScriptArgs @{ ProjectRoot = $ProjectRoot } | Out-Null

Write-Host ""
Write-Host "[3/3] bundle-server-web-out (esbuild: workbench.js + workbench.css + princy-ai builtin) ..." -ForegroundColor Cyan
npm run bundle-server-web-out
if ($LASTEXITCODE -ne 0) {
	throw "bundle-server-web-out falhou"
}

# HTML com meta builtin (apos bundle)
$wbHtmlSrc = Join-Path $ProjectRoot "src\vs\code\browser\workbench\workbench.html"
$wbHtmlOut = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.html"
$wbDevOut = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench-dev.html"
if (Test-Path $wbHtmlSrc) {
	$wbDir = Split-Path $wbHtmlOut -Parent
	if (-not (Test-Path $wbDir)) { New-Item -ItemType Directory -Force $wbDir | Out-Null }
	Copy-Item $wbHtmlSrc $wbHtmlOut -Force
	if (Test-Path (Join-Path $ProjectRoot "src\vs\code\browser\workbench\workbench-dev.html")) {
		Copy-Item (Join-Path $ProjectRoot "src\vs\code\browser\workbench\workbench-dev.html") $wbDevOut -Force
	}
	Write-Host "OK: workbench.html copiado para out/ (meta princy-ai)" -ForegroundColor Green
}

$wbJs = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.js"
$serverMain = Join-Path $ProjectRoot "out\server-main.js"
$hasPrincyInWorkbench = (Test-Path $wbJs) -and (Select-String -Path $wbJs -Pattern "princy-ai" -Quiet)
$hasPrincyInServer = (Test-Path $serverMain) -and (Select-String -Path $serverMain -Pattern "princy-ai" -Quiet)
if (-not $hasPrincyInWorkbench -and -not $hasPrincyInServer) {
	throw "princy-ai NAO aparece em workbench.js nem server-main.js - rebundle falhou"
}
Write-Host "OK: princy-ai no bundle (workbench=$hasPrincyInWorkbench server=$hasPrincyInServer)" -ForegroundColor Green

$required = @(
	"out\server-main.js",
	"out\vs\code\browser\workbench\workbench.html"
)
foreach ($rel in $required) {
	$p = Join-Path $ProjectRoot $rel
	if (-not (Test-Path $p)) {
		throw "Arquivo ausente apos compile: $rel"
	}
	Write-Host ("OK: " + $rel) -ForegroundColor Green
}
$wbInfo = Get-PrincyWorkbenchBundleInfo -ProjectRoot $ProjectRoot
if (-not $wbInfo.IsBundled) {
	throw "workbench.js apos bundle tem apenas $($wbInfo.JsBytes) bytes (min 800000). Nao rode compile-incremental depois deste script."
}
if (-not (Test-PrincyCodeWebProdBuild -ProjectRoot $ProjectRoot)) {
	throw "Bundle PROD incompleto: workbench.html + workbench.js bundled + workbench.css"
}
Write-Host ("OK: bundle producao (workbench.js {0} bytes)" -f $wbInfo.JsBytes) -ForegroundColor Green

$patchMeta = Join-Path $PSScriptRoot "patch-workbench-princy-meta.ps1"
if (Test-Path $patchMeta) {
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $patchMeta -ProjectRoot $ProjectRoot
}

. (Join-Path $PSScriptRoot "..\princy-ui-revision.ps1")
$RevMarker = Get-PrincyUiRevision
if (-not (Select-String -Path $extJs -Pattern $RevMarker -SimpleMatch -Quiet)) {
	throw "extension.js sem revisao $RevMarker - compile-web da extensao incompleto"
}
Write-Host "OK: chat UI revisao $RevMarker" -ForegroundColor Green

$layoutOut = Join-Path $ProjectRoot "out\vs\workbench\contrib\princy\browser\princyLayoutUnlock.contribution.js"
if (-not (Test-Path $layoutOut)) {
	throw "Ausente layout unlock compilado: $layoutOut (compile-incremental incompleto)"
}
Write-Host "OK: princyLayoutUnlock em out/" -ForegroundColor Green

$userDataDir = Join-Path $ProjectRoot ".princy-user-data"
$productionSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
if (Test-Path $productionSettings) {
	New-Item -ItemType Directory -Force (Join-Path $userDataDir "User") | Out-Null
	Copy-Item $productionSettings (Join-Path $userDataDir "User\settings.json") -Force
	Write-Host "OK: settings producao -> .princy-user-data\User\settings.json" -ForegroundColor Green
}

if (-not $SkipRestart) {
	Write-Host ""
	Write-Host "Reinstalando servico (sem -Dev) ..." -ForegroundColor Cyan
	$fix = Join-Path $ProjectRoot "deploy\windows\code-web\fix-princy-code-web-service.ps1"
	Invoke-PrincyDeployScript -ScriptPath $fix -ScriptArgs @{ ProjectRoot = $ProjectRoot } | Out-Null
}

Write-Host ""
Write-Host "Modo PRODUCAO ativo. Teste:" -ForegroundColor Green
Write-Host "  https://princyai.com/webeditor/" -ForegroundColor Cyan
Write-Host "  (Ctrl+F5 no browser; F12 Rede: poucos JS grandes, nao centenas de modulos)" -ForegroundColor DarkGray
