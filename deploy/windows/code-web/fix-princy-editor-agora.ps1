# Corrige visual + chat: compile, sem cache agressivo, reinicia servicos (URL principal /webeditor/).
# VPS Admin:
#   pwsh -ExecutionPolicy Bypass -File deploy\windows\code-web\fix-princy-editor-agora.ps1 -ProjectRoot C:\Apps\Editor

param(
	[string]$ProjectRoot = "C:\Apps\Editor"
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

. (Join-Path $PSScriptRoot "Princy-CodeWeb-Build.ps1")
. (Join-Path $PSScriptRoot "..\princy-ui-revision.ps1")

$RevMarker = Get-PrincyUiRevision
Write-Host "=== Fix Princy Editor AGORA (rev $RevMarker) ===" -ForegroundColor Magenta

& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "fix-princy-browser-cache.ps1") -ProjectRoot $ProjectRoot

Write-Host "`n[Caddy] restaurar rota /webeditor/ (porta 3200) ..." -ForegroundColor Cyan
$caddySrc = Join-Path $PSScriptRoot "Caddyfile"
if (Test-Path $caddySrc) {
	Copy-Item $caddySrc "C:\Caddy\Caddyfile" -Force
	Restart-Service PrincyCaddy -Force -ErrorAction SilentlyContinue
}

& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "install-princy-live-routes.ps1") -ProjectRoot $ProjectRoot

Write-Host ""
Write-Host "=== CHECKLIST NO BROWSER ===" -ForegroundColor Yellow
Write-Host "1. https://princyai.com/webeditor/  (URL principal, sem redirect)" -ForegroundColor Cyan
Write-Host "2. https://princyai.com/princy-chat-live/ -> Backend OK + enviar mensagem" -ForegroundColor Cyan
Write-Host "3. Painel direito: icone Chat (sparkle) — NAO o chat azul do VS Code" -ForegroundColor Cyan
Write-Host "4. Console do painel chat: document.body.dataset.princyUiRev = '$RevMarker'" -ForegroundColor Cyan
Write-Host "5. Ctrl+Shift+Delete + Ctrl+F5 se visual antigo" -ForegroundColor Cyan
