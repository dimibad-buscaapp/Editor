# Cria tarefa agendada PrincyFase1Gate0 (Gate 0 a cada 6 horas).
# PowerShell como Administrador.

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$TaskName = "PrincyFase1Gate0",
	[int]$IntervalHours = 6
)

$ErrorActionPreference = "Stop"

function Test-Admin {
	$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
	$principal = New-Object Security.Principal.WindowsPrincipal($identity)
	return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
	Write-Host "Execute como Administrador." -ForegroundColor Red
	exit 1
}

$root = $ProjectRoot
if (-not (Test-Path $root)) {
	$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$testScript = Join-Path $root "deploy\windows\test-princy-phase1.ps1"
if (-not (Test-Path $testScript)) {
	Write-Host "Nao encontrado: $testScript" -ForegroundColor Red
	exit 1
}

$logDir = Join-Path $root "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logFile = Join-Path $logDir "fase1-gate0.log"

$psExe = (Get-Command powershell.exe).Source
$argument = "-NoProfile -ExecutionPolicy Bypass -File `"$testScript`" >> `"$logFile`" 2>&1"

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
	Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
	Write-Host "Tarefa existente removida: $TaskName" -ForegroundColor Yellow
}

$action = New-ScheduledTaskAction -Execute $psExe -Argument $argument -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Hours $IntervalHours) -RepetitionDuration ([TimeSpan]::MaxValue)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Princy Fase 1 Gate 0 HTTP probes" | Out-Null

Write-Host "Tarefa criada: $TaskName (a cada ${IntervalHours}h)" -ForegroundColor Green
Write-Host "Script: $testScript" -ForegroundColor DarkGray
Write-Host "Log: $logFile" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Testar agora:" -ForegroundColor Cyan
Write-Host "  Start-ScheduledTask -TaskName $TaskName" -ForegroundColor DarkGray
Write-Host "  Get-Content $logFile -Tail 30" -ForegroundColor DarkGray
