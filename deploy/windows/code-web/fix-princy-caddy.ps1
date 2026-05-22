# Corrige PrincyCaddy Paused / porta 80 bloqueada (IIS, http.sys, servico marcado para exclusao).
# Admin: powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\fix-princy-caddy.ps1

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$CaddyDir = "C:\Caddy",
	[string]$ServiceName = "PrincyCaddy",
	[switch]$Reinstall
)

$ErrorActionPreference = "Continue"

function Get-NssmPath {
	@(
		"${env:ProgramFiles}\nssm\nssm.exe",
		"${env:ProgramFiles(x86)}\nssm\nssm.exe",
		"C:\Tools\nssm\nssm.exe"
	) | Where-Object { Test-Path $_ } | Select-Object -First 1
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

Write-Host "Portas reservadas (Hyper-V) - se 80/443 aparecerem aqui, reinicie o VPS:" -ForegroundColor DarkGray
netsh interface ipv4 show excludedportrange protocol=tcp 2>$null | Select-String -Pattern "80|443|Start" | Select-Object -First 12

$nssm = Get-NssmPath
$svc = Get-Service $ServiceName -ErrorAction SilentlyContinue

if ($svc) {
	Write-Host ("Servico atual: " + $svc.Status) -ForegroundColor DarkGray
	if ($svc.Status -eq 'Running') {
		Stop-Service $ServiceName -Force -ErrorAction SilentlyContinue
		Start-Sleep -Seconds 2
	}
}

if ($Reinstall -or -not $svc) {
	if ($nssm) {
		Write-Host "Reinstalando NSSM $ServiceName ..." -ForegroundColor Cyan
		& $nssm stop $ServiceName confirm 2>$null | Out-Null
		& $nssm remove $ServiceName confirm 2>$null | Out-Null
		[void](Wait-ServiceGone -Name $ServiceName -Seconds 25)
		Start-Sleep -Seconds 3
		& $nssm install $ServiceName $caddyExe
		& $nssm set $ServiceName AppParameters ('run --config "' + $caddyConfig + '"')
		& $nssm set $ServiceName AppDirectory $CaddyDir
		& $nssm set $ServiceName AppStdout (Join-Path $logsDir "caddy.out.log")
		& $nssm set $ServiceName AppStderr (Join-Path $logsDir "caddy.err.log")
		& $nssm set $ServiceName Start SERVICE_AUTO_START
		& $nssm set $ServiceName AppRestartDelay 5000
		& $nssm reset $ServiceName AppExit
		Write-Host "NSSM reinstalado" -ForegroundColor Green
	} else {
		Write-Host "NSSM nao encontrado - use: C:\Caddy\caddy.exe run --config C:\Caddy\Caddyfile" -ForegroundColor Yellow
	}
} elseif ($nssm) {
	Write-Host "NSSM resume/restart ..." -ForegroundColor Cyan
	& $nssm resume $ServiceName 2>$null | Out-Null
}

Write-Host "Iniciando $ServiceName ..." -ForegroundColor Cyan
Start-Service $ServiceName -ErrorAction SilentlyContinue
Start-Sleep -Seconds 4

$svc2 = Get-Service $ServiceName -ErrorAction SilentlyContinue
if ($svc2 -and $svc2.Status -eq 'Paused' -and $nssm) {
	Write-Host "Servico Paused - tentando nssm restart ..." -ForegroundColor Yellow
	& $nssm restart $ServiceName 2>$null | Out-Null
	Start-Sleep -Seconds 4
}

if (-not (Test-PortListening -Port 443)) {
	Write-Host "443 ainda OFF - teste manual do Caddy (5s) ..." -ForegroundColor Yellow
	$p = Start-Process -FilePath $caddyExe -ArgumentList @('run', '--config', $caddyConfig) -PassThru -WindowStyle Hidden
	Start-Sleep -Seconds 5
	if (Test-PortListening -Port 443) {
		Write-Host "Caddy manual OK - pare o teste e reinicie o servico NSSM" -ForegroundColor Green
		Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
		Start-Sleep -Seconds 2
		Start-Service $ServiceName -ErrorAction SilentlyContinue
		Start-Sleep -Seconds 3
	} else {
		Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
	}
}

$p80 = Test-PortListening -Port 80
$p443 = Test-PortListening -Port 443
Write-Host ("Porta 80 LISTENING:  " + $(if ($p80) { "SIM" } else { "NAO" })) -ForegroundColor $(if ($p80) { "Green" } else { "Red" })
Write-Host ("Porta 443 LISTENING: " + $(if ($p443) { "SIM" } else { "NAO" })) -ForegroundColor $(if ($p443) { "Green" } else { "Red" })

Get-Service $ServiceName -ErrorAction SilentlyContinue | Format-Table Name, Status, StartType -AutoSize

$errLog = Join-Path $logsDir "caddy.err.log"
if (Test-Path $errLog) {
	Write-Host ""
	Write-Host "--- caddy.err.log (ultimas 10) ---" -ForegroundColor Cyan
	Get-Content $errLog -Tail 10
}

if ($p443) {
	try {
		$r = Invoke-WebRequest "http://127.0.0.1/webeditor/" -UseBasicParsing -TimeoutSec 15 -MaximumRedirection 5
		Write-Host ("http://127.0.0.1/webeditor/ -> " + $r.StatusCode) -ForegroundColor Green
	} catch {
		Write-Host ("http://127.0.0.1/webeditor/ -> " + $_.Exception.Message) -ForegroundColor Yellow
	}
} else {
	Write-Host "ERRO: Caddy nao escuta 443. Veja caddy.err.log acima." -ForegroundColor Red
	Write-Host "Se bind forbidden: reinicie o VPS apos iisreset /stop" -ForegroundColor Yellow
	exit 1
}

Write-Host ""
Write-Host "OK - teste: https://princyai.com/webeditor/" -ForegroundColor Green
