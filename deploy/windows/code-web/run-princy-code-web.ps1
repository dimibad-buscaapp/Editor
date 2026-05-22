param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$WorkspacePath = "C:\Apps\Editor\workspaces\default",
	[string]$HostName = "0.0.0.0",
	[int]$Port = 3200,
	[string]$UserDataDir = "",
	[string]$ServerBasePath = "/webeditor",
	[switch]$Dev
)

$ErrorActionPreference = "Stop"

Set-Location $ProjectRoot

$serverMain = Join-Path $ProjectRoot "out\server-main.js"
$workbenchDevHtml = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench-dev.html"
$nodeExe = (Get-Command node.exe -ErrorAction Stop).Source

if (-not (Test-Path $serverMain) -or -not (Test-Path $workbenchDevHtml)) {
	Write-Host "Compile ausente. Rode start-princy-code-web.ps1 uma vez antes do servico."
	exit 1
}

$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:VSCODE_SKIP_PRELAUNCH = "1"
if ($Dev) {
	$env:NODE_ENV = "development"
	$env:VSCODE_DEV = "1"
	Write-Host "Modo DEV (workbench-dev.html) — nao use em producao publica." -ForegroundColor Yellow
} else {
	Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
	Remove-Item Env:VSCODE_DEV -ErrorAction SilentlyContinue
	Write-Host "Modo PRODUCAO (workbench.html, mais estavel no /webeditor)." -ForegroundColor Green
}

New-Item -ItemType Directory -Force $WorkspacePath | Out-Null
if (-not $UserDataDir) {
	$UserDataDir = Join-Path $ProjectRoot ".princy-user-data"
}
New-Item -ItemType Directory -Force $UserDataDir | Out-Null

$productionSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
$userSettingsDir = Join-Path $UserDataDir "User"
$userSettingsFile = Join-Path $userSettingsDir "settings.json"
if (Test-Path $productionSettings) {
	New-Item -ItemType Directory -Force $userSettingsDir | Out-Null
	Copy-Item $productionSettings $userSettingsFile -Force
	Write-Host "Settings: $userSettingsFile (from princy-production.settings.json)"
}

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

$serverArgs = @(
	$WorkspacePath
	'--host', $HostName
	'--port', $Port
	'--without-connection-token'
	'--disable-workspace-trust'
	'--user-data-dir', $UserDataDir
)
if ($ServerBasePath) {
	$base = $ServerBasePath.Trim()
	if (-not $base.StartsWith('/')) { $base = "/$base" }
	$serverArgs += '--server-base-path', $base
}

Write-Host "Starting: $nodeExe $serverMain $($serverArgs -join ' ')"
& $nodeExe $serverMain @serverArgs
exit $LASTEXITCODE
