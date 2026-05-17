param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$ServiceName = "PrincyAiAgentBackend",
	[int]$Port = 3210
)

$ErrorActionPreference = "Stop"

$nssm = Get-Command nssm.exe -ErrorAction SilentlyContinue
if (-not $nssm) {
	throw "nssm.exe was not found in PATH. Install NSSM or run start-princy-agent-backend.ps1 manually."
}

$runner = Join-Path $ProjectRoot "deploy\windows\agent-backend\start-princy-agent-backend.ps1"
if (-not (Test-Path $runner)) {
	throw "Runner script not found at $runner"
}

New-Item -ItemType Directory -Force (Join-Path $ProjectRoot "logs") | Out-Null

nssm install $ServiceName "powershell.exe" "-NoProfile -ExecutionPolicy Bypass -File `"$runner`" -ProjectRoot `"$ProjectRoot`" -Port $Port"
nssm set $ServiceName AppDirectory (Join-Path $ProjectRoot "apps\ai-dashboard")
nssm set $ServiceName AppStdout (Join-Path $ProjectRoot "logs\agent-backend.out.log")
nssm set $ServiceName AppStderr (Join-Path $ProjectRoot "logs\agent-backend.err.log")
nssm set $ServiceName Start SERVICE_AUTO_START

Write-Host "Installed $ServiceName. Start it with:"
Write-Host "Start-Service $ServiceName"
