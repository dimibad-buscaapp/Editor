# Forca Princy Ai sempre online (NSSM + portas 3220/3200/3210 + Caddy).
# Execute PowerShell como Administrador.
param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$CaddyDir = "C:\Caddy",
	[switch]$ReinstallServices,
	[switch]$SkipGitPull
)

$ErrorActionPreference = "Continue"

function Test-Admin {
	$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
	$principal = New-Object Security.Principal.WindowsPrincipal($identity)
	return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-TcpPortListening {
	param([int]$Port)
	$conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
	return [bool]$conn
}

function Wait-Port {
	param([int]$Port, [int]$Seconds = 45)
	for ($i = 0; $i -lt $Seconds; $i++) {
		if (Test-TcpPortListening -Port $Port) { return $true }
		Start-Sleep -Seconds 1
	}
	return $false
}

function Stop-PrincyPort {
	param([int]$Port)
	$stopScript = Join-Path $ProjectRoot "deploy\windows\code-web\Stop-CodeWebPort.ps1"
	if (Test-Path $stopScript) {
		& powershell -ExecutionPolicy Bypass -File $stopScript -Port $Port
	}
}

if (-not (Test-Admin)) {
	Write-Host "Execute como Administrador." -ForegroundColor Red
	exit 1
}

Set-Location $ProjectRoot
$hostsScript = Join-Path $ProjectRoot "deploy\windows\princy-hosts.ps1"
if (Test-Path $hostsScript) { . $hostsScript }

Write-Host "=== Princy Ai - sempre online ===" -ForegroundColor Cyan
Write-Host "Editor :3200 | API/Dashboard :3210 | Index :3220 | HTTPS :443" -ForegroundColor DarkGray
Write-Host ""

if (-not $SkipGitPull) {
	git pull 2>&1 | Out-Host
}

$names = @('PrincyAiCodeWeb', 'PrincyAiAgentBackend', 'PrincyAiIndex', 'PrincyCaddy')
foreach ($n in $names) {
	Stop-Service $n -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 3
Stop-PrincyPort -Port 3200
Stop-PrincyPort -Port 3210
Stop-PrincyPort -Port 3220

$caddySrc = Join-Path $ProjectRoot "deploy\windows\code-web\Caddyfile"
$caddyDst = Join-Path $CaddyDir "Caddyfile"
if (Test-Path $caddySrc) {
	New-Item -ItemType Directory -Force $CaddyDir | Out-Null
	Copy-Item $caddySrc $caddyDst -Force
	Write-Host "Caddyfile OK" -ForegroundColor Green
}

$settingsSrc = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
$userDir = Join-Path $ProjectRoot ".princy-user-data\User"
$userSettings = Join-Path $userDir "settings.json"
if (Test-Path $settingsSrc) {
	New-Item -ItemType Directory -Force $userDir | Out-Null
	Copy-Item $settingsSrc $userSettings -Force
	Write-Host "Settings editor OK" -ForegroundColor Green
}

New-Item -ItemType Directory -Force (Join-Path $ProjectRoot "logs") | Out-Null
New-Item -ItemType Directory -Force (Join-Path $ProjectRoot "workspaces\default") | Out-Null

if ($ReinstallServices) {
	Write-Host ""
	Write-Host "Reinstalando servicos NSSM ..." -ForegroundColor Cyan
	$installScript = Join-Path $ProjectRoot "deploy\windows\install-princy-production-services.ps1"
	& powershell -ExecutionPolicy Bypass -File $installScript -ProjectRoot $ProjectRoot -CaddyDir $CaddyDir -SkipBuild
}
else {
	Write-Host ""
	Write-Host "Corrigindo PrincyAiCodeWeb (3200) ..." -ForegroundColor Cyan
	$fixScript = Join-Path $ProjectRoot "deploy\windows\code-web\fix-princy-code-web-service.ps1"
	& powershell -ExecutionPolicy Bypass -File $fixScript -ProjectRoot $ProjectRoot
	$indexInstall = Join-Path $ProjectRoot "deploy\windows\index\install-princy-index-service.ps1"
	if (Test-Path $indexInstall) {
		$idx = Get-Service PrincyAiIndex -ErrorAction SilentlyContinue
		if (-not $idx) {
			& powershell -ExecutionPolicy Bypass -File $indexInstall -ProjectRoot $ProjectRoot
		}
	}
	$agentFix = Join-Path $ProjectRoot "deploy\windows\agent-backend\fix-princy-agent-backend-service.ps1"
	if (Test-Path $agentFix) {
		& powershell -ExecutionPolicy Bypass -File $agentFix -ProjectRoot $ProjectRoot
	}
	if ((Test-Path (Join-Path $CaddyDir "caddy.exe")) -and (Test-Path $caddyDst)) {
		$caddySvc = Get-Service PrincyCaddy -ErrorAction SilentlyContinue
		if (-not $caddySvc) {
			Write-Host "Instale Caddy: deploy\windows\code-web\install-princy-caddy.ps1" -ForegroundColor Yellow
		}
	}
}

foreach ($n in $names) {
	$s = Get-Service $n -ErrorAction SilentlyContinue
	if ($s) {
		Set-Service $n -StartupType Automatic -ErrorAction SilentlyContinue
	}
}

Write-Host ""
Write-Host "Iniciando servicos ..." -ForegroundColor Cyan
Start-Service PrincyAiAgentBackend -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Service PrincyAiIndex -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Service PrincyAiCodeWeb -ErrorAction SilentlyContinue

if (-not (Wait-Port -Port 3200 -Seconds 60)) {
	Write-Host "ERRO: porta 3200 nao escutando." -ForegroundColor Red
	$errLog = Join-Path $ProjectRoot "logs\code-web.err.log"
	if (Test-Path $errLog) {
		Get-Content $errLog -Tail 20
	}
	exit 1
}
Write-Host "Porta 3200 OK" -ForegroundColor Green

Start-Service PrincyCaddy -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "--- Status ---" -ForegroundColor Cyan
Get-Service PrincyAi* | Format-Table Name, Status, StartType -AutoSize
Get-Service PrincyCaddy -ErrorAction SilentlyContinue | Format-Table Name, Status, StartType -AutoSize

Write-Host ""
Write-Host "--- Log Code Web ---" -ForegroundColor Cyan
$outLog = Join-Path $ProjectRoot "logs\code-web.out.log"
if (Test-Path $outLog) {
	Select-String -Path $outLog -Pattern "Web UI available" | Select-Object -Last 1
	Get-Content $outLog -Tail 4
}

Write-Host ""
Write-Host "--- HTTP ---" -ForegroundColor Cyan
try {
	$r1 = Invoke-WebRequest "http://127.0.0.1:3200/webeditor/" -UseBasicParsing -TimeoutSec 15
	Write-Host ('Local 3200/webeditor: ' + $r1.StatusCode) -ForegroundColor Green
}
catch {
	Write-Host ('Local 3200/webeditor: FALHA ' + $_.Exception.Message) -ForegroundColor Red
}
try {
	$r2 = Invoke-WebRequest "https://princyai.com/webeditor/" -UseBasicParsing -TimeoutSec 20
	Write-Host ('HTTPS webeditor: ' + $r2.StatusCode) -ForegroundColor Green
}
catch {
	Write-Host ('HTTPS webeditor: FALHA ' + $_.Exception.Message) -ForegroundColor Yellow
}

$editorUrl = "https://princyai.com/webeditor/"
Write-Host ""
Write-Host ("Pronto: " + $editorUrl) -ForegroundColor Green
