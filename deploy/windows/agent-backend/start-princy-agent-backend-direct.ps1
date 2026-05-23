# Arranque de emergencia do agent :3210 sem NSSM (teste ou recuperacao).
# Execute como Administrador.

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[int]$Port = 3210
)

$ErrorActionPreference = "Stop"
$appRoot = Join-Path $ProjectRoot "apps\ai-dashboard"
$serverJs = Join-Path $appRoot "dist\backend\server.js"
$logsDir = Join-Path $ProjectRoot "logs"
$outLog = Join-Path $logsDir "agent-backend-direct.out.log"
$errLog = Join-Path $logsDir "agent-backend-direct.err.log"

if (-not (Test-Path $serverJs)) {
	throw "Build ausente: $serverJs"
}

New-Item -ItemType Directory -Force $logsDir | Out-Null

$line = netstat -ano | Select-String "LISTENING" | Select-String ":$Port "
if ($line) {
	$procId = ($line.ToString() -split '\s+')[-1]
	if ($procId -match '^\d+$') {
		Write-Host "A parar processo na porta $Port (PID $procId) ..."
		Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
		Start-Sleep -Seconds 2
	}
}

$nodeExe = (Get-Command node.exe).Source
$env:API_PORT = "$Port"
$env:NODE_OPTIONS = "--max-old-space-size=8192"

Write-Host "A iniciar node em $appRoot (porta $Port) ..."
Start-Process -FilePath $nodeExe `
	-ArgumentList $serverJs `
	-WorkingDirectory $appRoot `
	-RedirectStandardOutput $outLog `
	-RedirectStandardError $errLog `
	-WindowStyle Hidden

Start-Sleep -Seconds 4
try {
	$r = Invoke-RestMethod "http://127.0.0.1:$Port/api/agent/health"
	Write-Host "OK: agent a responder" -ForegroundColor Green
	$r | ConvertTo-Json -Compress
} catch {
	Write-Host "Falhou. Ver $errLog" -ForegroundColor Red
	Get-Content $errLog -Tail 20 -ErrorAction SilentlyContinue
	exit 1
}
