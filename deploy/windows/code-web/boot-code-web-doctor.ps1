# Um unico script para arrancar https://princyai.com/webeditor/
# Admin no VPS: powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\boot-code-web-doctor.ps1
# Opcional: -RunProductionCompile (30-90 min na primeira vez)

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$RunProductionCompile,
	[switch]$SkipGitPull
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Princy Code Web Doctor" -ForegroundColor Cyan
Write-Host "  Meta: https://princyai.com/webeditor/" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not $SkipGitPull -and (Test-Path (Join-Path $ProjectRoot ".git"))) {
	Write-Host "[1] git pull ..." -ForegroundColor Cyan
	Set-Location $ProjectRoot
	git pull 2>&1 | Write-Host
}

Write-Host "[2] Caddyfile -> C:\Caddy\Caddyfile" -ForegroundColor Cyan
$srcCaddy = Join-Path $ProjectRoot "deploy\windows\code-web\Caddyfile"
if (Test-Path $srcCaddy) {
	New-Item -ItemType Directory -Force "C:\Caddy" | Out-Null
	Copy-Item $srcCaddy "C:\Caddy\Caddyfile" -Force
	Write-Host "  Copiado." -ForegroundColor Green
	if (Get-Command caddy.exe -ErrorAction SilentlyContinue) {
		& caddy validate --config C:\Caddy\Caddyfile 2>&1 | Write-Host
	}
} else {
	Write-Host "  Caddyfile ausente no repo." -ForegroundColor Red
}

$prodHtml = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.html"
$prodCss = Join-Path $ProjectRoot "out\vs\workbench\workbench.web.main.css"
$hasProd = (Test-Path $prodHtml) -and (Test-Path $prodCss)

if ($RunProductionCompile -or -not $hasProd) {
	if (-not $hasProd) {
		Write-Host "[3] Compile PRODUCAO obrigatorio (sem workbench.html o browser trava)." -ForegroundColor Yellow
	}
	$compile = Join-Path $ProjectRoot "deploy\windows\code-web\compile-princy-code-web-production.ps1"
	if (Test-Path $compile) {
		Write-Host "[3] compile-princy-code-web-production.ps1 (pode demorar) ..." -ForegroundColor Cyan
		& powershell -ExecutionPolicy Bypass -File $compile -ProjectRoot $ProjectRoot -SkipRestart
		if ($LASTEXITCODE -ne 0) {
			Write-Host "Compile falhou — corrija erros acima antes de continuar." -ForegroundColor Red
			exit 1
		}
	} else {
		Write-Host "[3] Script de compile nao encontrado." -ForegroundColor Red
		exit 1
	}
} else {
	Write-Host "[3] Compile producao: OK" -ForegroundColor Green
}

Write-Host "[4] Garantir --server-base-path /webeditor (nao raiz :3200) ..." -ForegroundColor Cyan
$ensure = Join-Path $ProjectRoot "deploy\windows\code-web\ensure-webeditor-base-path.ps1"
& powershell -ExecutionPolicy Bypass -File $ensure -ProjectRoot $ProjectRoot
if ($LASTEXITCODE -ne 0) { exit 1 }

$caddySvc = Get-Service PrincyCaddy -ErrorAction SilentlyContinue
if ($caddySvc) {
	Write-Host "[5] Restart PrincyCaddy ..." -ForegroundColor Cyan
	Restart-Service PrincyCaddy -Force -ErrorAction SilentlyContinue
	Start-Sleep -Seconds 4
} else {
	Write-Host "[5] PrincyCaddy ausente — rode fix-princy-caddy.ps1" -ForegroundColor Yellow
}

Write-Host "[6] Verificacao publica ..." -ForegroundColor Cyan
$verify = Join-Path $ProjectRoot "deploy\windows\code-web\fix-webeditor-502.ps1"
& powershell -ExecutionPolicy Bypass -File $verify -ProjectRoot $ProjectRoot
exit $LASTEXITCODE
