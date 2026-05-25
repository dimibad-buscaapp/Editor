# Repara chat Princy no webeditor + visual r8 + erros VSDA (OSS sem pacote vsda).
# Admin VPS:
#   pwsh -ExecutionPolicy Bypass -File deploy\windows\code-web\fix-princy-editor-chat-visual-vsda.ps1 -ProjectRoot C:\Apps\Editor

param(
	[string]$ProjectRoot = "C:\Apps\Editor"
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

Write-Host "=== Fix editor: chat + visual + VSDA ===" -ForegroundColor Magenta
Write-Host @"
VSDA: em Code-OSS o pacote Microsoft vsda (wasm) normalmente NAO existe.
      Erros 'vsda_bg.wasm not found' sao esperados e nao bloqueiam o editor com --without-connection-token.
      Este deploy aplica fallback no browser e suprime 404 ruidosos no servidor.
"@ -ForegroundColor DarkGray
Write-Host ""

$agora = Join-Path $PSScriptRoot "fix-princy-editor-agora.ps1"
if (-not (Test-Path $agora)) {
	Write-Host "Script fix-princy-editor-agora.ps1 nao encontrado nesta pasta." -ForegroundColor Red
	Write-Host "Faca git pull origin main (no PC de dev: git push primeiro) ou use:" -ForegroundColor Yellow
	Write-Host "  pwsh -File deploy\windows\code-web\fix-princy-editor-agora.ps1 -ProjectRoot $ProjectRoot" -ForegroundColor Cyan
	exit 1
}

& pwsh -NoProfile -ExecutionPolicy Bypass -File $agora -ProjectRoot $ProjectRoot
if ($LASTEXITCODE -ne 0) {
	exit $LASTEXITCODE
}

Write-Host ""
Write-Host "=== VSDA (pos-deploy) ===" -ForegroundColor Cyan
$vsdaWasm = Join-Path $ProjectRoot "node_modules\vsda\rust\web\vsda_bg.wasm"
if (Test-Path $vsdaWasm) {
	Write-Host "  node_modules\vsda: presente (signing nativo)" -ForegroundColor Green
} else {
	Write-Host "  node_modules\vsda: ausente — OK para Princy OSS (fallback ativo)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Browser: https://princyai.com/webeditor/ + Ctrl+F5" -ForegroundColor Green
Write-Host "Chat: F1 -> Princy Ai: Focus Chat — endpoint /princy-api (nao :3210)" -ForegroundColor Green
Write-Host "Visual: document.body.dataset.princyUiRev no painel chat" -ForegroundColor Green
