# Corrige PrincyCaddy Paused / porta 80 bloqueada (IIS, http.sys, NSSM ausente).
# Admin: powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\fix-princy-caddy.ps1 -Reinstall

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$CaddyDir = "C:\Caddy",
	[string]$ServiceName = "PrincyCaddy",
	[switch]$Reinstall
)

$ErrorActionPreference = "Continue"

function Get-NssmPath {
	$cmd = Get-Command nssm.exe -ErrorAction SilentlyContinue
	if ($cmd) { return $cmd.Source }
	@(
		"${env:ProgramFiles}\nssm\nssm.exe",
		"${env:ProgramFiles(x86)}\nssm\nssm.exe",
		"C:\Tools\nssm\nssm.exe",
		"C:\nssm\nssm.exe"
	) | Where-Object { Test-Path $_ } | Select-Object -First 1
}

function Ensure-Nssm {
	$existing = Get-NssmPath
	if ($existing) { return $existing }
	Write-Host "NSSM nao encontrado. Instalando via winget ..." -ForegroundColor Yellow
	try {
		winget install --id NSSM.NSSM -e --accept-source-agreements --accept-package-agreements
		$machinePath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
		$userPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
		$env:Path = $machinePath + ';' + $userPath
	} catch {
		Write-Host ("winget falhou: " + $_.Exception.Message) -ForegroundColor Red
	}
	return Get-NssmPath
}

function Test-PortListening {
	param([int]$Port)
	$lines = netstat -ano | Select-String "LISTENING" | Select-String ":$Port "
	return [bool]$lines
}

function Wait-ServiceGone {
	param([string]$Name, [int]$Seconds = 30)
	for ($i = 0; $i -lt $Seconds; $i++) {
		$s = Get-Service $Name -ErrorAction SilentlyContinue
		if (-not $s) { return $true }
		Start-Sleep -Seconds 1
	}
	return $false
}

function Stop-CaddyProcesses {
	Get-Process -Name caddy -ErrorAction SilentlyContinue | ForEach-Object {
		Write-Host ("Encerrando caddy PID " + $_.Id) -ForegroundColor DarkGray
		Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
	}
	Start-Sleep -Seconds 2
}

function Remove-HttpUrlAclForPort {
	param([int]$Port)
	$list = netsh http show urlacl 2>$null
	if (-not $list) { return }
	$pattern = ':' + $Port + '/'
	foreach ($line in $list) {
		if ($line -notmatch 'Reserved URL') { continue }
		if ($line -notmatch $pattern) { continue }
		if ($line -match 'url=(.+?)\s') {
			$url = $matches[1].Trim()
			Write-Host ("Removendo urlacl: " + $url) -ForegroundColor Yellow
			netsh http delete urlacl url=$url 2>$null | Out-Null
		}
	}
}

function Install-PrincyCaddyService {
	param($Nssm, $CaddyExe, $CaddyConfig, $LogsDir, $CaddyDirPath)
	Write-Host "Instalando servico $ServiceName via NSSM ..." -ForegroundColor Cyan
	& $Nssm stop $ServiceName confirm 2>$null | Out-Null
	& $Nssm remove $ServiceName confirm 2>$null | Out-Null
	[void](Wait-ServiceGone -Name $ServiceName -Seconds 25)
	Start-Sleep -Seconds 3
	& $Nssm install $ServiceName $CaddyExe
	& $Nssm set $ServiceName AppParameters ('run --config "' + $CaddyConfig + '"')
	& $Nssm set $ServiceName AppDirectory $CaddyDirPath
	& $Nssm set $ServiceName AppStdout (Join-Path $LogsDir "caddy.out.log")
	& $Nssm set $ServiceName AppStderr (Join-Path $LogsDir "caddy.err.log")
	& $Nssm set $ServiceName Start SERVICE_AUTO_START
	& $Nssm set $ServiceName AppRestartDelay 5000
	& $Nssm set $ServiceName AppExit Default Restart
	Write-Host "Servico NSSM criado" -ForegroundColor Green
}

function Start-CaddyBackground {
	param($CaddyExe, $CaddyConfig, $CaddyDirPath, $LogsDir)
	$outLog = Join-Path $LogsDir "caddy.out.log"
	$errLog = Join-Path $LogsDir "caddy.err.log"
	Write-Host "Iniciando Caddy em segundo plano (sem NSSM) ..." -ForegroundColor Yellow
	$p = Start-Process -FilePath $CaddyExe -WorkingDirectory $CaddyDirPath `
		-ArgumentList @('run', '--config', $CaddyConfig) `
		-WindowStyle Hidden -PassThru
	$pidFile = Join-Path $CaddyDirPath "caddy.pid"
	Set-Content -Path $pidFile -Value $p.Id -Encoding ASCII
	Write-Host ("Caddy PID " + $p.Id + " (salvo em " + $pidFile + ")") -ForegroundColor Yellow
	Write-Host ("Logs: " + $outLog + " / " + $errLog) -ForegroundColor DarkGray
	return $p
}

Write-Host "=== Fix PrincyCaddy (80/443) ===" -ForegroundColor Cyan

$caddyExe = Join-Path $CaddyDir "caddy.exe"
$caddyConfig = Join-Path $CaddyDir "Caddyfile"
$logsDir = Join-Path $ProjectRoot "logs"
New-Item -ItemType Directory -Force $logsDir | Out-Null

if (-not (Test-Path $caddyExe)) {
	Write-Host "ERRO: caddy.exe ausente. Rode install-princy-caddy.ps1" -ForegroundColor Red
	exit 1
}
if (-not (Test-Path $caddyConfig)) {
	Write-Host "ERRO: Caddyfile ausente em $caddyConfig" -ForegroundColor Red
	exit 1
}

$src = Join-Path $ProjectRoot "deploy\windows\code-web\Caddyfile"
if (Test-Path $src) {
	Copy-Item $src $caddyConfig -Force
	Write-Host "Caddyfile atualizado" -ForegroundColor Green
}

Write-Host "Parando IIS (libera http.sys na 80) ..." -ForegroundColor Cyan
iisreset /stop 2>$null | Out-Null
Stop-Service W3SVC -Force -ErrorAction SilentlyContinue
Stop-Service WAS -Force -ErrorAction SilentlyContinue
Set-Service W3SVC -StartupType Disabled -ErrorAction SilentlyContinue

Remove-HttpUrlAclForPort -Port 80
Remove-HttpUrlAclForPort -Port 443

Write-Host "Portas reservadas Hyper-V (reinicie VPS se 80/443 listadas):" -ForegroundColor DarkGray
netsh interface ipv4 show excludedportrange protocol=tcp 2>$null | Select-String -Pattern "80|443|Start" | Select-Object -First 12

Stop-CaddyProcesses

$codeWebSvc = Get-Service PrincyAiCodeWeb -ErrorAction SilentlyContinue
if ($codeWebSvc -and $codeWebSvc.Status -ne 'Running') {
	Write-Host "Iniciando PrincyAiCodeWeb (Caddy precisa da 3200) ..." -ForegroundColor Cyan
	Start-Service PrincyAiCodeWeb -ErrorAction SilentlyContinue
}
if (-not (Test-PortListening -Port 3200)) {
	Write-Host "AVISO: porta 3200 OFF - rode fix-webeditor-502.ps1 antes do HTTPS /webeditor" -ForegroundColor Yellow
}

$nssm = Ensure-Nssm
if ($nssm) {
	Write-Host ("NSSM: " + $nssm) -ForegroundColor Green
} else {
	Write-Host "NSSM indisponivel - Caddy rodara em processo (instale: winget install NSSM.NSSM)" -ForegroundColor Yellow
}

$svc = Get-Service $ServiceName -ErrorAction SilentlyContinue
if ($svc -and $nssm) {
	Write-Host ("Servico atual: " + $svc.Status) -ForegroundColor DarkGray
	& $nssm stop $ServiceName confirm 2>$null | Out-Null
	Start-Sleep -Seconds 2
}

if ($Reinstall -or -not (Get-Service $ServiceName -ErrorAction SilentlyContinue)) {
	if ($nssm) {
		Install-PrincyCaddyService -Nssm $nssm -CaddyExe $caddyExe -CaddyConfig $caddyConfig -LogsDir $logsDir -CaddyDirPath $CaddyDir
	}
} elseif ($nssm) {
	Write-Host "NSSM restart ..." -ForegroundColor Cyan
	& $nssm restart $ServiceName 2>$null | Out-Null
	Start-Sleep -Seconds 3
}

$usedBackground = $false
if ($nssm) {
	Write-Host "Iniciando servico $ServiceName ..." -ForegroundColor Cyan
	Start-Service $ServiceName -ErrorAction SilentlyContinue
	Start-Sleep -Seconds 5
	$svc2 = Get-Service $ServiceName -ErrorAction SilentlyContinue
	if ($svc2 -and $svc2.Status -eq 'Paused') {
		& $nssm restart $ServiceName 2>$null | Out-Null
		Start-Sleep -Seconds 4
	}
}

if (-not (Test-PortListening -Port 443)) {
	if ($nssm -and ($Reinstall -or -not $svc)) {
		Install-PrincyCaddyService -Nssm $nssm -CaddyExe $caddyExe -CaddyConfig $caddyConfig -LogsDir $logsDir -CaddyDirPath $CaddyDir
		Start-Service $ServiceName -ErrorAction SilentlyContinue
		Start-Sleep -Seconds 5
	}
}

if (-not (Test-PortListening -Port 443)) {
	Stop-CaddyProcesses
	$null = Start-CaddyBackground -CaddyExe $caddyExe -CaddyConfig $caddyConfig -CaddyDirPath $CaddyDir -LogsDir $logsDir
	$usedBackground = $true
	Start-Sleep -Seconds 6
}

$p80 = Test-PortListening -Port 80
$p443 = Test-PortListening -Port 443
Write-Host ("Porta 80 LISTENING:  " + $(if ($p80) { "SIM" } else { "NAO" })) -ForegroundColor $(if ($p80) { "Green" } else { "Red" })
Write-Host ("Porta 443 LISTENING: " + $(if ($p443) { "SIM" } else { "NAO" })) -ForegroundColor $(if ($p443) { "Green" } else { "Red" })

Get-Service $ServiceName -ErrorAction SilentlyContinue | Format-Table Name, Status, StartType -AutoSize

$errLog = Join-Path $logsDir "caddy.err.log"
if (Test-Path $errLog) {
	Write-Host ""
	Write-Host "--- caddy.err.log (ultimas 8) ---" -ForegroundColor Cyan
	Get-Content $errLog -Tail 8
}

if ($p443) {
	try {
		$r = Invoke-WebRequest "http://127.0.0.1/webeditor/" -UseBasicParsing -TimeoutSec 15 -MaximumRedirection 5
		Write-Host ("http://127.0.0.1/webeditor/ -> " + $r.StatusCode) -ForegroundColor Green
	} catch {
		Write-Host ("http://127.0.0.1/webeditor/ -> " + $_.Exception.Message) -ForegroundColor Yellow
	}
	if ($usedBackground) {
		Write-Host ""
		Write-Host "AVISO: Caddy em processo, nao em servico. Instale NSSM e rode este script com -Reinstall." -ForegroundColor Yellow
	}
	Write-Host ""
	Write-Host "OK - teste: https://princyai.com/webeditor/" -ForegroundColor Green
	exit 0
}

Write-Host "ERRO: Caddy nao escuta 443." -ForegroundColor Red
Write-Host "1) winget install NSSM.NSSM" -ForegroundColor Yellow
Write-Host "2) Rode este script de novo com -Reinstall" -ForegroundColor Yellow
Write-Host "3) Se bind forbidden: reinicie o VPS" -ForegroundColor Yellow
exit 1
