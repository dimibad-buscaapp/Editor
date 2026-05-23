# Copia extensions/princy-ai -> out/extensions/princy-ai (browser carrega builtin via vs/../../extensions).
# powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\sync-princy-ai-out-extensions.ps1

param([string]$ProjectRoot = "C:\Apps\Editor")

$ErrorActionPreference = "Stop"

$src = Join-Path $ProjectRoot "extensions\princy-ai"
$extJs = Join-Path $src "dist\browser\extension.js"
$dest = Join-Path $ProjectRoot "out\extensions\princy-ai"

if (-not (Test-Path $extJs)) {
	throw "Ausente: $extJs - rode npm run compile-web"
}

if (Test-Path $dest) {
	Remove-Item $dest -Recurse -Force
}
New-Item -ItemType Directory -Force (Split-Path $dest -Parent) | Out-Null
Copy-Item $src $dest -Recurse -Force

Write-Host "OK: princy-ai em out/extensions (browser)" -ForegroundColor Green
Write-Host "  $dest" -ForegroundColor DarkGray
