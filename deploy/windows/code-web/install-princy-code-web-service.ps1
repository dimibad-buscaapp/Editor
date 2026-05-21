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

nssm install $ServiceName "powershell.exe" "-NoProfile -ExecutionPolicy Bypass -File `"$runner`" -ProjectRoot `"$ProjectRoot`" -WorkspacePath `"$WorkspacePath`" -HostName 127.0.0.1 -Port $Port"
nssm set $ServiceName AppDirectory $ProjectRoot
nssm set $ServiceName AppStdout (Join-Path $ProjectRoot "logs\code-web.out.log")
nssm set $ServiceName AppStderr (Join-Path $ProjectRoot "logs\code-web.err.log")
nssm set $ServiceName Start SERVICE_AUTO_START
nssm set $ServiceName AppRestartDelay 5000
nssm set $ServiceName AppExit Default Restart

Write-Host "Compile first: start-princy-code-web.ps1 until out\server-main.js exists"
Write-Host "Installed $ServiceName. Start it with:"
Write-Host "Start-Service $ServiceName"
