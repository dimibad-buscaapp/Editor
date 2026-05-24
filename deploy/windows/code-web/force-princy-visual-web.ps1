# Forca visual premium do chat Princy no Code Web (compile-web + settings + sync + restart).
# VPS Admin:
#   pwsh -ExecutionPolicy Bypass -File deploy\windows\code-web\force-princy-visual-web.ps1 -ProjectRoot C:\Apps\Editor

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$SkipFullCompile,
	[switch]$SkipRestart
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot
$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:VSCODE_SKIP_PRELAUNCH = "1"
$env:PRINCY_EDITOR_ROOT = $ProjectRoot

. (Join-Path $PSScriptRoot "Princy-CodeWeb-Build.ps1")

Write-Host "=== Forcar visual Princy (chat premium) ===" -ForegroundColor Cyan
Write-Host "Shell: $(Get-PrincyPwshExe) (PS $($PSVersionTable.PSVersion))" -ForegroundColor DarkGray
Write-Host "Pasta: $ProjectRoot"

$userDataDir = Join-Path $ProjectRoot ".princy-user-data"
$productionSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
$userSettings = Join-Path $userDataDir "User\settings.json"
if (Test-Path $productionSettings) {
	New-Item -ItemType Directory -Force (Join-Path $userDataDir "User") | Out-Null
	Copy-Item $productionSettings $userSettings -Force
	Write-Host "OK: settings producao" -ForegroundColor Green
}

# Estado de layout maximizado (workspace storage) - forca reset
$wsStorage = Join-Path $userDataDir "workspaceStorage"
if (Test-Path $wsStorage) {
	$stateFiles = Get-ChildItem $wsStorage -Recurse -Filter "state.vscdb" -ErrorAction SilentlyContinue
	foreach ($f in $stateFiles) {
		try {
			Remove-Item $f.FullName -Force -ErrorAction Stop
			Write-Host "Removido layout cache: $($f.FullName)" -ForegroundColor DarkGray
		} catch {
			Write-Host "AVISO: nao foi possivel limpar $($f.FullName)" -ForegroundColor Yellow
		}
	}
}

if (-not $SkipFullCompile) {
	$compileScript = Join-Path $PSScriptRoot "compile-princy-code-web-production.ps1"
	if (Test-Path $compileScript) {
		Write-Host "`n[1] Compile producao completo ..." -ForegroundColor Cyan
		$exitCode = Invoke-PrincyDeployScript -ScriptPath $compileScript -ScriptArgs @{
			ProjectRoot = $ProjectRoot
			SkipRestart = $true
		}
		if ([int]$exitCode -ne 0) {
			throw "compile-princy-code-web-production falhou (exit $exitCode). Corrija erros TypeScript e repita."
		}
	} else {
		throw "Ausente: $compileScript"
	}
} else {
	Write-Host "`n[1] Apenas compile-web (SkipFullCompile) ..." -ForegroundColor Cyan
	npm run compile-web
	if ($LASTEXITCODE -ne 0) { throw "compile-web falhou" }
	Invoke-PrincyDeployScript -ScriptPath (Join-Path $PSScriptRoot "sync-princy-ai-out-extensions.ps1") -ScriptArgs @{ ProjectRoot = $ProjectRoot } | Out-Null
	$wbJs = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.js"
	if (Test-Path $wbJs) {
		npm run bundle-server-web-out
		if ($LASTEXITCODE -ne 0) { throw "bundle-server-web-out falhou" }
	}
}

$extJs = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"
if (-not (Test-Path $extJs)) {
	throw "Falta $extJs - compile-web nao gerou bundle browser"
}

$markers = @('cursor-agent-2026.05.25-r3', 'cursor-agent-track', 'forceVisualUnlock', 'princyCreate.actions', 'offlineBanner', 'reconnectBackend')
$found = @()
foreach ($m in $markers) {
	if (Select-String -Path $extJs -Pattern $m -Quiet) { $found += $m }
}
Write-Host "`n[2] Verificacao extension.js" -ForegroundColor Cyan
Write-Host "  Marcadores: $($found -join ', ')" -ForegroundColor $(if ($found.Count -ge 2) { 'Green' } else { 'Red' })
if (-not (Select-String -Path $extJs -Pattern 'cursor-agent-2026.05.25-r3' -Quiet)) {
	throw "extension.js sem revisao cursor-agent-2026.05.25-r3. Compile falhou ou codigo desatualizado (git pull)."
}
if ($found.Count -lt 2) {
	throw "extension.js parece ANTIGO (sem visual premium). Rode sem -SkipFullCompile."
}

Invoke-PrincyDeployScript -ScriptPath (Join-Path $PSScriptRoot "sync-princy-ai-out-extensions.ps1") -ScriptArgs @{ ProjectRoot = $ProjectRoot } | Out-Null

if (Test-Path $productionSettings) {
	Copy-Item $productionSettings $userSettings -Force
}

if (-not $SkipRestart) {
	Write-Host "`n[3] Reiniciar servico Code Web ..." -ForegroundColor Cyan
	Invoke-PrincyDeployScript -ScriptPath (Join-Path $PSScriptRoot "fix-princy-code-web-service.ps1") -ScriptArgs @{ ProjectRoot = $ProjectRoot } | Out-Null
	Start-Sleep -Seconds 5
}

Write-Host "`n=== Concluido ===" -ForegroundColor Green
Write-Host "  1. Abra o webeditor com Ctrl+F5 (hard refresh)" -ForegroundColor Cyan
Write-Host "  2. F1 -> Reset Princy Layout se o chat ainda estiver maximizado" -ForegroundColor Cyan
Write-Host "  3. DevTools painel chat: document.body.dataset.princyUiRev = cursor-agent-2026.05.25-r3" -ForegroundColor DarkGray
