# Corrige visual + chat de uma vez: compile, sem cache, redirect /webeditor -> /webeditor-live, reinicia tudo.
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

Write-Host "`n[Caddy] redirect /webeditor -> /webeditor-live ..." -ForegroundColor Cyan
$caddySrc = Join-Path $PSScriptRoot "Caddyfile"
if (Test-Path $caddySrc) {
	Copy-Item $caddySrc "C:\Caddy\Caddyfile" -Force
	Restart-Service PrincyCaddy -Force -ErrorAction SilentlyContinue
}

& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "install-princy-live-routes.ps1") -ProjectRoot $ProjectRoot

Write-Host ""
Write-Host "=== CHECKLIST NO BROWSER ===" -ForegroundColor Yellow
Write-Host "1. https://princyai.com/webeditor/  -> deve REDIRECIONAR para /webeditor-live/" -ForegroundColor Cyan
Write-Host "2. Faixa VERDE no rodape com texto '$RevMarker' (se nao aparecer = cache antigo)" -ForegroundColor Cyan
Write-Host "3. https://princyai.com/princy-chat-live/ -> Backend OK + enviar mensagem" -ForegroundColor Cyan
Write-Host "4. Painel direito: icone Chat (sparkle) — NAO o chat azul do VS Code" -ForegroundColor Cyan
Write-Host "5. Console do painel chat: document.body.dataset.princyUiRev = '$RevMarker'" -ForegroundColor Cyan
