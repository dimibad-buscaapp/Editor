# Compila APENAS o chat Princy (compile-web) + sync + settings + restart — ~2-5 min.
# Use isto quando git pull trouxe fix do chat mas o editor ainda mostra offline/visual antigo.
#
# Admin VPS:
#   cd C:\Apps\Editor
#   git pull --no-rebase origin main
#   pwsh -File deploy\windows\code-web\compile-princy-chat-only.ps1 -ProjectRoot C:\Apps\Editor

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$SkipRestart,
	[switch]$SkipGitPull
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot
$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:VSCODE_SKIP_PRELAUNCH = "1"

. (Join-Path $PSScriptRoot "..\princy-ui-revision.ps1")
$Rev = Get-PrincyUiRevision
$markers = Get-PrincyUiRevisionMarkers

Write-Host "=== Compile CHAT Princy (compile-web) rev $Rev ===" -ForegroundColor Magenta
Write-Host "NOTA: extension.js NAO vai no git — TEM de compilar nesta maquina apos pull.`n" -ForegroundColor Yellow

if (-not $SkipGitPull) {
	Write-Host "[0] git pull ..." -ForegroundColor Cyan
	git pull --no-rebase origin main
	if ($LASTEXITCODE -ne 0) { throw "git pull falhou" }
	$head = git log -1 --oneline
	Write-Host "  HEAD: $head" -ForegroundColor DarkGray
}

Write-Host "`n[1] npm run compile-web (princy-ai browser bundle) ..." -ForegroundColor Cyan
npm run compile-web
if ($LASTEXITCODE -ne 0) { throw "compile-web falhou — corrija erros TypeScript acima" }

$extJs = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"
if (-not (Test-Path $extJs)) {
	throw "Ausente: $extJs"
}

$extText = Get-Content $extJs -Raw
$missing = @()
foreach ($m in $markers) {
	if ($extText -notmatch [regex]::Escape($m)) { $missing += $m }
}
if ($missing.Count -gt 0) {
	throw "extension.js sem marcadores $Rev : $($missing -join ', ') — codigo desatualizado?"
}
Write-Host "OK: $extJs ($([math]::Round((Get-Item $extJs).Length/1KB)) KB) rev $Rev" -ForegroundColor Green

Write-Host "`n[2] sync -> out/extensions/princy-ai ..." -ForegroundColor Cyan
& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "sync-princy-ai-out-extensions.ps1") -ProjectRoot $ProjectRoot

$patchMeta = Join-Path $PSScriptRoot "patch-workbench-princy-meta.ps1"
if (Test-Path $patchMeta) {
	Write-Host "`n[3] patch workbench meta princy-ai ..." -ForegroundColor Cyan
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $patchMeta -ProjectRoot $ProjectRoot
}

Write-Host "`n[4] settings producao (HTTPS /princy-api) ..." -ForegroundColor Cyan
$prod = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
$userSettings = Join-Path $ProjectRoot ".princy-user-data\User\settings.json"
if (Test-Path $prod) {
	New-Item -ItemType Directory -Force (Split-Path $userSettings -Parent) | Out-Null
	Copy-Item $prod $userSettings -Force
	Write-Host "OK: princy-production.settings.json aplicado" -ForegroundColor Green
}

Write-Host "`n[5] teste proxy 3200 -> 3210 ..." -ForegroundColor Cyan
$proxyTest = Join-Path $PSScriptRoot "test-princy-3200-3210-proxy.ps1"
if (Test-Path $proxyTest) {
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $proxyTest -ProjectRoot $ProjectRoot
}

if (-not $SkipRestart) {
	Write-Host "`n[6] Restart PrincyAiCodeWeb ..." -ForegroundColor Cyan
	Restart-Service PrincyAiCodeWeb -Force -ErrorAction Stop
	Start-Sleep -Seconds 8
	$s = Get-Service PrincyAiCodeWeb
	Write-Host "  PrincyAiCodeWeb: $($s.Status)" -ForegroundColor $(if ($s.Status -eq 'Running') { 'Green' } else { 'Red' })
}

Write-Host ""
Write-Host "=== FEITO ===" -ForegroundColor Green
Write-Host "Browser: https://princyai.com/webeditor/ + Ctrl+Shift+Delete + Ctrl+F5"
Write-Host "Chat: bolinha verde; rev=$Rev; endpoint=https://princyai.com/princy-api"
Write-Host ""
Write-Host "Se o editor ainda estiver em branco, rode o compile PROD completo:" -ForegroundColor Yellow
Write-Host "  pwsh -File deploy\windows\code-web\compile-princy-code-web-production.ps1 -ProjectRoot $ProjectRoot"
