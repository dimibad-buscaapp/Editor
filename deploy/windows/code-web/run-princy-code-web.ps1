param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$WorkspacePath = "C:\Apps\Editor\workspaces\default",
	[string]$HostName = "127.0.0.1",
	[int]$Port = 3200,
	[string]$UserDataDir = ""
)

$ErrorActionPreference = "Stop"

Set-Location $ProjectRoot

$scriptPath = Join-Path $ProjectRoot "scripts\code-server.bat"
$serverMain = Join-Path $ProjectRoot "out\server-main.js"
$workbenchDevHtml = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench-dev.html"

if (-not (Test-Path $scriptPath)) {
	throw "Code Server script not found at $scriptPath"
}
if (-not (Test-Path $serverMain) -or -not (Test-Path $workbenchDevHtml)) {
	Write-Host "Compile ausente. Rode start-princy-code-web.ps1 uma vez antes do servico."
	exit 1
}

$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:VSCODE_SKIP_PRELAUNCH = "1"

New-Item -ItemType Directory -Force $WorkspacePath | Out-Null
if (-not $UserDataDir) {
	$UserDataDir = Join-Path $ProjectRoot ".princy-user-data"
}
New-Item -ItemType Directory -Force $UserDataDir | Out-Null

$disabledExtensions = @(
	'GitHub.copilot',
	'GitHub.copilot-chat',
	'GitHub.vscode-pull-request-github',
	'vscode.github-authentication',
	'vscode.microsoft-authentication',
	'vscode.vscode-api-tests'
)
$extensionArgs = foreach ($ext in $disabledExtensions) { '--disable-extension'; $ext }

Write-Host "Princy Code Web (run) http://${HostName}:$Port"

& $scriptPath @(
	$WorkspacePath
	'--host', $HostName
	'--port', $Port
	'--without-connection-token'
	'--disable-workspace-trust'
	'--user-data-dir', $UserDataDir
) + $extensionArgs
