# Instala servicos Windows (NSSM): agent 3210, Code Web 3200, Caddy 80/443
# Execute PowerShell como Administrador.

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$CaddyDir = "C:\Caddy",
	[switch]$SkipBuild
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
	return $null
}

function Install-NssmService {
	param(
		[string]$Nssm,
		[string]$Name,
		[string]$AppDirectory,
		[string]$Runner,
		[string]$RunnerArgs,
		[string]$StdoutLog,
		[string]$StderrLog
	)

	$existing = Get-Service $Name -ErrorAction SilentlyContinue
	if ($existing) {
		Write-Host "Removendo servico existente $Name ..."
		if ($existing.Status -eq 'Running') { Stop-Service $Name -Force }
		& $Nssm remove $Name confirm
		Start-Sleep -Seconds 2
	}

	& $Nssm install $Name "powershell.exe" "-NoProfile -ExecutionPolicy Bypass -File `"$Runner`" $RunnerArgs"
	& $Nssm set $Name AppDirectory $AppDirectory
	& $Nssm set $Name AppStdout $StdoutLog
	& $Nssm set $Name AppStderr $StderrLog
	& $Nssm set $Name Start SERVICE_AUTO_START
	& $Nssm set $Name AppRestartDelay 5000
	& $Nssm set $Name AppExit Default Restart
	& $Nssm set $Name AppThrottle 15000
	Write-Host "Instalado: $Name"
}

$nssm = Get-NssmPath
if (-not $nssm) {
	Write-Host "NSSM nao encontrado. Instale:" -ForegroundColor Yellow
	Write-Host "  winget install NSSM.NSSM"
	exit 1
}

$logsDir = Join-Path $ProjectRoot "logs"
New-Item -ItemType Directory -Force $logsDir | Out-Null
New-Item -ItemType Directory -Force (Join-Path $ProjectRoot "workspaces\default") | Out-Null

if (-not $SkipBuild) {
	Write-Host "=== Build agent backend ===" -ForegroundColor Cyan
	powershell -ExecutionPolicy Bypass -File (Join-Path $ProjectRoot "deploy\windows\agent-backend\build-princy-agent-backend.ps1") -ProjectRoot $ProjectRoot
	Write-Host "=== Verifique compile do Code Web (pode demorar) ===" -ForegroundColor Cyan
	Write-Host "Se out\server-main.js nao existir, rode start-princy-code-web.ps1 uma vez ate compilar."
}

$codeRunner = Join-Path $ProjectRoot "deploy\windows\code-web\run-princy-code-web.ps1"
$caddyExe = Join-Path $CaddyDir "caddy.exe"
$caddyConfig = Join-Path $CaddyDir "Caddyfile"

Write-Host "=== Agent backend (node.exe direto) ===" -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File (Join-Path $ProjectRoot "deploy\windows\agent-backend\fix-princy-agent-backend-service.ps1") -ProjectRoot $ProjectRoot

Install-NssmService -Nssm $nssm -Name "PrincyAiCodeWeb" `
	-AppDirectory $ProjectRoot `
	-Runner $codeRunner `
	-RunnerArgs "-ProjectRoot `"$ProjectRoot`" -ServerBasePath /webeditor" `
	-StdoutLog (Join-Path $logsDir "code-web.out.log") `
	-StderrLog (Join-Path $logsDir "code-web.err.log")

if ((Test-Path $caddyExe) -and (Test-Path $caddyConfig)) {
	$existing = Get-Service "PrincyCaddy" -ErrorAction SilentlyContinue
	if ($existing) {
		if ($existing.Status -eq 'Running') { Stop-Service "PrincyCaddy" -Force }
		& $nssm remove PrincyCaddy confirm
		Start-Sleep -Seconds 2
	}
	& $nssm install PrincyCaddy $caddyExe
	& $nssm set PrincyCaddy AppParameters "run --config `"$caddyConfig`""
	& $nssm set PrincyCaddy AppDirectory $CaddyDir
	& $nssm set PrincyCaddy AppStdout (Join-Path $logsDir "caddy.out.log")
	& $nssm set PrincyCaddy AppStderr (Join-Path $logsDir "caddy.err.log")
	& $nssm set PrincyCaddy Start SERVICE_AUTO_START
	& $nssm set PrincyCaddy AppRestartDelay 5000
	& $nssm set PrincyCaddy AppExit Default Restart
	Write-Host "Instalado: PrincyCaddy"
} else {
	Write-Host "Caddy nao instalado - pulei PrincyCaddy" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Iniciar todos:" -ForegroundColor Green
Write-Host "  Start-Service PrincyAiAgentBackend, PrincyAiCodeWeb, PrincyCaddy"
Write-Host "Reiniciar:" -ForegroundColor Green
Write-Host "  Restart-Service PrincyAiAgentBackend, PrincyAiCodeWeb, PrincyCaddy"
