# Compila extensao princy-ai para browser (webview chat no webeditor).
# Para deploy completo use: compile-princy-chat-only.ps1
# powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\ensure-princy-ai-web.ps1 -FullDeploy

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$FullDeploy
)

$chatOnly = Join-Path $PSScriptRoot "compile-princy-chat-only.ps1"
if ($FullDeploy -and (Test-Path $chatOnly)) {
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $chatOnly -ProjectRoot $ProjectRoot -SkipGitPull
	exit $LASTEXITCODE
}

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot
$env:NODE_OPTIONS = "--max-old-space-size=8192"

Write-Host "=== compile-web (princy-ai browser) ===" -ForegroundColor Cyan
npm run compile-web
if ($LASTEXITCODE -ne 0) { throw "compile-web falhou" }

$extJs = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"
if (-not (Test-Path $extJs)) {
	throw "Ausente: extensions\princy-ai\dist\browser\extension.js"
}
Write-Host "OK: $extJs" -ForegroundColor Green
Write-Host "Proximo: pwsh -File deploy\windows\code-web\compile-princy-chat-only.ps1 -SkipGitPull" -ForegroundColor DarkGray
