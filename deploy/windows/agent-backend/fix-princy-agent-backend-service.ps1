# Reinstala PrincyAiAgentBackend com node.exe direto (sem PowerShell no NSSM).
# Execute como Administrador.

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$ServiceName = "PrincyAiAgentBackend",
	[int]$Port = 3210
)

$ErrorActionPreference = "Stop"

function Invoke-NssmQuiet {
	param([string]$NssmExe, [string[]]$NssmArgs)
	$prev = $ErrorActionPreference
	$ErrorActionPreference = "Continue"
	try {
		& $NssmExe @NssmArgs 2>&1 | Out-Null
	} finally {
		$ErrorActionPreference = $prev
	}
}

function Get-NssmFromInstalledService {
	param([string]$Name)
	$svc = Get-CimInstance Win32_Service -Filter "Name='$Name'" -ErrorAction SilentlyContinue
	if (-not $svc?.PathName) { return $null }
	if ($svc.PathName -match '^"([^"]+\\nssm\.exe)"') { return $Matches[1] }
	if ($svc.PathName -match '^([^\s]+\\nssm\.exe)') { return $Matches[1] }
	return $null
}

function Get-NssmPath {
	$fromSvc = Get-NssmFromInstalledService -Name "PrincyAiAgentBackend"
	if ($fromSvc -and (Test-Path $fromSvc)) { return $fromSvc }
	$cmd = Get-Command nssm.exe -ErrorAction SilentlyContinue
	if ($cmd) { return $cmd.Source }
	foreach ($path in @(
		"${env:ProgramFiles}\nssm\nssm.exe",
		"${env:ProgramFiles(x86)}\nssm\nssm.exe",
		"C:\Tools\nssm\nssm.exe",
		"C:\nssm\nssm.exe",
		"C:\Caddy\nssm.exe"
	)) {
		if (Test-Path $path) { return $path }
	}
	throw "nssm.exe nao encontrado. Instale: winget install NSSM.NSSM"
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

function Remove-AgentService {
	param([string]$Name, [string]$NssmExe)
	$existing = Get-Service $Name -ErrorAction SilentlyContinue
	if (-not $existing) { return }

	Write-Host "Estado actual: $($existing.Status)" -ForegroundColor DarkGray
	if ($existing.Status -eq "Paused") {
		Write-Host "Servico $Name PAUSED - a limpar ..." -ForegroundColor Yellow
		Resume-Service $Name -ErrorAction SilentlyContinue
		Start-Sleep -Seconds 1
	}
	if ($existing.Status -in @("Running", "Paused", "StartPending")) {
		Stop-Service $Name -Force -ErrorAction SilentlyContinue
		Start-Sleep -Seconds 2
	}
	if ($NssmExe) {
		Invoke-NssmQuiet -NssmExe $NssmExe -NssmArgs @("stop", $Name, "confirm")
		Invoke-NssmQuiet -NssmExe $NssmExe -NssmArgs @("remove", $Name, "confirm")
	}
	if (Get-Service $Name -ErrorAction SilentlyContinue) {
		Write-Host "NSSM remove incompleto - sc.exe delete ..." -ForegroundColor Yellow
		sc.exe stop $Name 2>&1 | Out-Null
		Start-Sleep -Seconds 2
		sc.exe delete $Name 2>&1 | Out-Null
	}
	for ($i = 0; $i -lt 30; $i++) {
		if (-not (Get-Service $Name -ErrorAction SilentlyContinue)) { break }
		Start-Sleep -Seconds 1
	}
	if (Get-Service $Name -ErrorAction SilentlyContinue) {
		throw "Servico $Name ainda existe. Reinicie o VPS e execute de novo."
	}
}

$nssm = Get-NssmPath
Write-Host "NSSM: $nssm" -ForegroundColor DarkGray
$nodeExe = Resolve-NodeExe
$appRoot = Join-Path $ProjectRoot "apps\ai-dashboard"
$serverJs = Join-Path $appRoot "dist\backend\server.js"
$logsDir = Join-Path $ProjectRoot "logs"

if (-not (Test-Path $serverJs)) {
	Write-Host "Build ausente. Rode:" -ForegroundColor Yellow
	Write-Host "  powershell -File $ProjectRoot\deploy\windows\agent-backend\build-princy-agent-backend.ps1"
	exit 1
}

$envFile = Join-Path $appRoot ".env"
if (-not (Test-Path $envFile)) {
	Write-Host ".env ausente - a criar a partir do example ..." -ForegroundColor Yellow
	$example = Join-Path $appRoot "deploy\windows\princyai.env.production.example"
	if (-not (Test-Path $example)) {
		$example = Join-Path $appRoot "deploy\windows\princyai.env.example"
	}
	if (Test-Path $example) {
		Copy-Item $example $envFile
		Write-Host "Revise DATABASE_URL em $envFile" -ForegroundColor Yellow
	} else {
		Write-Host "AVISO: .env nao encontrado e sem example."x" -ForegroundColor Red
	}
}

New-Item -ItemType Directory -Force $logsDir | Out-Null

function Stop-PortListener {
	param([int]$ListenPort)
	$line = netstat -ano | Select-String "LISTENING" | Select-String ":$ListenPort "
	if (-not $line) { return }
	$procId = ($line.ToString() -split '\s+')[-1]
	if ($procId -match '^\d+$') {
		Write-Host "Liberando porta $ListenPort (PID $procId) ..."
		Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
		Start-Sleep -Seconds 2
	}
}

Remove-AgentService -Name $ServiceName -NssmExe $nssm
Stop-PortListener -ListenPort $Port

Write-Host "Node: $nodeExe"
Write-Host "Server: $serverJs"
Write-Host "AppDirectory: $appRoot"

Invoke-NssmQuiet -NssmExe $nssm -NssmArgs @("install", $ServiceName, $nodeExe, $serverJs)
& $nssm set $ServiceName AppDirectory $appRoot
& $nssm set $ServiceName AppStdout (Join-Path $logsDir "agent-backend.out.log")
& $nssm set $ServiceName AppStderr (Join-Path $logsDir "agent-backend.err.log")
& $nssm set $ServiceName Start SERVICE_AUTO_START
& $nssm set $ServiceName AppRestartDelay 5000
& $nssm set $ServiceName AppExit Default Restart
& $nssm set $ServiceName AppEnvironmentExtra "NODE_OPTIONS=--max-old-space-size=8192" "API_PORT=$Port"

Write-Host "Servico reinstalado. Iniciando ..." -ForegroundColor Green
$startOk = $false
try {
	Start-Service $ServiceName -ErrorAction Stop
	$startOk = $true
} catch {
	Write-Host "Start-Service falhou: $($_.Exception.Message)" -ForegroundColor Yellow
	Invoke-NssmQuiet -NssmExe $nssm -NssmArgs @("start", $ServiceName)
	Start-Sleep -Seconds 3
	$svc = Get-Service $ServiceName -ErrorAction SilentlyContinue
	if ($svc -and $svc.Status -eq "Running") { $startOk = $true }
}

Start-Sleep -Seconds 3
Get-Service $ServiceName -ErrorAction SilentlyContinue

$errLog = Join-Path $logsDir "agent-backend.err.log"
$outLog = Join-Path $logsDir "agent-backend.out.log"

if (-not $startOk) {
	Write-Host "Servico nao arrancou. Teste node directo:" -ForegroundColor Red
	Write-Host "  cd $appRoot" -ForegroundColor DarkGray
	Write-Host "  `$env:API_PORT=$Port; node dist\backend\server.js" -ForegroundColor DarkGray
	if (Test-Path $errLog) {
		Write-Host "`n--- agent-backend.err.log (ultimas 40 linhas) ---" -ForegroundColor Yellow
		Get-Content $errLog -Tail 40
	}
	exit 1
}

try {
	Invoke-WebRequest "http://127.0.0.1:$Port/api/agent/health" -UseBasicParsing | Select-Object StatusCode, Content
} catch {
	Write-Host "Health falhou apos start. Log:" -ForegroundColor Red
	if (Test-Path $errLog) { Get-Content $errLog -Tail 30 }
	if (Test-Path $outLog) { Get-Content $outLog -Tail 15 }
	exit 1
}
