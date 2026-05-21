param(
	[int]$CodeWebPort = 3200,
	[int]$AgentPort = 3210
)

$ErrorActionPreference = "Continue"

function Test-PortListening {
	param([int]$Port)
	$lines = netstat -ano | Select-String "LISTENING" | Select-String ":$Port "
	return [bool]$lines
}

Write-Host "=== Princy Ai - diagnostico de portas ===" -ForegroundColor Cyan
Write-Host ""

$codeWeb = Test-PortListening -Port $CodeWebPort
$agent = Test-PortListening -Port $AgentPort
$caddy80 = Test-PortListening -Port 80
$caddy443 = Test-PortListening -Port 443

Write-Host ("Code Web (princyai.com)  :{0} porta {1}" -f $(if ($codeWeb) { ' OK ' } else { ' OFF' }), $CodeWebPort)
Write-Host ("Agent backend (dashboard):{0} porta {1}" -f $(if ($agent) { ' OK ' } else { ' OFF' }), $AgentPort)
Write-Host ("Caddy HTTP               :{0} porta 80" -f $(if ($caddy80) { ' OK ' } else { ' OFF' }))
Write-Host ("Caddy HTTPS              :{0} porta 443" -f $(if ($caddy443) { ' OK ' } else { ' OFF' }))
Write-Host ""

if (-not $codeWeb) {
	Write-Host "502 em https://princyai.com -> suba o Code Web:" -ForegroundColor Yellow
	Write-Host "  powershell -ExecutionPolicy Bypass -File C:\Apps\Editor\deploy\windows\code-web\start-princy-code-web.ps1"
}
if (-not $agent) {
	Write-Host "Chat/dashboard 502 -> suba o backend:" -ForegroundColor Yellow
	Write-Host "  powershell -ExecutionPolicy Bypass -File C:\Apps\Editor\deploy\windows\agent-backend\start-princy-agent-backend.ps1"
}
if (-not ($caddy80 -and $caddy443)) {
	Write-Host "Dominio recusado -> suba o Caddy (Admin):" -ForegroundColor Yellow
	Write-Host "  C:\Caddy\caddy.exe run --config C:\Caddy\Caddyfile"
}

if ($codeWeb) {
	try {
		$r = Invoke-WebRequest "http://127.0.0.1:$CodeWebPort" -UseBasicParsing -TimeoutSec 5
		Write-Host "HTTP 127.0.0.1:$CodeWebPort -> $($r.StatusCode) ($($r.Content.Length) bytes)" -ForegroundColor Green
	} catch {
		Write-Host "Porta $CodeWebPort aberta mas HTTP falhou: $_" -ForegroundColor Red
	}
}

if ($agent) {
	try {
		$r = Invoke-WebRequest "http://127.0.0.1:$AgentPort/api/agent/health" -UseBasicParsing -TimeoutSec 5
		Write-Host "HTTP 127.0.0.1:$AgentPort/api/agent/health -> $($r.StatusCode)" -ForegroundColor Green
	} catch {
		Write-Host "Porta $AgentPort aberta mas health falhou: $_" -ForegroundColor Red
	}
}

$workbench = "C:\Apps\Editor\out\vs\code\browser\workbench\workbench-dev.html"
if (-not (Test-Path $workbench)) {
	Write-Host ""
	Write-Host "Compile do editor ausente. Rode em C:\Apps\Editor:" -ForegroundColor Yellow
	Write-Host '  $env:NODE_OPTIONS = "--max-old-space-size=8192"'
	Write-Host '  $env:PRINCY_SKIP_GULP_CLEAN = "1"'
	Write-Host "  npm run compile-incremental"
	Write-Host "  npm run compile-web"
}
