# Corrige 502 em https://princyai.com/webeditor/ (Caddy OK, Code Web :3200 OFF).
# Admin: powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\fix-webeditor-502.ps1

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[int]$CodeWebPort = 3200,
	[string]$EditorBasePath = "/webeditor"
)

$ErrorActionPreference = "Continue"
$basePath = $EditorBasePath.Trim()
if (-not $basePath.StartsWith('/')) { $basePath = "/$basePath" }

function Test-PortListening {
	param([int]$Port)
	$lines = netstat -ano | Select-String "LISTENING" | Select-String ":$Port "
	return [bool]$lines
}

function Wait-Port {
	param([int]$Port, [int]$Seconds = 90)
	for ($i = 0; $i -lt $Seconds; $i++) {
		if (Test-PortListening -Port $Port) { return $true }
		Start-Sleep -Seconds 1
	}
	return $false
}

Write-Host "=== Fix webeditor 502 ===" -ForegroundColor Cyan
Write-Host ""

$svc = Get-Service PrincyAiCodeWeb -ErrorAction SilentlyContinue
if ($svc) {
	Write-Host ("PrincyAiCodeWeb: " + $svc.Status) -ForegroundColor $(if ($svc.Status -eq 'Running') { 'Green' } else { 'Yellow' })
} else {
	Write-Host "PrincyAiCodeWeb: NAO instalado" -ForegroundColor Red
}

$stopScript = Join-Path $ProjectRoot "deploy\windows\code-web\Stop-CodeWebPort.ps1"
if (Test-Path $stopScript) {
	& powershell -ExecutionPolicy Bypass -File $stopScript -Port $CodeWebPort
}

$fixScript = Join-Path $ProjectRoot "deploy\windows\code-web\fix-princy-code-web-service.ps1"
if (Test-Path $fixScript) {
	Write-Host "Reinstalando/iniciando PrincyAiCodeWeb ..." -ForegroundColor Cyan
	& powershell -ExecutionPolicy Bypass -File $fixScript -ProjectRoot $ProjectRoot -Port $CodeWebPort
}

if (-not (Wait-Port -Port $CodeWebPort -Seconds 90)) {
	Write-Host "ERRO: porta $CodeWebPort nao escuta." -ForegroundColor Red
	$errLog = Join-Path $ProjectRoot "logs\code-web.err.log"
	if (Test-Path $errLog) { Get-Content $errLog -Tail 20 }
	exit 1
}

$localUrl = "http://127.0.0.1:$CodeWebPort$basePath/"
try {
	$r = Invoke-WebRequest $localUrl -UseBasicParsing -TimeoutSec 20
	$wb = $r.Content -match 'WORKBENCH_WEB_CONFIGURATION|serverBasePath'
	Write-Host ("Direto $localUrl -> " + $r.StatusCode + " workbench=$wb") -ForegroundColor $(if ($wb) { 'Green' } else { 'Yellow' })
	if (-not $wb) {
		Write-Host "AVISO: HTML sem workbench - compile ou base path errado" -ForegroundColor Yellow
	}
}
catch {
	Write-Host ("Direto $localUrl -> FALHA: " + $_.Exception.Message) -ForegroundColor Red
	exit 1
}

$caddySvc = Get-Service PrincyCaddy -ErrorAction SilentlyContinue
$caddyProc = Get-Process -Name caddy -ErrorAction SilentlyContinue
if ($caddySvc -and $caddySvc.Status -eq 'Running') {
	Write-Host "Reiniciando PrincyCaddy (recarrega upstream) ..." -ForegroundColor Cyan
	Restart-Service PrincyCaddy -Force -ErrorAction SilentlyContinue
	Start-Sleep -Seconds 4
} elseif ($caddyProc) {
	Write-Host "Caddy em processo - reinicie apos fix-princy-caddy.ps1 se HTTPS ainda 502" -ForegroundColor Yellow
} else {
	Write-Host "Caddy parado - rode fix-princy-caddy.ps1" -ForegroundColor Yellow
}

$publicUrl = "https://princyai.com$basePath/"
try {
	$r2 = Invoke-WebRequest $publicUrl -UseBasicParsing -TimeoutSec 25 -MaximumRedirection 5
	$wb2 = $r2.Content -match 'WORKBENCH_WEB_CONFIGURATION|serverBasePath'
	Write-Host ("HTTPS $publicUrl -> " + $r2.StatusCode + " workbench=$wb2") -ForegroundColor Green
}
catch {
	$msg = $_.Exception.Message
	Write-Host ("HTTPS $publicUrl -> FALHA: " + $msg) -ForegroundColor Red
	if ($msg -match '502|Bad Gateway') {
		Write-Host "502 = Caddy nao alcanca 127.0.0.1:$CodeWebPort - confirme PrincyAiCodeWeb Running" -ForegroundColor Yellow
	}
	exit 1
}

Write-Host ""
Write-Host "OK - abra $publicUrl (Ctrl+F5 se cache antigo)" -ForegroundColor Green
