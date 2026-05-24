# DESBLOQUEIO VISUAL DEFINITIVO — compila tudo, limpa cache, repara chat, verifica marcadores.
# Use quando visual antigo E chat offline apos git pull / redeploy.
#
# VPS Admin (PowerShell 7 como Administrador):
#   pwsh -ExecutionPolicy Bypass -File deploy\windows\desbloquear-visual-definitivo.ps1 -ProjectRoot C:\Apps\Editor
#
# Tempo tipico: 15-45 min (compile completo). Para so reiniciar sem compile: -SkipCompile

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$SkipGitPull,
	[switch]$SkipCompile,
	[switch]$KeepUserData
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot
$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:VSCODE_SKIP_PRELAUNCH = "1"
$env:PRINCY_EDITOR_ROOT = $ProjectRoot

$codeWebDir = Join-Path $ProjectRoot "deploy\windows\code-web"
$agentDir = Join-Path $ProjectRoot "deploy\windows\agent-backend"

. (Join-Path $ProjectRoot "deploy\windows\princy-ui-revision.ps1")
. (Join-Path $codeWebDir "Princy-CodeWeb-Build.ps1")

$RevMarker = Get-PrincyUiRevision
$RevMarkers = Get-PrincyUiRevisionMarkers

Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  DESBLOQUEIO VISUAL DEFINITIVO PRINCY" -ForegroundColor Magenta
Write-Host "  compile + cache show + chat API" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "Shell: $(Get-PrincyPwshExe) (PS $($PSVersionTable.PSVersion))" -ForegroundColor DarkGray
Write-Host "Rev UI alvo: $RevMarker`n" -ForegroundColor DarkGray

# --- [0] Git pull ---
if (-not $SkipGitPull) {
	Write-Host "[0/9] git pull ..." -ForegroundColor Cyan
	git pull --no-rebase origin main
	if ($LASTEXITCODE -ne 0) { throw "git pull falhou" }
	Write-Host "  HEAD: $(git log -1 --oneline)" -ForegroundColor Green
}

# --- [1] Parar servicos ---
Write-Host "`n[1/9] Parar servicos ..." -ForegroundColor Cyan
foreach ($name in @('PrincyAiCodeWeb', 'PrincyAiAgentBackend', 'PrincyAiIndex', 'PrincyCaddy')) {
	$svc = Get-Service $name -ErrorAction SilentlyContinue
	if ($svc -and $svc.Status -eq 'Running') {
		try {
			Stop-Service $name -Force -ErrorAction Stop
			Write-Host "  Parado $name" -ForegroundColor DarkGray
		} catch {
			Write-Host "  AVISO: $name : $_" -ForegroundColor Yellow
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

# --- [2] Limpar cache (layout + browser + webview) ---
Write-Host "`n[2/9] Limpar cache utilizador ..." -ForegroundColor Cyan
$userDataDir = Join-Path $ProjectRoot ".princy-user-data"
$productionSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
$userSettings = Join-Path $userDataDir "User\settings.json"

if (-not $KeepUserData -and (Test-Path $userDataDir)) {
	foreach ($sub in @('workspaceStorage', 'globalStorage', 'Cache', 'CachedData', 'Code Cache', 'GPUCache', 'Service Worker')) {
		$p = Join-Path $userDataDir $sub
		if (Test-Path $p) {
			try {
				Remove-Item $p -Recurse -Force -ErrorAction Stop
				Write-Host "  Removido $sub" -ForegroundColor DarkGray
			} catch {
				Write-Host "  AVISO: $sub : $_" -ForegroundColor Yellow
			}
		}
	}
	# state.vscdb residual
	Get-ChildItem $userDataDir -Recurse -Filter "state.vscdb" -ErrorAction SilentlyContinue | ForEach-Object {
		try { Remove-Item $_.FullName -Force -ErrorAction Stop } catch { }
	}
}

if (Test-Path $productionSettings) {
	New-Item -ItemType Directory -Force (Join-Path $userDataDir "User") | Out-Null
	Copy-Item $productionSettings $userSettings -Force
	Write-Host "  OK: settings producao (forceMaximized=false, forceVisualUnlock=true)" -ForegroundColor Green
}

# --- [3] Compile completo ---
if (-not $SkipCompile) {
	Write-Host "`n[3/9] Compile COMPLETO (workbench + chat + bundle) ..." -ForegroundColor Cyan
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
	Write-Host "`n[3/9] Compile ignorado (-SkipCompile) — sync extensao ..." -ForegroundColor DarkGray
	Invoke-PrincyDeployScript -ScriptPath (Join-Path $codeWebDir "sync-princy-ai-out-extensions.ps1") -ScriptArgs @{ ProjectRoot = $ProjectRoot } | Out-Null
}

# --- [4] Verificar artefactos compilados ---
Write-Host "`n[4/9] Verificar bundles compilados ..." -ForegroundColor Cyan
$extJs = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"
$extOut = Join-Path $ProjectRoot "out\extensions\princy-ai\dist\browser\extension.js"
$wbJs = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.js"
$layoutOut = Join-Path $ProjectRoot "out\vs\workbench\contrib\princy\browser\princyLayoutUnlock.contribution.js"
$serverMain = Join-Path $ProjectRoot "out\server-main.js"

$artifactChecks = @(
	@{ Label = "Chat dist/extension.js"; Path = $extJs; Required = $true },
	@{ Label = "Chat out/extensions"; Path = $extOut; Required = $true },
	@{ Label = "Workbench workbench.js"; Path = $wbJs; Required = $true },
	@{ Label = "Layout unlock contrib"; Path = $layoutOut; Required = $true },
	@{ Label = "Server main (proxy /princy-api)"; Path = $serverMain; Required = $true }
)

$artifactsOk = $true
foreach ($a in $artifactChecks) {
	if (-not (Test-Path $a.Path)) {
		Write-Host "  FALTA: $($a.Label) -> $($a.Path)" -ForegroundColor Red
		if ($a.Required) { $artifactsOk = $false }
		continue
	}
	Write-Host "  OK: $($a.Label)" -ForegroundColor Green
}

$foundMarkers = @()
foreach ($m in $RevMarkers) {
	if (Test-Path $extJs) {
		if (Select-String -Path $extJs -Pattern $m -SimpleMatch -Quiet) { $foundMarkers += $m }
	}
}
Write-Host "  Marcadores chat: $($foundMarkers -join ', ')" -ForegroundColor $(if ($foundMarkers -contains $RevMarker) { 'Green' } else { 'Red' })
if (-not (Select-String -Path $extJs -Pattern $RevMarker -SimpleMatch -Quiet)) {
	Write-Host "  FALHA: extension.js sem $RevMarker — git pull + compile completo" -ForegroundColor Red
	$artifactsOk = $false
}
if (-not $artifactsOk) {
	throw "Artefactos compilados incompletos ou desatualizados."
}

# --- [5] Repair agent backend ---
Write-Host "`n[5/9] Repair agent backend :3210 ..." -ForegroundColor Cyan
$repair = Join-Path $agentDir "repair-princy-agent-3210.ps1"
if (Test-Path $repair) {
	Invoke-PrincyDeployScript -ScriptPath $repair -ScriptArgs @{
		ProjectRoot = $ProjectRoot
		SkipRestartCodeWeb = $true
	} | Out-Null
} else {
	Write-Host "  AVISO: repair script ausente" -ForegroundColor Yellow
}

# --- [6] Reiniciar servicos ---
Write-Host "`n[6/9] Reiniciar servicos ..." -ForegroundColor Cyan
$restart = Join-Path $ProjectRoot "deploy\windows\restart-princy-services.ps1"
if (Test-Path $restart) {
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $restart
}
Start-Sleep -Seconds 8

$codeWeb = Get-Service PrincyAiCodeWeb -ErrorAction SilentlyContinue
if (-not $codeWeb -or $codeWeb.Status -ne 'Running') {
	Write-Host "  Code Web nao running — reinstalar ..." -ForegroundColor Yellow
	Invoke-PrincyDeployScript -ScriptPath (Join-Path $codeWebDir "fix-princy-code-web-service.ps1") -ScriptArgs @{ ProjectRoot = $ProjectRoot } | Out-Null
	Start-Sleep -Seconds 10
}

# --- [7] Fix 502 HTTPS ---
Write-Host "`n[7/9] Fix 502 / HTTPS ..." -ForegroundColor Cyan
$fix502 = Join-Path $codeWebDir "fix-webeditor-502.ps1"
if (Test-Path $fix502) {
	$exit502 = Invoke-PrincyDeployScript -ScriptPath $fix502 -ScriptArgs @{ ProjectRoot = $ProjectRoot }
	if ([int]$exit502 -ne 0) {
		Write-Host "  AVISO: fix-webeditor-502 reportou problema" -ForegroundColor Yellow
	}
}

# --- [8] Verificar chat API ---
Write-Host "`n[8/9] Verificar chat API (health + jobs) ..." -ForegroundColor Cyan
$verify = Join-Path $codeWebDir "verify-princy-chat-api.ps1"
$chatOk = $true
if (Test-Path $verify) {
	$exitVerify = Invoke-PrincyDeployScript -ScriptPath $verify -ScriptArgs @{ ProjectRoot = $ProjectRoot }
	if ([int]$exitVerify -ne 0) { $chatOk = $false }
} else {
	Write-Host "  AVISO: verify-princy-chat-api.ps1 ausente" -ForegroundColor Yellow
}

# --- [9] Resumo ---
Write-Host "`n[9/9] Resumo final ..." -ForegroundColor Cyan
$allOk = $artifactsOk -and $chatOk
foreach ($name in @('PrincyAiAgentBackend', 'PrincyAiCodeWeb', 'PrincyCaddy')) {
	$svc = Get-Service $name -ErrorAction SilentlyContinue
	if ($svc -and $svc.Status -eq 'Running') {
		Write-Host "  OK servico $name Running" -ForegroundColor Green
	} else {
		Write-Host "  FALHA servico $name" -ForegroundColor Red
		$allOk = $false
	}
}

Write-Host ""
Write-Host "========================================" -ForegroundColor $(if ($allOk) { 'Green' } else { 'Yellow' })
if ($allOk) {
	Write-Host "  DESBLOQUEIO CONCLUIDO" -ForegroundColor Green
} else {
	Write-Host "  DESBLOQUEIO PARCIAL — veja falhas acima" -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor $(if ($allOk) { 'Green' } else { 'Yellow' })
Write-Host ""
Write-Host "NO BROWSER (obrigatorio — git pull NAO basta):" -ForegroundColor Yellow
Write-Host "  1. Ctrl+Shift+Delete -> apagar TUDO de princyai.com" -ForegroundColor Cyan
Write-Host "  2. https://princyai.com/webeditor/ + Ctrl+F5" -ForegroundColor Cyan
Write-Host "  3. F1 -> Force Visual Reload" -ForegroundColor Cyan
Write-Host "  4. F1 -> Unlock Princy Editor Layout" -ForegroundColor Cyan
Write-Host "  5. F12 Console NO PAINEL CHAT (nao no PowerShell):" -ForegroundColor Cyan
Write-Host "     document.body.dataset.princyUiRev" -ForegroundColor DarkGray
Write-Host "     = $RevMarker" -ForegroundColor Green
Write-Host "  6. Enviar mensagem teste no chat Agent" -ForegroundColor Cyan
Write-Host ""
Write-Host "Se princyUiRev != $RevMarker -> browser ainda com cache antigo ou compile nao correu." -ForegroundColor DarkGray

if (-not $allOk) { exit 1 }
