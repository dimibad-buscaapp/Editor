# Corrige pagina branca com JSON do package.json visivel (workbench.html corrompido).
# Admin VPS:
#   pwsh -ExecutionPolicy Bypass -File deploy\windows\code-web\fix-workbench-html-corruption.ps1 -ProjectRoot C:\Apps\Editor

param([string]$ProjectRoot = "C:\Apps\Editor")

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

Write-Host "=== Fix workbench.html corrompido (JSON visivel) ===" -ForegroundColor Magenta

$restore = Join-Path $PSScriptRoot "restore-workbench-html-placeholder.ps1"
& pwsh -NoProfile -ExecutionPolicy Bypass -File $restore -ProjectRoot $ProjectRoot

$sync = Join-Path $PSScriptRoot "sync-princy-ai-out-extensions.ps1"
if (Test-Path (Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js")) {
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $sync -ProjectRoot $ProjectRoot
}

Write-Host "`nReiniciar PrincyAiCodeWeb ..." -ForegroundColor Cyan
Restart-Service PrincyAiCodeWeb -Force -ErrorAction Stop
Start-Sleep -Seconds 6

$html = (Invoke-WebRequest "http://127.0.0.1:3200/webeditor/" -UseBasicParsing -TimeoutSec 20).Content
if ($html -match '<body[^>]*>([\s\S]*?)</body>' -and $Matches[1] -match 'princyai\.|extensionPath') {
	throw "HTML ainda corrompido apos restore — rode fix-webeditor-blank-page.ps1 (rebuild PROD)"
}
if ($html -notmatch 'vscode-workbench-web-configuration') {
	throw "HTML invalido — servico PrincyAiCodeWeb nao responde workbench"
}

Write-Host ""
Write-Host "OK. Browser: Ctrl+Shift+Delete + Ctrl+F5 em https://princyai.com/webeditor/" -ForegroundColor Green
