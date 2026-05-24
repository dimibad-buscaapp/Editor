# REDEPLOY COMPLETO Princy: compile web + agent + reinicio de TODOS os servicos.
# Use quando visual antigo E/OU chat parou de funcionar.
#
# VPS Admin (PowerShell 7 como Administrador):
#   pwsh -ExecutionPolicy Bypass -File deploy\windows\redeploy-princy-completo.ps1 -ProjectRoot C:\Apps\Editor

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$SkipGitPull,
	[switch]$SkipCompile,
	[switch]$KeepUserCache
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot
$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:VSCODE_SKIP_PRELAUNCH = "1"
$env:PRINCY_EDITOR_ROOT = $ProjectRoot

. (Join-Path $PSScriptRoot "..\princy-ui-revision.ps1")

$RevMarker = Get-PrincyUiRevision
$codeWebDir = Join-Path $ProjectRoot "deploy\windows\code-web"
$agentDir = Join-Path $ProjectRoot "deploy\windows\agent-backend"

. (Join-Path $codeWebDir "Princy-CodeWeb-Build.ps1")

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  REDEPLOY COMPLETO PRINCY" -ForegroundColor Cyan
Write-Host "  compile web + agent + todos servicos" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Shell: $(Get-PrincyPwshExe) (PS $($PSVersionTable.PSVersion))" -ForegroundColor DarkGray
Write-Host "Rev UI alvo: $RevMarker`n" -ForegroundColor DarkGray

# --- [0] Git pull ---
if (-not $SkipGitPull) {
	Write-Host "[0/7] git pull ..." -ForegroundColor Cyan
	git pull --no-rebase origin main
	if ($LASTEXITCODE -ne 0) { throw "git pull falhou" }
	Write-Host "  HEAD: $(git log -1 --oneline)" -ForegroundColor Green
}

# --- [1] Parar servicos e =portas ---
Write-Host "`n[1/7] Parar servicos e liberar portas ..." -ForegroundColor Cyan
foreach ($name in @('PrincyAiCodeWeb', 'PrincyAiAgentBackend', 'PrincyAiIndex', 'PrincyCaddy')) {
	$svc = Get-Service $name -ErrorAction SilentlyContinue
	if ($svc -and $svc.Status -eq 'Running') {
		try {
			Stop-Service $name -Force -ErrorAction Stop
			Write-Host "  Parado $name" -ForegroundColor DarkGray
		} catch {
			Write-Host "  AVISO: nao parou $name : $_" -ForegroundColor Yellow
		}
	}
}
Start-Sleep -Seconds 3
foreach ($port in @(3200, 3210, 3220)) {
	$stopPort = Join-Path $codeWebDir "Stop-CodeWebPort.ps1"
	if (Test-Path $stopPort) {
		Invoke-PrincyDeployScript -ScriptPath $stopPort -ScriptArgs @{ Port = $port } | Out-Null
	}
}

# --- [2] Limpar cache (layout + webview + extensao) ---
if (-not $KeepUserCache) {
	Write-Host "`n[2/7] Limpar cache .princy-user-data ..." -ForegroundColor Cyan
	$userDataDir = Join-Path $ProjectRoot ".princy-user-data"
	$removed = 0
	foreach ($sub in @('workspaceStorage', 'globalStorage', 'Cache', 'CachedData', 'Code Cache', 'GPUCache')) {
		$p = Join-Path $userDataDir $sub
		if (Test-Path $p) {
			try {
				Remove-Item $p -Recurse -Force -ErrorAction Stop
				$removed++
				Write-Host "  Removido $sub" -ForegroundColor DarkGray
			} catch {
				Write-Host "  AVISO: $sub : $_" -ForegroundColor Yellow
			}
		}
	}
	$productionSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
	$userSettings = Join-Path $userDataDir "User\settings.json"
	if (Test-Path $productionSettings) {
		New-Item -ItemType Directory -Force (Join-Path $userDataDir "User") | Out-Null
		Copy-Item $productionSettings $userSettings -Force
		Write-Host "  OK: settings producao reaplicados" -ForegroundColor Green
	}
	Write-Host "  OK: $removed pastas de cache removidas" -ForegroundColor Green
} else {
	Write-Host "`n[2/6] Cache mantido (-KeepUserCache)" -ForegroundColor DarkGray
}

# --- [3] Compile web completo ---
if (-not $SkipCompile) {
	Write-Host "`n[3/7] Compile web COMPLETO (15-45 min) ..." -ForegroundColor Cyan
	$compileFull = Join-Path $codeWebDir "compile-full-princy-webeditor.ps1"
	$exitCode = Invoke-PrincyDeployScript -ScriptPath $compileFull -ScriptArgs @{
		ProjectRoot = $ProjectRoot
		SkipPull = $true
		SkipLayoutCacheClear = $true
	}
	if ([int]$exitCode -ne 0) {
		throw "compile-full falhou (exit $exitCode)"
	}
} else {
	Write-Host "`n[3/6] Compile ignorado (-SkipCompile)" -ForegroundColor DarkGray
	Invoke-PrincyDeployScript -ScriptPath (Join-Path $codeWebDir "sync-princy-ai-out-extensions.ps1") -ScriptArgs @{ ProjectRoot = $ProjectRoot } | Out-Null
}

$extJs = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"
if (-not (Test-Path $extJs)) {
	throw "Falta $extJs"
}
if (-not (Select-String -Path $extJs -Pattern $RevMarker -Quiet)) {
	Write-Host "  AVISO: extension.js sem $RevMarker - a correr compile-web rapido ..." -ForegroundColor Yellow
	npm run compile-web
	if ($LASTEXITCODE -ne 0) { throw "compile-web falhou" }
	Invoke-PrincyDeployScript -ScriptPath (Join-Path $codeWebDir "sync-princy-ai-out-extensions.ps1") -ScriptArgs @{ ProjectRoot = $ProjectRoot } | Out-Null
	if (-not (Select-String -Path $extJs -Pattern $RevMarker -Quiet)) {
		throw "extension.js ainda sem $RevMarker"
	}
}
Write-Host "  OK: chat bundle $RevMarker" -ForegroundColor Green

# --- [4] Repair agent backend :3210 ---
Write-Host "`n[4/7] Repair agent backend :3210 ..." -ForegroundColor Cyan
$repair = Join-Path $agentDir "repair-princy-agent-3210.ps1"
if (Test-Path $repair) {
	Invoke-PrincyDeployScript -ScriptPath $repair -ScriptArgs @{
		ProjectRoot = $ProjectRoot
		SkipRestartCodeWeb = $true
	} | Out-Null
} else {
	Write-Host "  AVISO: repair script ausente" -ForegroundColor Yellow
}

# --- [5] Reiniciar TODOS os servicos ---
Write-Host "`n[5/7] Reiniciar todos os servicos ..." -ForegroundColor Cyan
$restart = Join-Path $ProjectRoot "deploy\windows\restart-princy-services.ps1"
if (Test-Path $restart) {
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $restart
}
Start-Sleep -Seconds 8

# Reinstalar Code Web se servico nao subiu
$codeWeb = Get-Service PrincyAiCodeWeb -ErrorAction SilentlyContinue
if (-not $codeWeb -or $codeWeb.Status -ne 'Running') {
	Write-Host "  Code Web nao running - reinstalar servico ..." -ForegroundColor Yellow
	Invoke-PrincyDeployScript -ScriptPath (Join-Path $codeWebDir "fix-princy-code-web-service.ps1") -ScriptArgs @{ ProjectRoot = $ProjectRoot } | Out-Null
	Start-Sleep -Seconds 10
}

# --- [6] Verificacao final ---
Write-Host "`n[6/7] Verificacao ..." -ForegroundColor Cyan
$checks = @(
	@{ Label = "Agent :3210"; Url = "http://127.0.0.1:3210/api/agent/health" },
	@{ Label = "Proxy /princy-api"; Url = "http://127.0.0.1:3200/princy-api/api/agent/health" },
	@{ Label = "Webeditor"; Url = "http://127.0.0.1:3200/webeditor/" }
)
$allOk = $true
foreach ($c in $checks) {
	try {
		$r = Invoke-WebRequest $c.Url -UseBasicParsing -TimeoutSec 20
		Write-Host "  OK $($c.Label) HTTP $($r.StatusCode)" -ForegroundColor Green
	} catch {
		Write-Host "  FALHA $($c.Label): $_" -ForegroundColor Red
		$allOk = $false
	}
}
foreach ($name in @('PrincyAiAgentBackend', 'PrincyAiCodeWeb', 'PrincyCaddy')) {
	$svc = Get-Service $name -ErrorAction SilentlyContinue
	if ($svc -and $svc.Status -eq 'Running') {
		Write-Host "  OK servico $name Running" -ForegroundColor Green
	} else {
		Write-Host "  FALHA servico $name" -ForegroundColor Red
		$allOk = $false
	}
}

Write-Host "`n[6b/8] Verificar chat API ..." -ForegroundColor Cyan
$verify = Join-Path $codeWebDir "verify-princy-chat-api.ps1"
if (Test-Path $verify) {
	$exitVerify = Invoke-PrincyDeployScript -ScriptPath $verify -ScriptArgs @{ ProjectRoot = $ProjectRoot }
	if ([int]$exitVerify -ne 0) { $allOk = $false }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor $(if ($allOk) { 'Green' } else { 'Yellow' })
if ($allOk) {
	Write-Host "  REDEPLOY CONCLUIDO" -ForegroundColor Green
} else {
	Write-Host "  REDEPLOY PARCIAL - veja falhas acima" -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor $(if ($allOk) { 'Green' } else { 'Yellow' })
Write-Host ""
Write-Host "NO BROWSER (obrigatorio):" -ForegroundColor Yellow
Write-Host "  1. Ctrl+Shift+Delete -> apagar cache princyai.com (ou janela anonima)" -ForegroundColor Cyan
Write-Host "  2. https://princyai.com/webeditor/ + Ctrl+F5" -ForegroundColor Cyan
Write-Host "  3. F1 -> Force Visual Reload" -ForegroundColor Cyan
Write-Host "  4. F1 -> Unlock Princy Editor Layout" -ForegroundColor Cyan
Write-Host "  5. F12 Console NO PAINEL CHAT: document.body.dataset.princyUiRev" -ForegroundColor Cyan
Write-Host "     = $RevMarker" -ForegroundColor DarkGray
Write-Host "  6. Enviar mensagem teste no chat Agent" -ForegroundColor Cyan

# --- [7] Corrigir 502 (Caddy sem Code Web :3200) ---
Write-Host "`n[7/7] Fix 502 / HTTPS ..." -ForegroundColor Cyan
$fix502 = Join-Path $codeWebDir "fix-webeditor-502.ps1"
if (Test-Path $fix502) {
	$exit502 = Invoke-PrincyDeployScript -ScriptPath $fix502 -ScriptArgs @{ ProjectRoot = $ProjectRoot }
	if ([int]$exit502 -eq 0) {
		$allOk = $true
	}
}

if (-not $allOk) { exit 1 }
