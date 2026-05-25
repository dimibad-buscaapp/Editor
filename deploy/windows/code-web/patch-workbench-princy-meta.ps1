# Prepara princy-ai para Code Web: sync out/extensions + restaura placeholders no HTML.
# NAO grava package.json no HTML (o patch antigo corrompia o atributo data-settings por causa de '>' em textos).
#
# powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\patch-workbench-princy-meta.ps1

param([string]$ProjectRoot = "C:\Apps\Editor")

$ErrorActionPreference = "Stop"

$extJs = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"
if (-not (Test-Path $extJs)) {
	throw "Compile a extensao primeiro: npm run compile-web"
}

& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "sync-princy-ai-out-extensions.ps1") -ProjectRoot $ProjectRoot

$restore = Join-Path $PSScriptRoot "restore-workbench-html-placeholder.ps1"
& pwsh -NoProfile -ExecutionPolicy Bypass -File $restore -ProjectRoot $ProjectRoot

Write-Host "OK: princy-ai sincronizado; HTML com {{WORKBENCH_BUILTIN_EXTENSIONS}} (servidor injeta meta)" -ForegroundColor Green
