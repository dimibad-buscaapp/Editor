# Corrige chat offline + visual r9: settings HTTPS, compile browser, PROD, sem VSCODE_DEV.
# Admin VPS:
#   pwsh -File deploy\windows\code-web\fix-princy-chat-visual-unlock.ps1 -ProjectRoot C:\Apps\Editor

param(
	[string]$ProjectRoot = "C:\Apps\Editor"
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

. (Join-Path $PSScriptRoot "..\princy-ui-revision.ps1")
$Rev = Get-PrincyUiRevision

Write-Host "=== Fix chat + visual desbloqueado (rev $Rev) ===" -ForegroundColor Magenta
Write-Host "Corrige: visual unlock que repunha /princy-api relativo (chat offline falso).`n" -ForegroundColor Yellow

# Settings producao (endpoint HTTPS absoluto)
$prod = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
$userDir = Join-Path $ProjectRoot ".princy-user-data\User"
$userSettings = Join-Path $userDir "settings.json"
if (Test-Path $prod) {
	New-Item -ItemType Directory -Force $userDir | Out-Null
	Copy-Item $prod $userSettings -Force
	Write-Host "OK: settings producao (agentEndpoint HTTPS)" -ForegroundColor Green
}

# Proxy + agent
$proxyTest = Join-Path $PSScriptRoot "test-princy-3200-3210-proxy.ps1"
if (Test-Path $proxyTest) {
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $proxyTest -ProjectRoot $ProjectRoot
}

$repair = Join-Path $PSScriptRoot "..\agent-backend\repair-princy-agent-3210.ps1"
if (Test-Path $repair) {
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $repair -ProjectRoot $ProjectRoot -SkipRestartCodeWeb
}

# Compile extensao + workbench PROD
$agora = Join-Path $PSScriptRoot "fix-princy-editor-agora.ps1"
if (Test-Path $agora) {
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $agora -ProjectRoot $ProjectRoot -FixSettings
} else {
	throw "Ausente fix-princy-editor-agora.ps1"
}

Write-Host ""
Write-Host "=== Checklist browser ===" -ForegroundColor Cyan
Write-Host "1. Ctrl+Shift+Delete cache + Ctrl+F5 em https://princyai.com/webeditor/"
Write-Host "2. Abrir chat (barra direita) — bolinha verde = online"
Write-Host "3. DevTools no painel chat: document.body.dataset.princyUiRev = $Rev"
Write-Host "4. F1 -> Princy Ai: Force Visual Reload se CSS antigo"
Write-Host "5. Endpoint no banner: https://princyai.com/princy-api (nao :3210)"
