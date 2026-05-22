param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$WorkspacePath = "C:\Apps\Editor\workspaces\default",
	[string]$ServiceName = "PrincyAiCodeWeb",
	[int]$Port = 3200
)

$ErrorActionPreference = "Stop"

$nssm = Get-Command nssm.exe -ErrorAction SilentlyContinue
if (-not $nssm) {
	throw "nssm.exe was not found in PATH. Install NSSM or run start-princy-code-web.ps1 manually."
}

$runner = Join-Path $ProjectRoot "deploy\windows\code-web\run-princy-code-web.ps1"
if (-not (Test-Path $runner)) {
	throw "Runner script not found at $runner"
}

New-Item -ItemType Directory -Force (Join-Path $ProjectRoot "logs") | Out-Null
New-Item -ItemType Directory -Force $WorkspacePath | Out-Null

Write-Host "Use fix-princy-code-web-service.ps1 (node.exe direto no NSSM)." -ForegroundColor Cyan
$fix = Join-Path $ProjectRoot "deploy\windows\code-web\fix-princy-code-web-service.ps1"
& powershell -ExecutionPolicy Bypass -File $fix -ProjectRoot $ProjectRoot -WorkspacePath $WorkspacePath -Port $Port
