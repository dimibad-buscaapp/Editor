# Reinicia PrincyAiCodeWeb sem conflito na porta 3200. Execute como Administrador.
param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[int]$Port = 3200
)

$ErrorActionPreference = "Continue"
Write-Host "=== Restart Princy Code Web (limpo) ===" -ForegroundColor Cyan

Stop-Service PrincyAiCodeWeb -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$stopScript = Join-Path $ProjectRoot "deploy\windows\code-web\Stop-CodeWebPort.ps1"
if (Test-Path $stopScript) {
	& powershell -ExecutionPolicy Bypass -File $stopScript -Port $Port
}

$settingsSrc = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
$userDir = Join-Path $ProjectRoot ".princy-user-data\User"
$userSettings = Join-Path $userDir "settings.json"
if (Test-Path $settingsSrc) {
	New-Item -ItemType Directory -Force $userDir | Out-Null
	Copy-Item $settingsSrc $userSettings -Force
	Write-Host "Settings OK: $userSettings" -ForegroundColor Green
}

Start-Service PrincyAiCodeWeb
Start-Sleep -Seconds 8

$svc = Get-Service PrincyAiCodeWeb
Write-Host "PrincyAiCodeWeb: $($svc.Status)" -ForegroundColor $(if ($svc.Status -eq 'Running') { 'Green' } else { 'Red' })

if (Test-Path (Join-Path $ProjectRoot "logs\code-web.out.log")) {
	Get-Content (Join-Path $ProjectRoot "logs\code-web.out.log") -Tail 6
}

if ($svc.Status -ne 'Running') {
	Write-Host "Teste manual:" -ForegroundColor Yellow
	Write-Host "  powershell -File $ProjectRoot\deploy\windows\code-web\run-princy-code-web.ps1"
	exit 1
}

Write-Host "OK - https://princyai.com/webeditor/" -ForegroundColor Green
