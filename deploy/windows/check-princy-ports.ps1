param(
	[int]$CodeWebPort = 3200,
	[int]$AgentPort = 3210,
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

Write-Host "=== Princy Ai - diagnostico de portas ===" -ForegroundColor Cyan
Write-Host ""

$codeWeb = Test-PortListening -Port $CodeWebPort
$agent = Test-PortListening -Port $AgentPort
$caddy80 = Test-PortListening -Port 80
$caddy443 = Test-PortListening -Port 443

Write-Host ("Code Web (editor)        :{0} porta {1}" -f $(if ($codeWeb) { ' OK ' } else { ' OFF' }), $CodeWebPort)
Write-Host ("Agent backend (dashboard):{0} porta {1}" -f $(if ($agent) { ' OK ' } else { ' OFF' }), $AgentPort)
Write-Host ("Caddy HTTP               :{0} porta 80" -f $(if ($caddy80) { ' OK ' } else { ' OFF' }))
Write-Host ("Caddy HTTPS              :{0} porta 443" -f $(if ($caddy443) { ' OK ' } else { ' OFF' }))
Write-Host ""
Write-Host "Editor publico: https://princyai.com$basePath/" -ForegroundColor Cyan
Write-Host ""

if (-not $codeWeb) {
	Write-Host "Editor OFF -> Restart-Service PrincyAiCodeWeb" -ForegroundColor Yellow
}
if (-not $agent) {
	Write-Host "Backend OFF -> Restart-Service PrincyAiAgentBackend" -ForegroundColor Yellow
}
if (-not ($caddy80 -and $caddy443)) {
	Write-Host "Dominio timeout -> Start-Service PrincyCaddy (Admin)" -ForegroundColor Yellow
}

if ($codeWeb) {
	foreach ($path in @('/', $basePath + '/')) {
		try {
			$r = Invoke-WebRequest "http://127.0.0.1:$CodeWebPort$path" -UseBasicParsing -TimeoutSec 8
			$wb = $r.Content -match 'WORKBENCH_WEB_CONFIGURATION|serverBasePath'
			Write-Host "HTTP 127.0.0.1:$CodeWebPort$path -> $($r.StatusCode) ($($r.Content.Length) bytes) workbench=$wb" -ForegroundColor $(if ($wb) { 'Green' } else { 'Yellow' })
		} catch {
			Write-Host "HTTP 127.0.0.1:$CodeWebPort$path -> falhou: $_" -ForegroundColor Red
		}
	}
	try {
		$r = Invoke-WebRequest "http://127.0.0.1:$CodeWebPort/princy-api/api/health" -UseBasicParsing -TimeoutSec 8
		Write-Host "HTTP 127.0.0.1:$CodeWebPort/princy-api/api/health -> $($r.StatusCode)" -ForegroundColor Green
	} catch {
		Write-Host "Proxy /princy-api falhou: $_" -ForegroundColor Red
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
	Write-Host "Compile ausente. Rode:" -ForegroundColor Yellow
	Write-Host '  cd C:\Apps\Editor; $env:NODE_OPTIONS="--max-old-space-size=8192"; npm run compile-web'
}

Write-Host ""
Write-Host "Verificacao completa: deploy\windows\verify-princy-webeditor.ps1" -ForegroundColor Cyan
