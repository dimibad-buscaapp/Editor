# Deploy completo Princy IA — evolucao Verdent-style (swarm, plan, jobs Postgres, r13).
# Admin VPS (PowerShell 7 como Administrador):
#   cd C:\Apps\Editor
#   git pull --no-rebase origin main
#   pwsh -ExecutionPolicy Bypass -File deploy\windows\code-web\deploy-princy-verdent-vps.ps1
#
# Rapido (~5 min, so chat): adicione -SkipFullCompile

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$SkipGitPull,
	[switch]$SkipFullCompile = $true,
	[switch]$KeepUserCache
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot
$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:VSCODE_SKIP_PRELAUNCH = "1"
$env:PRINCY_EDITOR_ROOT = $ProjectRoot

. (Join-Path $PSScriptRoot "..\princy-ui-revision.ps1")
$RevMarker = Get-PrincyUiRevision

Write-Host "=== Deploy Princy Verdent VPS (rev $RevMarker) ===" -ForegroundColor Cyan

# --- Settings producao (NAO e comando JSON solto — copia ficheiro) ---
$userDataDir = Join-Path $ProjectRoot ".princy-user-data"
$productionSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
$userSettings = Join-Path $userDataDir "User\settings.json"
if (-not (Test-Path $productionSettings)) {
	throw "Ausente $productionSettings"
}
New-Item -ItemType Directory -Force (Join-Path $userDataDir "User") | Out-Null
Copy-Item $productionSettings $userSettings -Force
Write-Host "OK: agentEndpoint = https://princyai.com/princy-api (settings copiados)" -ForegroundColor Green

if (-not $SkipGitPull) {
	Write-Host "`n[1] git pull ..." -ForegroundColor Cyan
	git pull --no-rebase origin main
	if ($LASTEXITCODE -ne 0) { throw "git pull falhou" }
	Write-Host "  HEAD: $(git log -1 --oneline)" -ForegroundColor Green
}

Write-Host "`n[2] Backend agent :3210 (Prisma + build swarm/jobs) ..." -ForegroundColor Cyan
$buildAgent = Join-Path $ProjectRoot "deploy\windows\agent-backend\build-princy-agent-backend.ps1"
if (-not (Test-Path $buildAgent)) { throw "Ausente $buildAgent" }
& pwsh -NoProfile -ExecutionPolicy Bypass -File $buildAgent -ProjectRoot $ProjectRoot
if ($LASTEXITCODE -ne 0) { throw "build-princy-agent-backend falhou" }

Write-Host "`n[3] Extensao princy-ai (chat r13 + swarm UI) ..." -ForegroundColor Cyan
$chatOnly = Join-Path $PSScriptRoot "compile-princy-chat-only.ps1"
if ($SkipFullCompile -or -not (Test-Path (Join-Path $PSScriptRoot "compile-princy-code-web-production.ps1"))) {
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $chatOnly -ProjectRoot $ProjectRoot -SkipGitPull -SkipRestart
	if ($LASTEXITCODE -ne 0) { throw "compile-princy-chat-only falhou" }
} else {
	$afterPull = Join-Path $PSScriptRoot "deploy-princy-after-pull.ps1"
	try {
		& pwsh -NoProfile -ExecutionPolicy Bypass -File $afterPull -ProjectRoot $ProjectRoot -SkipRestart -FullCompile
		if ($LASTEXITCODE -ne 0) { throw "deploy-princy-after-pull exit $LASTEXITCODE" }
	} catch {
		Write-Host "  AVISO: FullCompile falhou ($_) - fallback compile-web chat ..." -ForegroundColor Yellow
		& pwsh -NoProfile -ExecutionPolicy Bypass -File $chatOnly -ProjectRoot $ProjectRoot -SkipGitPull -SkipRestart
		if ($LASTEXITCODE -ne 0) { throw "compile-princy-chat-only falhou" }
	}
}

Write-Host "`n[3b] Reiniciar agent backend (build novo) ..." -ForegroundColor Cyan
Restart-Service PrincyAiAgentBackend -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 5

if (-not $KeepUserCache) {
	Write-Host "`n[4] Limpar cache webview ..." -ForegroundColor Cyan
	foreach ($sub in @('workspaceStorage', 'globalStorage', 'Cache', 'CachedData')) {
		$p = Join-Path $userDataDir $sub
		if (Test-Path $p) {
			Remove-Item $p -Recurse -Force -ErrorAction SilentlyContinue
			Write-Host "  Removido $sub" -ForegroundColor DarkGray
		}
	}
	Copy-Item $productionSettings $userSettings -Force
}

Write-Host "`n[5] Reiniciar servicos ..." -ForegroundColor Cyan
foreach ($name in @('PrincyAiAgentBackend', 'PrincyAiCodeWeb', 'PrincyCaddy')) {
	$svc = Get-Service $name -ErrorAction SilentlyContinue
	if ($svc) {
		Restart-Service $name -Force -ErrorAction SilentlyContinue
		Write-Host "  Restart $name" -ForegroundColor DarkGray
	}
}
Start-Sleep -Seconds 10

Write-Host "`n[6] Verificacao ..." -ForegroundColor Cyan
$checks = @(
	@{ Label = "Agent :3210"; Url = "http://127.0.0.1:3210/api/agent/health"; Expect = "durableJobs" },
	@{ Label = "Caddy HTTPS"; Url = "https://princyai.com/princy-api/api/agent/health"; Expect = "ok" },
	@{ Label = "Proxy :3200"; Url = "http://127.0.0.1:3200/princy-api/api/agent/health"; Expect = "ok" }
)
$allOk = $true
foreach ($c in $checks) {
	try {
		$r = Invoke-RestMethod $c.Url -TimeoutSec 20
		Write-Host "  OK $($c.Label)" -ForegroundColor Green
		if ($c.Expect -eq 'durableJobs' -and -not $r.durableJobs) {
			Write-Host "    AVISO: durableJobs=false (backend antigo?)" -ForegroundColor Yellow
		}
		if ($r.build) { Write-Host "    build=$($r.build)" -ForegroundColor DarkGray }
	} catch {
		Write-Host "  FALHA $($c.Label): $_" -ForegroundColor Red
		$allOk = $false
	}
}

$verify = Join-Path $PSScriptRoot "verify-princy-chat-api.ps1"
if (Test-Path $verify) {
	$exitV = & pwsh -NoProfile -ExecutionPolicy Bypass -File $verify -ProjectRoot $ProjectRoot
	if ($LASTEXITCODE -ne 0) { $allOk = $false }
}

Write-Host ""
if ($allOk) {
	Write-Host "DEPLOY VERDENT CONCLUIDO (rev $RevMarker)" -ForegroundColor Green
} else {
	Write-Host "DEPLOY PARCIAL - corrija falhas acima" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Browser:" -ForegroundColor Yellow
Write-Host "  1. Ctrl+Shift+Delete (cache princyai.com)" -ForegroundColor Cyan
Write-Host "  2. https://princyai.com/webeditor/ + Ctrl+F5" -ForegroundColor Cyan
Write-Host "  3. F1 -> Princy Ai: Reconnect Backend" -ForegroundColor Cyan
Write-Host "  4. Modos: Plan | Agent | Swarm no painel chat" -ForegroundColor Cyan

if (-not $allOk) { exit 1 }
