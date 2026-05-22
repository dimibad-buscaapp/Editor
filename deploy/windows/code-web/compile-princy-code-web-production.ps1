# Compile producao do Code-OSS Web (workbench.html + esbuild bundle CSS/JS) e reinicia PrincyAiCodeWeb.
# Admin, VPS: pode demorar 30-90 min na primeira vez; -BundleOnly so esbuild+ext (10-30 min).
# powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\compile-princy-code-web-production.ps1
# powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\compile-princy-code-web-production.ps1 -BundleOnly

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$SkipRestart,
	[switch]$BundleOnly
)

$ErrorActionPreference = "Stop"

Set-Location $ProjectRoot
$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:VSCODE_SKIP_PRELAUNCH = "1"

Write-Host "=== Compile Code Web PRODUCAO ===" -ForegroundColor Cyan
Write-Host "Pasta: $ProjectRoot"
Write-Host ""

$stopPort = Join-Path $ProjectRoot "deploy\windows\code-web\Stop-CodeWebPort.ps1"
if (Test-Path $stopPort) {
	& powershell -ExecutionPolicy Bypass -File $stopPort -Port 3200
}

$svc = Get-Service PrincyAiCodeWeb -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq 'Running') {
	Stop-Service PrincyAiCodeWeb -Force
	Start-Sleep -Seconds 3
}

if (-not $BundleOnly) {
	Write-Host "[1/3] compile-incremental (TypeScript -> out/) ..." -ForegroundColor Cyan
	$env:PRINCY_SKIP_GULP_CLEAN = "1"
	npm run compile-incremental
	if ($LASTEXITCODE -ne 0) {
		throw "compile-incremental falhou"
	}
} else {
	Write-Host "[skip] compile-incremental (-BundleOnly)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "[2/3] bundle-server-web-out (esbuild: workbench.js + workbench.css) ..." -ForegroundColor Cyan
npm run bundle-server-web-out
if ($LASTEXITCODE -ne 0) {
	throw "bundle-server-web-out falhou"
}

Write-Host ""
Write-Host "[3/3] compile-web (extensao princy-ai browser) ..." -ForegroundColor Cyan
npm run compile-web
if ($LASTEXITCODE -ne 0) {
	throw "compile-web falhou"
}

. (Join-Path $PSScriptRoot "Princy-CodeWeb-Build.ps1")

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
if (-not (Test-PrincyCodeWebProdBuild -ProjectRoot $ProjectRoot)) {
	throw "Bundle PROD incompleto: precisa workbench.js E workbench.css (browser) em out\vs\code\browser\workbench\"
}
Write-Host "OK: bundle producao (CSS ou JS do workbench)" -ForegroundColor Green

if (-not $SkipRestart) {
	Write-Host ""
	Write-Host "Reinstalando servico (sem -Dev) ..." -ForegroundColor Cyan
	$fix = Join-Path $ProjectRoot "deploy\windows\code-web\fix-princy-code-web-service.ps1"
	& powershell -ExecutionPolicy Bypass -File $fix -ProjectRoot $ProjectRoot
}

Write-Host ""
Write-Host "Modo PRODUCAO ativo. Teste:" -ForegroundColor Green
Write-Host "  https://princyai.com/webeditor/" -ForegroundColor Cyan
Write-Host "  (Ctrl+F5 no browser; F12 Rede: poucos JS grandes, nao centenas de modulos)" -ForegroundColor DarkGray
