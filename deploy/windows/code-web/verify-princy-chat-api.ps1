# Valida chat webeditor -> /princy-api -> 3210 (same-origin).
# Admin: powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\verify-princy-chat-api.ps1

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$PublicHost = "princyai.com",
	[int]$ApiPort = 3210,
	[int]$CodeWebPort = 3200,
	[int]$SseTimeoutSec = 45,
	[switch]$SkipComposer
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

function Test-AgentJobStream {
	param([string]$JobId, [int]$ApiPort, [int]$TimeoutSec)
	$url = "http://127.0.0.1:${ApiPort}/api/agent/jobs/$([uri]::EscapeDataString($JobId))/stream"
	$request = [System.Net.HttpWebRequest]::Create($url)
	$request.Method = 'GET'
	$request.Timeout = $TimeoutSec * 1000
	$request.ReadWriteTimeout = $TimeoutSec * 1000
	$request.Accept = 'text/event-stream'
	try {
		$response = $request.GetResponse()
		$stream = $response.GetResponseStream()
		$reader = New-Object System.IO.StreamReader($stream)
		$deadline = (Get-Date).AddSeconds($TimeoutSec)
		$body = ''
		$sawDelta = $false
		$sawDone = $false
		$sawState = $false
		while ((Get-Date) -lt $deadline) {
			$line = $reader.ReadLine()
			if ($null -eq $line) { Start-Sleep -Milliseconds 200; continue }
			$body += "$line`n"
			if ($line -match '"type"\s*:\s*"delta"') { $sawDelta = $true }
			if ($line -match '"type"\s*:\s*"done"') { $sawDone = $true; break }
			if ($line -match '"type"\s*:\s*"state"') { $sawState = $true }
			if ($line -match '"type"\s*:\s*"error"') {
				$reader.Close()
				$response.Close()
				return @{ ok = $false; reason = "SSE error event: $line" }
			}
		}
		$reader.Close()
		$response.Close()
		if ($sawDone -or $sawDelta) {
			return @{ ok = $true; delta = $sawDelta; done = $sawDone; state = $sawState }
		}
		if ($sawState) {
			return @{ ok = $true; delta = $false; done = $false; state = $true; reason = 'SSE state only (job may still run)' }
		}
		return @{ ok = $false; reason = 'SSE timeout sem delta/done/state' }
	}
	catch {
		return @{ ok = $false; reason = $_.Exception.Message }
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
Write-Host "[HTTP /api/health]" -ForegroundColor Cyan
Test-JsonHealth "API direta :3210 /api/health" "http://127.0.0.1:${ApiPort}/api/health" | Out-Null
Test-JsonHealth "Code Web proxy /api/health" "http://127.0.0.1:${CodeWebPort}/princy-api/api/health" | Out-Null
Test-JsonHealth "HTTPS Caddy /api/health" "https://${PublicHost}/princy-api/api/health" | Out-Null

Write-Host ""
Write-Host "[HTTP /api/agent/health]" -ForegroundColor Cyan
Test-JsonHealth "API direta :3210 agent" "http://127.0.0.1:${ApiPort}/api/agent/health" | Out-Null
Test-JsonHealth "Code Web proxy agent" "http://127.0.0.1:${CodeWebPort}/princy-api/api/agent/health" | Out-Null
Test-JsonHealth "HTTPS Caddy agent" "https://${PublicHost}/princy-api/api/agent/health" | Out-Null

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
Write-Host "[Agent jobs + SSE]" -ForegroundColor Cyan
$jobBody = @{
	agent   = 'deepseek'
	message = 'ping'
	context = 'verify-script'
} | ConvertTo-Json -Compress
$jobId = $null
try {
	$jobResp = Invoke-RestMethod -Uri "http://127.0.0.1:${ApiPort}/api/agent/jobs" -Method Post -Body $jobBody -ContentType 'application/json' -TimeoutSec 30
	$jobId = $jobResp.jobId
	if (-not $jobId) { $jobId = $jobResp.id }
	if ($jobId) {
		Write-Host "  POST /api/agent/jobs jobId=$jobId : OK" -ForegroundColor Green
		$snap = Invoke-RestMethod -Uri "http://127.0.0.1:${ApiPort}/api/agent/jobs/$([uri]::EscapeDataString($jobId))" -Method Get -TimeoutSec 30
		Write-Host ("  GET job state={0}" -f $snap.state) -ForegroundColor DarkGray

		$sse = Test-AgentJobStream -JobId $jobId -ApiPort $ApiPort -TimeoutSec $SseTimeoutSec
		if ($sse.ok) {
			Write-Host ("  SSE stream: OK (delta={0} done={1} state={2})" -f $sse.delta, $sse.done, $sse.state) -ForegroundColor Green
		}
		else {
			$issues += "SSE stream: $($sse.reason)"
			Write-Host ("  SSE stream: FALHA - {0}" -f $sse.reason) -ForegroundColor Red
		}
	}
	else {
		$issues += 'POST /api/agent/jobs sem jobId'
		Write-Host '  POST /api/agent/jobs: sem jobId' -ForegroundColor Red
	}
}
catch {
	$issues += "Agent jobs: $($_.Exception.Message)"
	Write-Host ("  Agent jobs: FALHA - {0}" -f $_.Exception.Message) -ForegroundColor Red
}

if (-not $SkipComposer) {
	Write-Host ""
	Write-Host "[Composer plan]" -ForegroundColor Cyan
	$composerBody = @{
		agent       = 'deepseek'
		instruction = 'List one file in the workspace root. Reply with minimal JSON plan only.'
	} | ConvertTo-Json -Compress
	try {
		$plan = Invoke-RestMethod -Uri "http://127.0.0.1:${ApiPort}/api/agent/composer-plan" -Method Post -Body $composerBody -ContentType 'application/json' -TimeoutSec 120
		$hasPlan = ($null -ne $plan.summary) -or ($null -ne $plan.operations)
		if ($hasPlan) {
			$opCount = if ($plan.operations) { @($plan.operations).Count } else { 0 }
			Write-Host ("  POST composer-plan: OK summary={0} operations={1}" -f [bool]$plan.summary, $opCount) -ForegroundColor Green
		}
		else {
			$issues += 'composer-plan sem summary/operations'
			Write-Host '  POST composer-plan: resposta sem estrutura de plano' -ForegroundColor Red
		}
	}
	catch {
		$issues += "composer-plan: $($_.Exception.Message) (Ollama/Postgres?)"
		Write-Host ("  POST composer-plan: FALHA - {0}" -f $_.Exception.Message) -ForegroundColor Red
	}
}

Write-Host ""
Write-Host "[Settings producao]" -ForegroundColor Cyan
$prod = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
$userData = Join-Path $ProjectRoot ".princy-user-data\User\settings.json"
if (Test-Path $prod) {
	$p = Get-Content $prod -Raw | ConvertFrom-Json
	Write-Host ("  princy-production agentEndpoint: {0}" -f $p.'princyai.agentEndpoint') -ForegroundColor DarkGray
	Write-Host ("  useSameOriginApi: {0}" -f $p.'princyai.useSameOriginApi') -ForegroundColor DarkGray
	Write-Host ("  chat.simpleMode: {0}" -f $p.'princyai.chat.simpleMode') -ForegroundColor DarkGray
	Write-Host ("  secondarySideBar.forceMaximized: {0}" -f $p.'workbench.secondarySideBar.forceMaximized') -ForegroundColor DarkGray
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
