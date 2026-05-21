param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$WorkspacePath = "C:\Apps\Editor\workspaces\default",
	[string]$HostName = "127.0.0.1",
	[int]$Port = 3200,
	[string]$UserDataDir = "",
	[string]$ServerBasePath = "",
	[switch]$Rebuild
)

$ErrorActionPreference = "Stop"

function Invoke-NpmTask {
	param(
		[string]$TaskName
	)

	Write-Host "Running npm run $TaskName ..."
	& npm run $TaskName
	if ($LASTEXITCODE -ne 0) {
		throw "npm run $TaskName failed with exit code $LASTEXITCODE"
	}
}

Set-Location $ProjectRoot
New-Item -ItemType Directory -Force $WorkspacePath | Out-Null

$scriptPath = Join-Path $ProjectRoot "scripts\code-server.bat"
if (-not (Test-Path $scriptPath)) {
	throw "Code Server script not found at $scriptPath"
}

$serverMain = Join-Path $ProjectRoot "out\server-main.js"
$workbenchDevHtml = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench-dev.html"
$princyBrowserExtension = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"

$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:VSCODE_SKIP_PRELAUNCH = "1"

Write-Host "Starting Princy Ai Code-OSS Web"
Write-Host "Project: $ProjectRoot"
Write-Host "Workspace: $WorkspacePath"
Write-Host "URL: http://$HostName`:$Port"
Write-Host "Agent API proxy: http://$HostName`:$Port/princy-api -> 127.0.0.1:3210 (start agent backend separately)"

if ($Rebuild -and (Test-Path (Join-Path $ProjectRoot "out"))) {
	Write-Host "Rebuild requested: removing incomplete out folder"
	Remove-Item -Recurse -Force (Join-Path $ProjectRoot "out")
}

if (-not (Test-Path $serverMain) -or -not (Test-Path $workbenchDevHtml)) {
	if (-not (Test-Path $workbenchDevHtml)) {
		Write-Host "VS Code Web UI (workbench) not found at out\vs\code\browser\workbench\workbench-dev.html"
		Write-Host "compile-web only builds extensions - run compile-incremental for the full editor UI."
	}
	Write-Host "Compiling Code-OSS core (first run can take 20-40 minutes) ..."
	Write-Host "Using incremental compile (skips deleting out/ - safer on Windows when EBUSY)."
	$env:PRINCY_SKIP_GULP_CLEAN = "1"
	Invoke-NpmTask -TaskName "compile-incremental"
}

if (-not (Test-Path $serverMain)) {
	throw @"
Compile finished but out\server-main.js was not created.

Try on the VPS:
  cd $ProjectRoot
  Remove-Item -Recurse -Force .\out -ErrorAction SilentlyContinue
  `$env:NODE_OPTIONS = '--max-old-space-size=8192'
  npm run compile

Then confirm:
  Test-Path .\out\server-main.js
"@
}

if (-not (Test-Path $princyBrowserExtension)) {
	Write-Host "Princy Ai web bundle not found. Compiling web extensions ..."
	Invoke-NpmTask -TaskName "compile-web"
}

if (-not (Test-Path $princyBrowserExtension)) {
	Write-Host "Warning: extensions\princy-ai\dist\browser\extension.js still missing after compile-web."
	Write-Host "Princy Ai panel may not activate until compile-web succeeds."
}

if (-not (Test-Path $workbenchDevHtml)) {
	throw @"
VS Code Web UI files are still missing.

Run once on the VPS:
  cd $ProjectRoot
  `$env:PRINCY_SKIP_GULP_CLEAN = '1'
  npm run compile-incremental
  npm run compile-web

Then confirm:
  Test-Path .\out\vs\code\browser\workbench\workbench-dev.html
"@
}

Write-Host "Using server entry: $serverMain"
Write-Host "Workbench UI: $workbenchDevHtml"
Write-Host "Open the URL printed below as 'Web UI available at ...' (full VS Code in the browser)."

# Copilot, GitHub PR and auth extensions slow boot and are unused (Princy webview chat only).
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
Write-Host "Disabled extensions: $($disabledExtensions -join ', ')"
Write-Host "User data dir: $UserDataDir"

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
	Write-Host "Server base path: $base (URL publica: https://princyai.com$base/)"
}

& $scriptPath @serverArgs + $extensionArgs
