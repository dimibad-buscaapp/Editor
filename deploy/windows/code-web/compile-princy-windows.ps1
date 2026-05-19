param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$Full,
	[switch]$Watch
)

$ErrorActionPreference = "Stop"

function Stop-PortListeners {
	param([int]$Port)

	Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
		ForEach-Object {
			Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
		}
}

Set-Location $ProjectRoot
$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:VSCODE_SKIP_PRELAUNCH = "1"

Write-Host "Stopping listeners on ports 3200 and 3210 (Code Web + agent backend) ..."
Stop-PortListeners -Port 3200
Stop-PortListeners -Port 3210

if ($Watch) {
	Write-Host "Starting incremental watch (does not delete out/) ..."
	Write-Host "Leave this window open until compile finishes, then run start-princy-code-web.ps1 in another session."
	npm run watch
	exit $LASTEXITCODE
}

if ($Full) {
	Write-Host "Full compile: will try to delete out/ (stop antivirus locking if EBUSY persists)."
	Remove-Item Env:PRINCY_SKIP_GULP_CLEAN -ErrorAction SilentlyContinue
	Remove-Item Env:VSCODE_SKIP_GULP_CLEAN -ErrorAction SilentlyContinue
	npm run compile
} else {
	Write-Host "Incremental compile: skipping delete of out/ (recommended on Windows VPS)."
	$env:PRINCY_SKIP_GULP_CLEAN = "1"
	npm run compile-incremental
}

if ($LASTEXITCODE -ne 0) {
	throw "Compile failed with exit code $LASTEXITCODE"
}

if (-not (Test-Path ".\out\server-main.js")) {
	throw "Compile finished but out\server-main.js is still missing."
}

Write-Host "Core compile OK: out\server-main.js exists."
Write-Host "Next: npm run compile-web (if Princy extension web bundle is missing)"
