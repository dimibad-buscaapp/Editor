# Diagnostico ERR_CONNECTION_TIMEDOUT em princyai.com (portas 80/443 na internet).
# Execute no VPS como Administrador: powershell -File deploy\windows\diagnose-princy-public-timeout.ps1

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$CaddyDir = "C:\Caddy"
)

$ErrorActionPreference = "Continue"

function Test-PortListening {
	param([int]$Port)
	$lines = netstat -ano | Select-String "LISTENING" | Select-String ":$Port "
	return [bool]$lines
}

function Ensure-FirewallRule {
	param([int]$Port, [string]$Name)
	$existing = Get-NetFirewallRule -DisplayName $Name -ErrorAction SilentlyContinue
	if ($existing) {
		Write-Host ("Firewall: regra ja existe - " + $Name) -ForegroundColor Green
		return
	}
	New-NetFirewallRule -DisplayName $Name -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow | Out-Null
	Write-Host ("Firewall: criada regra inbound TCP " + $Port + " - " + $Name) -ForegroundColor Green
}

Write-Host "=== Princy Ai - timeout publico (80/443) ===" -ForegroundColor Cyan
Write-Host "DNS esperado: princyai.com -> 108.181.169.40" -ForegroundColor DarkGray
Write-Host ""

$caddyExe = Join-Path $CaddyDir "caddy.exe"
$caddyFile = Join-Path $CaddyDir "Caddyfile"
$hasCaddyExe = Test-Path $caddyExe
$hasCaddyFile = Test-Path $caddyFile

Write-Host ("caddy.exe: " + $(if ($hasCaddyExe) { "OK " + $caddyExe } else { "AUSENTE - rode install-princy-caddy.ps1" })) -ForegroundColor $(if ($hasCaddyExe) { "Green" } else { "Red" })
Write-Host ("Caddyfile: " + $(if ($hasCaddyFile) { "OK" } else { "AUSENTE" })) -ForegroundColor $(if ($hasCaddyFile) { "Green" } else { "Red" })

$svc = Get-Service PrincyCaddy -ErrorAction SilentlyContinue
if ($svc) {
	Write-Host ("PrincyCaddy: " + $svc.Status + " (" + $svc.StartType + ")") -ForegroundColor $(if ($svc.Status -eq "Running") { "Green" } else { "Yellow" })
} else {
	Write-Host "PrincyCaddy: servico NAO instalado (NSSM)" -ForegroundColor Red
	Write-Host "  Rode: install-princy-caddy.ps1 + install-princy-production-services.ps1" -ForegroundColor Yellow
}

$p80 = Test-PortListening -Port 80
$p443 = Test-PortListening -Port 443
Write-Host ("Porta 80 LISTENING:  " + $(if ($p80) { "SIM" } else { "NAO" })) -ForegroundColor $(if ($p80) { "Green" } else { "Red" })
Write-Host ("Porta 443 LISTENING: " + $(if ($p443) { "SIM" } else { "NAO" })) -ForegroundColor $(if ($p443) { "Green" } else { "Red" })

if ($p80) {
	Write-Host "--- Quem usa porta 80 ---" -ForegroundColor DarkGray
	netstat -ano | Select-String ":80 " | Select-String "LISTENING" | Select-Object -First 5
}

$iis = Get-Service W3SVC -ErrorAction SilentlyContinue
if ($iis -and $iis.Status -eq "Running") {
	Write-Host "IIS (W3SVC) esta Running - pode bloquear Caddy na 80. Rode: iisreset /stop" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "--- Firewall Windows (inbound 80/443) ---" -ForegroundColor Cyan
try {
	Ensure-FirewallRule -Port 80 -Name "Princy HTTP"
	Ensure-FirewallRule -Port 443 -Name "Princy HTTPS"
} catch {
	Write-Host ("Firewall: falha (precisa Admin?) - " + $_.Exception.Message) -ForegroundColor Red
}

Write-Host ""
Write-Host "--- Teste local HTTPS ---" -ForegroundColor Cyan
if ($p80) {
	try {
		$r = Invoke-WebRequest "http://127.0.0.1/" -UseBasicParsing -TimeoutSec 10
		Write-Host ("http://127.0.0.1/ -> " + $r.StatusCode) -ForegroundColor Green
	} catch {
		Write-Host ("http://127.0.0.1/ -> " + $_.Exception.Message) -ForegroundColor Yellow
	}
} else {
	Write-Host "Pulei teste local: 80 nao escuta" -ForegroundColor Yellow
}

$errLog = Join-Path $ProjectRoot "logs\caddy.err.log"
if (Test-Path $errLog) {
	Write-Host ""
	Write-Host "--- Ultimas linhas caddy.err.log ---" -ForegroundColor Cyan
	Get-Content $errLog -Tail 15 -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "=== Correcao rapida (Admin) ===" -ForegroundColor Cyan
Write-Host @"
cd C:\Apps\Editor
git pull
powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\install-princy-caddy.ps1
powershell -ExecutionPolicy Bypass -File deploy\windows\install-princy-production-services.ps1 -SkipBuild
iisreset /stop
Start-Service PrincyCaddy
Get-Service PrincyCaddy
netstat -ano | findstr ":443 "
"@ -ForegroundColor White

Write-Host ""
Write-Host "Se 80/443 escutam no VPS mas o browser ainda da timeout:" -ForegroundColor Yellow
Write-Host "  Abra TCP 80 e 443 no firewall do PROVEDOR (painel VPS / security group)." -ForegroundColor Yellow
Write-Host "  Hostinger: VPS -> Firewall -> permitir HTTP(80) e HTTPS(443) inbound." -ForegroundColor Yellow
