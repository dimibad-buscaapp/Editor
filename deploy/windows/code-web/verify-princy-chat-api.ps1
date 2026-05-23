# Valida chat webeditor -> /princy-api -> 3210 (same-origin).
# Admin: powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\verify-princy-chat-api.ps1

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$PublicHost = "princyai.com",
	[int]$ApiPort = 3210,
	[int]$CodeWebPort = 3200
)

$ErrorActionPreference = "Continue"
. (Join-Path $PSScriptRoot "..\princy-hosts.ps1")

Write-Host "=== Verificacao Chat API (Princy) ===" -ForegroundColor Cyan
Write-Host ""

$issues = @()

function Test-JsonHealth {
	param([string]$Label, [string]$Url)
	try {
		$r = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 20
		$json = $false
		$ok = $false
		if ($r.Content -match '"ok"\s*:\s*true') {
			$json = $true
			$ok = $true
		}
		$color = if ($ok) { 'Green' } else { 'Red' }
		Write-Host ("{0}: HTTP {1} json={2}" -f $Label, $r.StatusCode, $json) -ForegroundColor $color
		if (-not $ok) { $script:issues += "$Label - resposta nao e health JSON ($Url)" }
		return $ok
	}
	catch {
		Write-Host ("{0}: FALHA - {1}" -f $Label, $_.Exception.Message) -ForegroundColor Red
		$script:issues += "$Label - $($_.Exception.Message)"
		return $false
	}
}

# Servicos
foreach ($name in @('PrincyAiAgentBackend', 'PrincyAiCodeWeb', 'PrincyCaddy')) {
	$svc = Get-Service $name -ErrorAction SilentlyContinue
	if (-not $svc) {
		$issues += "Servico $name nao instalado"
		Write-Host "$name : NAO INSTALADO" -ForegroundColor Red
	}
	elseif ($svc.Status -ne 'Running') {
		$issues += "$name Status=$($svc.Status)"
		Write-Host "$name : $($svc.Status)" -ForegroundColor Red
	}
	else {
		Write-Host "$name : Running" -ForegroundColor Green
	}
}

Write-Host ""
Write-Host "[HTTP]" -ForegroundColor Cyan
Test-JsonHealth "API direta :3210" "http://127.0.0.1:${ApiPort}/api/agent/health" | Out-Null
Test-JsonHealth "Code Web proxy :3200" "http://127.0.0.1:${CodeWebPort}/princy-api/api/agent/health" | Out-Null
Test-JsonHealth "HTTPS Caddy /princy-api" "https://${PublicHost}/princy-api/api/agent/health" | Out-Null

Write-Host ""
Write-Host "[Extensao web]" -ForegroundColor Cyan
$extJs = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"
if (Test-Path $extJs) {
	Write-Host "  princy-ai dist/browser/extension.js: OK" -ForegroundColor Green
}
else {
	$issues += "Falta extensions/princy-ai/dist/browser/extension.js - rode npm run compile-web"
	Write-Host "  princy-ai browser bundle: AUSENTE" -ForegroundColor Red
}

$wbJs = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.js"
$serverMain = Join-Path $ProjectRoot "out\server-main.js"
$inWb = (Test-Path $wbJs) -and (Select-String -Path $wbJs -Pattern "princy-ai" -Quiet)
$inSrv = (Test-Path $serverMain) -and (Select-String -Path $serverMain -Pattern "princy-ai" -Quiet)
if ($inWb -or $inSrv) {
	Write-Host "  princy-ai no bundle (workbench=$inWb server=$inSrv): OK" -ForegroundColor Green
}
else {
	$issues += "princy-ai ausente em workbench.js e server-main.js - rode apply-princy-webeditor-hotfix.ps1"
	Write-Host "  princy-ai no bundle: AUSENTE" -ForegroundColor Red
}

try {
	$html = (Invoke-WebRequest "http://127.0.0.1:${CodeWebPort}/webeditor/" -UseBasicParsing -TimeoutSec 20).Content
	if ($html -match 'princy-ai') {
		Write-Host "  HTML /webeditor/ contem princy-ai: OK" -ForegroundColor Green
	}
	else {
		$issues += "HTML do webeditor sem princy-ai - reinicie servico apos bundle"
		Write-Host "  HTML /webeditor/ sem princy-ai" -ForegroundColor Red
	}
}
catch {
	Write-Host "  HTML /webeditor/ nao testado (servico parado?)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[Settings producao]" -ForegroundColor Cyan
$prod = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
$userData = Join-Path $ProjectRoot ".princy-user-data\User\settings.json"
if (Test-Path $prod) {
	$p = Get-Content $prod -Raw | ConvertFrom-Json
	Write-Host ("  princy-production agentEndpoint: {0}" -f $p.'princyai.agentEndpoint') -ForegroundColor DarkGray
	Write-Host ("  useSameOriginApi: {0}" -f $p.'princyai.useSameOriginApi') -ForegroundColor DarkGray
}
if (Test-Path $userData) {
	Write-Host "  .princy-user-data/User/settings.json: OK" -ForegroundColor Green
}
else {
	Write-Host "  .princy-user-data/User/settings.json: ausente (rode fix-princy-code-web-service.ps1)" -ForegroundColor Yellow
}

Write-Host ""
if ($issues.Count -eq 0) {
	Write-Host "OK - chat pode usar /princy-api (same-origin)." -ForegroundColor Green
	exit 0
}
Write-Host "Problemas:" -ForegroundColor Red
$issues | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
exit 1
