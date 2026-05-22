# Reinstala PrincyAiCodeWeb com node.exe direto no NSSM (sem PowerShell - evita crash/parse).
# Execute como Administrador.

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$WorkspacePath = "C:\Apps\Editor\workspaces\default",
	[string]$ServiceName = "PrincyAiCodeWeb",
	[int]$Port = 3200,
	[string]$ServerBasePath = "/webeditor"
)

$ErrorActionPreference = "Stop"

function Get-NssmPath {
	$cmd = Get-Command nssm.exe -ErrorAction SilentlyContinue
	if ($cmd) { return $cmd.Source }
	foreach ($path in @(
		"${env:ProgramFiles}\nssm\nssm.exe",
		"${env:ProgramFiles(x86)}\nssm\nssm.exe",
		"C:\Tools\nssm\nssm.exe"
	)) {
		if (Test-Path $path) { return $path }
	}
	throw "nssm.exe nao encontrado. winget install NSSM.NSSM"
}

function Resolve-NodeExe {
	$cmd = Get-Command node.exe -ErrorAction SilentlyContinue
	if ($cmd) { return $cmd.Source }
	foreach ($candidate in @(
		"$env:ProgramFiles\nodejs\node.exe",
		"${env:ProgramFiles(x86)}\nodejs\node.exe"
	)) {
		if (Test-Path $candidate) { return $candidate }
	}
	throw "node.exe nao encontrado."
}

function Stop-PortListener {
	param([int]$ListenPort)
	$lines = netstat -ano | Select-String "LISTENING" | Select-String ":$ListenPort "
	foreach ($line in $lines) {
		$pid = ($line.ToString() -split '\s+')[-1]
		if ($pid -match '^\d+$') {
			Write-Host "Liberando porta $ListenPort (PID $pid) ..."
			Stop-Process -Id ([int]$pid) -Force -ErrorAction SilentlyContinue
		}
	}
	Start-Sleep -Seconds 2
}

Write-Host "=== Fix PrincyAiCodeWeb (node direto) ===" -ForegroundColor Cyan

$serverMain = Join-Path $ProjectRoot "out\server-main.js"
$workbenchDev = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench-dev.html"
$workbenchHtml = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.html"
. (Join-Path $PSScriptRoot "Princy-CodeWeb-Build.ps1")
$logsDir = Join-Path $ProjectRoot "logs"

$hasProd = Test-PrincyCodeWebProdBuild -ProjectRoot $ProjectRoot

if (-not (Test-Path $serverMain)) {
	Write-Host "ERRO: falta out\server-main.js (compile ou bundle incompleto)." -ForegroundColor Red
	Write-Host '  cd C:\Apps\Editor; $env:NODE_OPTIONS="--max-old-space-size=8192"; $env:VSCODE_SKIP_PRELAUNCH="1"' -ForegroundColor Yellow
	Write-Host "  npm run compile-incremental" -ForegroundColor Yellow
	Write-Host "  npm run bundle-server-web-out" -ForegroundColor Yellow
	Write-Host "  npm run compile-web" -ForegroundColor Yellow
	exit 1
}
if (-not $hasProd -and -not (Test-Path $workbenchDev)) {
	Write-Host "ERRO: falta bundle PROD (workbench.html + css + js) ou workbench-dev.html." -ForegroundColor Red
	Write-Host "  Rode: deploy\windows\code-web\compile-princy-code-web-production.ps1" -ForegroundColor Yellow
	exit 1
}
if ($hasProd) {
	Write-Host "Compile PRODUCAO: OK (workbench.html + bundle)" -ForegroundColor Green
} else {
	Write-Host "AVISO: falta compile PRODUCAO - o editor pode ficar lento/travado em modo DEV." -ForegroundColor Yellow
	Write-Host "  Rode: deploy\windows\code-web\compile-princy-code-web-production.ps1" -ForegroundColor Yellow
}

New-Item -ItemType Directory -Force $WorkspacePath | Out-Null
New-Item -ItemType Directory -Force $logsDir | Out-Null

$userDataDir = Join-Path $ProjectRoot ".princy-user-data"
New-Item -ItemType Directory -Force (Join-Path $userDataDir "User") | Out-Null
$productionSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
if (Test-Path $productionSettings) {
	Copy-Item $productionSettings (Join-Path $userDataDir "User\settings.json") -Force
}

$base = $ServerBasePath.Trim()
if (-not $base.StartsWith('/')) { $base = "/$base" }

$nssm = Get-NssmPath
$nodeExe = Resolve-NodeExe

$existing = Get-Service $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
	if ($existing.Status -eq 'Running') {
		Stop-Service $ServiceName -Force -ErrorAction SilentlyContinue
		Start-Sleep -Seconds 2
	}
	if ($existing.Status -eq 'Paused') {
		Write-Host "Servico $ServiceName PAUSED - removendo instalacao NSSM ..." -ForegroundColor Yellow
	}
	$null = & $nssm stop $ServiceName confirm 2>&1
	$null = & $nssm remove $ServiceName confirm 2>&1
	Start-Sleep -Seconds 3
}
Stop-PortListener -ListenPort $Port

$serverMainAbs = $serverMain
$appParams = @(
	$serverMainAbs,
	$WorkspacePath,
	'--host', '0.0.0.0',
	'--port', "$Port",
	'--without-connection-token',
	'--disable-workspace-trust',
	'--user-data-dir', $userDataDir,
	'--server-base-path', $base
)
$appParamsLine = ($appParams | ForEach-Object {
	if ($_ -match '\s') { "`"$_`"" } else { $_ }
}) -join ' '

Write-Host "Node: $nodeExe"
Write-Host "Args: $appParamsLine"
Write-Host "AppDirectory: $ProjectRoot"

& $nssm install $ServiceName $nodeExe
& $nssm set $ServiceName AppParameters $appParamsLine
& $nssm set $ServiceName AppDirectory $ProjectRoot
& $nssm set $ServiceName AppStdout (Join-Path $logsDir "code-web.out.log")
& $nssm set $ServiceName AppStderr (Join-Path $logsDir "code-web.err.log")
& $nssm set $ServiceName Start SERVICE_AUTO_START
& $nssm set $ServiceName AppRestartDelay 10000
& $nssm set $ServiceName AppThrottle 30000
& $nssm set $ServiceName AppExit Default Restart

# Producao: NAO definir VSCODE_DEV nem NODE_ENV=development
$envExtra = @(
	"VSCODE_SKIP_PRELAUNCH=1",
	"NODE_OPTIONS=--max-old-space-size=8192"
)
if (-not $hasProd) {
	Write-Host "Modo DEV forcado (sem bundle prod) - adicionando VSCODE_DEV=1" -ForegroundColor Yellow
	$envExtra += "VSCODE_DEV=1", "NODE_ENV=development"
}
& $nssm set $ServiceName AppEnvironmentExtra $envExtra

if (Test-Path (Join-Path $logsDir "code-web.err.log")) {
	Write-Host "`n--- code-web.err.log (ultimas 15 linhas antes do restart) ---" -ForegroundColor DarkYellow
	Get-Content (Join-Path $logsDir "code-web.err.log") -Tail 15 -ErrorAction SilentlyContinue
}

Write-Host "`nIniciando $ServiceName ..." -ForegroundColor Cyan
Start-Service $ServiceName
Start-Sleep -Seconds 8

$after = Get-Service $ServiceName
Write-Host "Status: $($after.Status)" -ForegroundColor $(if ($after.Status -eq 'Running') { 'Green' } else { 'Red' })

if ($after.Status -ne 'Running') {
	Write-Host "Servico nao ficou Running. Teste manual:" -ForegroundColor Yellow
	Write-Host "  cd $ProjectRoot"
	Write-Host "  node $appParamsLine"
	Get-Content (Join-Path $logsDir "code-web.err.log") -Tail 30 -ErrorAction SilentlyContinue
	exit 1
}

$line = Select-String -Path (Join-Path $logsDir "code-web.out.log") -Pattern "Web UI available" -ErrorAction SilentlyContinue | Select-Object -Last 1
if ($line) {
	Write-Host $line.Line.Trim() -ForegroundColor Green
	if ($line.Line -notmatch [regex]::Escape($base)) {
		Write-Host "AVISO: log sem server-base-path $base" -ForegroundColor Yellow
	}
}

try {
	$r = Invoke-WebRequest "http://127.0.0.1:$Port$base/" -UseBasicParsing -TimeoutSec 25
	$wb = $r.Content -match 'WORKBENCH_WEB_CONFIGURATION'
	Write-Host "HTTP 127.0.0.1:$Port$base/ -> $($r.StatusCode) workbench=$wb ($($r.Content.Length) bytes)" -ForegroundColor $(if ($wb) { 'Green' } else { 'Yellow' })
}
catch {
	Write-Host "HTTP local falhou: $($_.Exception.Message)" -ForegroundColor Red
	exit 1
}

Write-Host ""
Write-Host "OK - https://princyai.com$base/ (Ctrl+F5; nao use IP:3200 na internet)" -ForegroundColor Green
