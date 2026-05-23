# Reinstala PrincyAiAgentBackend com node.exe direto (sem PowerShell no NSSM).
# Execute como Administrador.

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$ServiceName = "PrincyAiAgentBackend",
	[int]$Port = 3210
)

$ErrorActionPreference = "Stop"

function Get-NssmPath {
	$cmd = Get-Command nssm.exe -ErrorAction SilentlyContinue
	if ($cmd) { return $cmd.Source }
	foreach ($path in @(
		"${env:ProgramFiles}\nssm\nssm.exe",
		"${env:ProgramFiles(x86)}\nssm\nssm.exe"
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
		"${env:ProgramFiles(x86)}\nodejs\node.exe",
		"C:\Program Files\nodejs\node.exe"
	)) {
		if (Test-Path $candidate) { return $candidate }
	}
	throw "node.exe nao encontrado. Instale Node.js LTS."
}

$nssm = Get-NssmPath
$nodeExe = Resolve-NodeExe
$appRoot = Join-Path $ProjectRoot "apps\ai-dashboard"
$serverJs = Join-Path $appRoot "dist\backend\server.js"
$logsDir = Join-Path $ProjectRoot "logs"

if (-not (Test-Path $serverJs)) {
	Write-Host "Build ausente. Rode:" -ForegroundColor Yellow
	Write-Host "  powershell -File $ProjectRoot\deploy\windows\agent-backend\build-princy-agent-backend.ps1"
	exit 1
}

New-Item -ItemType Directory -Force $logsDir | Out-Null

function Stop-PortListener {
	param([int]$Port)
	$line = netstat -ano | Select-String "LISTENING" | Select-String ":$Port "
	if (-not $line) { return }
	$pid = ($line.ToString() -split '\s+')[-1]
	if ($pid -match '^\d+$') {
		Write-Host "Liberando porta $Port (PID $pid) ..."
		Stop-Process -Id ([int]$pid) -Force -ErrorAction SilentlyContinue
		Start-Sleep -Seconds 2
	}
}

$existing = Get-Service $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
	if ($existing.Status -eq 'Paused') {
		Write-Host "Servico $ServiceName PAUSED - removendo instalacao NSSM ..." -ForegroundColor Yellow
		Resume-Service $ServiceName -ErrorAction SilentlyContinue
		Start-Sleep -Seconds 1
	}
	if ($existing.Status -eq 'Running' -or $existing.Status -eq 'Paused') {
		Stop-Service $ServiceName -Force -ErrorAction SilentlyContinue
		Start-Sleep -Seconds 2
	}
	& $nssm stop $ServiceName confirm 2>$null
	& $nssm remove $ServiceName confirm
}
for ($i = 0; $i -lt 30; $i++) {
	if (-not (Get-Service $ServiceName -ErrorAction SilentlyContinue)) { break }
	Start-Sleep -Seconds 1
}
if (Get-Service $ServiceName -ErrorAction SilentlyContinue) {
	throw "Servico $ServiceName ainda existe apos remocao. Reinicie o VPS ou aguarde 1 minuto e tente de novo."
}

Stop-PortListener -Port $Port

Write-Host "Node: $nodeExe"
Write-Host "Server: $serverJs"
Write-Host "AppDirectory: $appRoot"

& $nssm install $ServiceName $nodeExe $serverJs
& $nssm set $ServiceName AppDirectory $appRoot
& $nssm set $ServiceName AppStdout (Join-Path $logsDir "agent-backend.out.log")
& $nssm set $ServiceName AppStderr (Join-Path $logsDir "agent-backend.err.log")
& $nssm set $ServiceName Start SERVICE_AUTO_START
& $nssm set $ServiceName AppRestartDelay 5000
& $nssm set $ServiceName AppExit Default Restart
& $nssm set $ServiceName AppEnvironmentExtra "NODE_OPTIONS=--max-old-space-size=8192" "API_PORT=$Port"

Write-Host "Servico reinstalado. Iniciando ..."
Start-Service $ServiceName
Start-Sleep -Seconds 5
Get-Service $ServiceName
try {
	Invoke-WebRequest "http://127.0.0.1:$Port/api/agent/health" -UseBasicParsing | Select-Object StatusCode, Content
} catch {
	Write-Host "Health falhou. Log:" -ForegroundColor Red
	Get-Content (Join-Path $logsDir "agent-backend.err.log") -Tail 30 -ErrorAction SilentlyContinue
}
