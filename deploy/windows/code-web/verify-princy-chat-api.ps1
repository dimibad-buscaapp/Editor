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

function Get-HttpErrorBody {
	param($ErrorRecord)
	try {
		if ($ErrorRecord.Exception.Response) {
			$reader = New-Object System.IO.StreamReader($ErrorRecord.Exception.Response.GetResponseStream())
			return $reader.ReadToEnd()
		}
	}
	catch { }
	return ''
}

Write-Host ""
Write-Host "[Fase 3 - Builder smoke]" -ForegroundColor Cyan
try {
	$buildBody = @{ target = 'web' } | ConvertTo-Json -Compress
	$buildStart = Invoke-RestMethod -Uri "http://127.0.0.1:${ApiPort}/api/agent/build" -Method Post -Body $buildBody -ContentType 'application/json' -TimeoutSec 30
	if ($buildStart.jobId) {
		Write-Host ("  POST /api/agent/build jobId={0} status={1}" -f $buildStart.jobId, $buildStart.status) -ForegroundColor Green
		$buildGet = Invoke-RestMethod -Uri "http://127.0.0.1:${ApiPort}/api/agent/build/$([uri]::EscapeDataString($buildStart.jobId))" -Method Get -TimeoutSec 15
		Write-Host ("  GET build status={0}" -f $buildGet.status) -ForegroundColor DarkGray
	}
	else {
		$issues += 'POST /api/agent/build sem jobId'
		Write-Host '  POST /api/agent/build: sem jobId' -ForegroundColor Red
	}
}
catch {
	$issues += "Builder: $($_.Exception.Message)"
	Write-Host ("  Builder: FALHA - {0}" -f $_.Exception.Message) -ForegroundColor Red
}

Write-Host ""
Write-Host "[Fase 3 - Chat mode job]" -ForegroundColor Cyan
try {
	$chatJobBody = @{
		agent             = 'deepseek'
		message           = 'Explique em uma frase o que e este projeto.'
		mode              = 'chat'
		actionOnlyExplain = $true
	} | ConvertTo-Json -Compress
	$chatJob = Invoke-RestMethod -Uri "http://127.0.0.1:${ApiPort}/api/agent/jobs" -Method Post -Body $chatJobBody -ContentType 'application/json' -TimeoutSec 30
	$chatJobId = $chatJob.jobId
	if ($chatJobId) {
		Start-Sleep -Seconds 3
		$chatSnap = Invoke-RestMethod -Uri "http://127.0.0.1:${ApiPort}/api/agent/jobs/$([uri]::EscapeDataString($chatJobId))" -Method Get -TimeoutSec 30
		if ($chatSnap.state -eq 'SUCCESS' -or $chatSnap.status -eq 'COMPLETED') {
			Write-Host ("  Chat job SUCCESS state={0}" -f $chatSnap.state) -ForegroundColor Green
		}
		else {
			Write-Host ("  Chat job state={0} (pode ainda estar rodando)" -f $chatSnap.state) -ForegroundColor DarkYellow
		}
	}
}
catch {
	$issues += "Chat mode job: $($_.Exception.Message)"
	Write-Host ("  Chat mode job: FALHA - {0}" -f $_.Exception.Message) -ForegroundColor Red
}

if (-not $SkipComposer) {
	Write-Host ""
	Write-Host "[Composer plan]" -ForegroundColor Cyan
	$composerPayload = @{
		agent       = 'deepseek'
		instruction = 'Return JSON only: summary and operations array (can be empty). List one file in workspace root.'
	}
	$composerBody = $composerPayload | ConvertTo-Json -Compress -Depth 4
	$composerBytes = [System.Text.Encoding]::UTF8.GetBytes($composerBody)
	try {
		$plan = Invoke-RestMethod -Uri "http://127.0.0.1:${ApiPort}/api/agent/composer-plan" -Method Post -Body $composerBytes -ContentType 'application/json; charset=utf-8' -TimeoutSec 180
		$hasPlan = ($null -ne $plan.summary) -and ($plan.summary.ToString().Length -gt 0)
		if ($hasPlan) {
			$opCount = if ($plan.operations) { @($plan.operations).Count } else { 0 }
			Write-Host ("  POST composer-plan: OK summary={0} operations={1}" -f $true, $opCount) -ForegroundColor Green
			if ($plan.warnings -and @($plan.warnings).Count -gt 0) {
				Write-Host ("  avisos: {0}" -f (@($plan.warnings) -join '; ')) -ForegroundColor DarkYellow
			}
		}
		else {
			$issues += 'composer-plan sem summary'
			Write-Host '  POST composer-plan: resposta sem summary' -ForegroundColor Red
		}
	}
	catch {
		$detail = Get-HttpErrorBody $_
		$issues += "composer-plan: $($_.Exception.Message)"
		if ($detail) { $issues += "composer-plan body: $detail" }
		Write-Host ("  POST composer-plan: FALHA - {0}" -f $_.Exception.Message) -ForegroundColor Red
		if ($detail) { Write-Host ("  resposta: {0}" -f $detail.Substring(0, [Math]::Min(400, $detail.Length))) -ForegroundColor DarkYellow }
	}
}

Write-Host ""
Write-Host "[Fase 4 - Project templates]" -ForegroundColor Cyan
try {
	$tpl = Invoke-RestMethod -Uri "http://127.0.0.1:${ApiPort}/api/projects/templates" -Method Get -TimeoutSec 20
	$count = if ($tpl.templates) { @($tpl.templates).Count } else { 0 }
	if ($count -ge 12) {
		Write-Host ("  GET /api/projects/templates: OK count={0}" -f $count) -ForegroundColor Green
	}
	else {
		$issues += "templates count=$count (esperado >= 12)"
		Write-Host ("  GET templates: count={0} (esperado 12)" -f $count) -ForegroundColor Red
	}
}
catch {
	$issues += "Project templates: $($_.Exception.Message)"
	Write-Host ("  Project templates: FALHA - {0}" -f $_.Exception.Message) -ForegroundColor Red
}

$smokeName = "princy-smoke-" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$created = $null
Write-Host ""
Write-Host "[Fase 4 - Create webapp smoke]" -ForegroundColor Cyan
try {
	$createBody = @{
		templateId   = 'webapp'
		projectName  = $smokeName
		runInstall   = $false
	} | ConvertTo-Json -Compress
	$created = Invoke-RestMethod -Uri "http://127.0.0.1:${ApiPort}/api/projects/create" -Method Post -Body $createBody -ContentType 'application/json' -TimeoutSec 60
	if ($created.ok -and $created.projectPath) {
		Write-Host ("  POST create: OK path={0}" -f $created.projectPath) -ForegroundColor Green
		if (Test-Path $created.projectPath) {
			Write-Host "  pasta no disco: OK" -ForegroundColor Green
		}
		else {
			$issues += "create path missing on disk"
		}
	}
	else {
		$issues += "create project: $($created.message)"
		Write-Host ("  POST create: FALHA - {0}" -f $created.message) -ForegroundColor Red
	}
}
catch {
	$issues += "Create project: $($_.Exception.Message)"
	Write-Host ("  Create project: FALHA - {0}" -f $_.Exception.Message) -ForegroundColor Red
}

Write-Host ""
Write-Host "[Fase 5 - Build Center]" -ForegroundColor Cyan
$buildSlug = $null
if ($created -and $created.ok -and $created.slug) {
	$buildSlug = $created.slug
}
elseif ($smokeName) {
	$buildSlug = $smokeName
}
if ($buildSlug) {
	try {
		$startBody = @{ type = 'web'; projectSlug = $buildSlug } | ConvertTo-Json -Compress
		$started = Invoke-RestMethod -Uri "http://127.0.0.1:${ApiPort}/api/build/start" -Method Post -Body $startBody -ContentType 'application/json' -TimeoutSec 30
		if (-not $started.ok -or -not $started.buildId) {
			$issues += "build start: $($started.message)"
			Write-Host ("  POST /api/build/start: FALHA - {0}" -f $started.message) -ForegroundColor Red
		}
		else {
			$bid = $started.buildId
			Write-Host ("  POST /api/build/start: OK id={0}" -f $bid) -ForegroundColor Green
			$deadline = (Get-Date).AddMinutes(8)
			$finalStatus = $null
			while ((Get-Date) -lt $deadline) {
				Start-Sleep -Seconds 3
				$st = Invoke-RestMethod -Uri "http://127.0.0.1:${ApiPort}/api/build/$bid/status" -Method Get -TimeoutSec 20
				$finalStatus = $st.status
				if ($finalStatus -eq 'success' -or $finalStatus -eq 'error') { break }
			}
			if ($finalStatus -eq 'success') {
				Write-Host ("  GET status: success") -ForegroundColor Green
				try {
					$dl = Invoke-WebRequest -Uri "http://127.0.0.1:${ApiPort}/api/build/$bid/download" -Method Get -UseBasicParsing -TimeoutSec 60
					if ($dl.RawContentLength -gt 0) {
						Write-Host ("  GET download: OK bytes={0}" -f $dl.RawContentLength) -ForegroundColor Green
					}
					else {
						$issues += 'build download empty'
						Write-Host '  GET download: vazio' -ForegroundColor Red
					}
				}
				catch {
					$issues += "build download: $($_.Exception.Message)"
					Write-Host ("  GET download: FALHA - {0}" -f $_.Exception.Message) -ForegroundColor Red
				}
			}
			else {
				$issues += "build status=$finalStatus"
				Write-Host ("  build terminou com status={0}" -f $finalStatus) -ForegroundColor Yellow
			}
		}
	}
	catch {
		$issues += "Build Center: $($_.Exception.Message)"
		Write-Host ("  Build Center: FALHA - {0}" -f $_.Exception.Message) -ForegroundColor Red
	}
}
else {
	Write-Host "  Build smoke: ignorado (sem projeto criado)" -ForegroundColor DarkGray
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
