param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$WorkspacePath = "C:\Apps\Editor\workspaces\default",
	[string]$HostName = "127.0.0.1",
	[int]$Port = 3200
)

$ErrorActionPreference = "Stop"

Set-Location $ProjectRoot
New-Item -ItemType Directory -Force $WorkspacePath | Out-Null

$scriptPath = Join-Path $ProjectRoot "scripts\code-server.bat"
if (-not (Test-Path $scriptPath)) {
	throw "Code Server script not found at $scriptPath"
}

Write-Host "Starting Princy Ai Code-OSS Web"
Write-Host "Project: $ProjectRoot"
Write-Host "Workspace: $WorkspacePath"
Write-Host "URL: http://$HostName`:$Port"

& $scriptPath $WorkspacePath --host $HostName --port $Port --without-connection-token
