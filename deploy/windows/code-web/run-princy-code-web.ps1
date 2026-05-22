param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$WorkspacePath = "C:\Apps\Editor\workspaces\default",
	[string]$HostName = "0.0.0.0",
	[int]$Port = 3200,
	[string]$UserDataDir = "",
	[string]$ServerBasePath = "/webeditor",
	[switch]$Dev,
	[switch]$Production
)

$ErrorActionPreference = "Stop"

Set-Location $ProjectRoot

$serverMain = Join-Path $ProjectRoot "out\server-main.js"
$workbenchDevHtml = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench-dev.html"
$workbenchHtml = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.html"
$nodeExe = (Get-Command node.exe -ErrorAction Stop).Source

if (-not (Test-Path $serverMain) -or -not (Test-Path $workbenchDevHtml)) {
	Write-Host "Compile ausente. Rode: npm run compile-incremental e npm run compile-web"
	exit 1
}

$workbenchCss = Join-Path $ProjectRoot "out\vs\workbench\workbench.web.main.css"
$hasProductionBuild = (Test-Path $workbenchHtml) -and (Test-Path $workbenchCss)

$useDev = $false
if ($Dev) {
	$useDev = $true
} elseif ($Production) {
	if (-not $hasProductionBuild) {
		Write-Host "ERRO: -Production mas falta workbench.html ou workbench.web.main.css" -ForegroundColor Red
		Write-Host "  Rode: deploy\windows\code-web\compile-princy-code-web-production.ps1" -ForegroundColor Yellow
		exit 1
	}
	$useDev = $false
} else {
	# VPS publico: producao quando compile completo (DEV = centenas de modulos, muito lento)
	$useDev = -not $hasProductionBuild
	if ($useDev) {
		Write-Host "AVISO: compile de PRODUCAO incompleto - modo DEV (lento, pode parecer travado)." -ForegroundColor Yellow
		Write-Host "  Rode: deploy\windows\code-web\compile-princy-code-web-production.ps1" -ForegroundColor Yellow
	}
}

$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:VSCODE_SKIP_PRELAUNCH = "1"
if ($useDev) {
	$env:NODE_ENV = "development"
	$env:VSCODE_DEV = "1"
	Write-Host "Modo DEV - workbench-dev.html" -ForegroundColor Yellow
} else {
	Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
	Remove-Item Env:VSCODE_DEV -ErrorAction SilentlyContinue
	Write-Host "Modo PRODUCAO - workbench.html" -ForegroundColor Green
}

New-Item -ItemType Directory -Force $WorkspacePath | Out-Null
if (-not $UserDataDir) {
	$UserDataDir = Join-Path $ProjectRoot ".princy-user-data"
}
New-Item -ItemType Directory -Force $UserDataDir | Out-Null
New-Item -ItemType Directory -Force (Join-Path $UserDataDir "User") | Out-Null

$productionSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
$userSettingsFile = Join-Path $UserDataDir "User\settings.json"
if (Test-Path $productionSettings) {
	Copy-Item $productionSettings $userSettingsFile -Force
	Write-Host "Settings: $userSettingsFile"
}

Write-Host "Princy Code Web http://${HostName}:$Port"

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

Write-Host "Starting node server-main.js ..."
& $nodeExe $serverMain @serverArgs
exit $LASTEXITCODE
