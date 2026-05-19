param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$WorkspacePath = "C:\Apps\Editor\workspaces\default",
	[string]$HostName = "127.0.0.1",
	[int]$Port = 3200,
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
$princyBrowserExtension = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"

$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:VSCODE_SKIP_PRELAUNCH = "1"

Write-Host "Starting Princy Ai Code-OSS Web"
Write-Host "Project: $ProjectRoot"
Write-Host "Workspace: $WorkspacePath"
Write-Host "URL: http://$HostName`:$Port"

if ($Rebuild -and (Test-Path (Join-Path $ProjectRoot "out"))) {
	Write-Host "Rebuild requested: removing incomplete out folder"
	Remove-Item -Recurse -Force (Join-Path $ProjectRoot "out")
}

if (-not (Test-Path $serverMain)) {
	Write-Host "out\server-main.js not found. Compiling Code-OSS core (first run can take 20-40 minutes) ..."
	Invoke-NpmTask -TaskName "compile"
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

Write-Host "Using server entry: $serverMain"
& $scriptPath $WorkspacePath --host $HostName --port $Port --without-connection-token --disable-extension GitHub.copilot-chat --disable-extension GitHub.copilot
