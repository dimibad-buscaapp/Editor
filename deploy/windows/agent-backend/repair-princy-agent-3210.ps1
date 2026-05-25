# Pente fino: agent backend :3210 + proxy /princy-api + chat editor/dashboard.
# Admin VPS:
#   powershell -ExecutionPolicy Bypass -File C:\Apps\Editor\deploy\windows\agent-backend\repair-princy-agent-3210.ps1

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$SkipBuild,
	[switch]$SkipRestartCodeWeb
)

$ErrorActionPreference = "Continue"
$issues = [System.Collections.Generic.List[string]]@()
$fixes = [System.Collections.Generic.List[string]]@()

function Add-Issue([string]$msg) { $script:issues.Add($msg); Write-Host "  [X] $msg" -ForegroundColor Red }
function Add-Ok([string]$msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Add-Warn([string]$msg) { Write-Host "  [!] $msg" -ForegroundColor Yellow }

function Test-HttpJson {
	param([string]$Label, [string]$Url)
	try {
		$r = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 15
		$ok = $r.StatusCode -ge 200 -and $r.StatusCode -lt 300 -and ($r.Content -match '"ok"\s*:\s*true')
		if ($ok) { Add-Ok "$Label -> HTTP $($r.StatusCode)"; return $true }
		Add-Issue "$Label -> HTTP $($r.StatusCode) sem ok:true"
		return $false
	} catch {
		Add-Issue "$Label -> $($_.Exception.Message)"
		return $false
	}
}

Write-Host "=== Repair Princy Agent :3210 ===" -ForegroundColor Cyan
Write-Host "Pasta: $ProjectRoot`n"

$appRoot = Join-Path $ProjectRoot "apps\ai-dashboard"
$serverJs = Join-Path $appRoot "dist\backend\server.js"
$envFile = Join-Path $appRoot ".env"
$logsDir = Join-Path $ProjectRoot "logs"
$errLog = Join-Path $logsDir "agent-backend.err.log"
$outLog = Join-Path $logsDir "agent-backend.out.log"

# --- Servicos Windows ---
Write-Host "[1] Servicos" -ForegroundColor Cyan
foreach ($name in @('PrincyAiAgentBackend', 'PrincyAiCodeWeb', 'PrincyCaddy')) {
	$svc = Get-Service $name -ErrorAction SilentlyContinue
	if (-not $svc) {
		Add-Issue "Servico $name nao instalado"
		continue
	}
	if ($svc.Status -eq 'Running') {
		Add-Ok "$name = Running"
	} else {
		Add-Warn "$name = $($svc.Status) - a iniciar"
		try {
			Start-Service $name -ErrorAction Stop
			Start-Sleep -Seconds 3
			if ((Get-Service $name).Status -eq 'Running') {
				$fixes.Add("Iniciado $name")
				Add-Ok "$name agora Running"
			} else {
				Add-Issue "$name nao subiu apos Start-Service"
			}
		} catch {
			Add-Issue "Start-Service $name falhou: $($_.Exception.Message)"
		}
	}
}

# --- Porta 3210 ---
Write-Host "`n[2] Porta 3210" -ForegroundColor Cyan
$listen3210 = netstat -ano | Select-String "LISTENING" | Select-String ":3210 "
if ($listen3210) {
	Add-Ok "Porta 3210 em LISTEN"
} else {
	Add-Issue "Nada escutando na 3210"
}

# --- Build + .env ---
Write-Host "`n[3] Build e .env" -ForegroundColor Cyan
if (-not (Test-Path $serverJs)) {
	Add-Warn "Ausente dist\backend\server.js"
	if (-not $SkipBuild) {
		Write-Host "  Executando build-princy-agent-backend.ps1 ..." -ForegroundColor Cyan
		& powershell -ExecutionPolicy Bypass -File (Join-Path $ProjectRoot "deploy\windows\agent-backend\build-princy-agent-backend.ps1") -ProjectRoot $ProjectRoot
		if (Test-Path $serverJs) {
			$fixes.Add("Build agent backend")
			Add-Ok "Build concluido"
		} else {
			Add-Issue "Build falhou - veja saida acima"
		}
	}
} else {
	Add-Ok "dist\backend\server.js existe"
}

if (-not (Test-Path $envFile)) {
	Add-Warn ".env ausente"
	$example = Join-Path $appRoot "deploy\windows\princyai.env.production.example"
	if (Test-Path $example) {
		Copy-Item $example $envFile -Force
		$fixes.Add("Criado .env do example")
		Add-Ok "Copiado $example -> .env"
		Add-Warn "Revise DATABASE_URL, GROQ_API_KEY e SESSION_SECRET em $envFile"
	} else {
		Add-Issue ".env ausente e sem template example"
	}
} else {
	Add-Ok ".env presente"
	$envText = Get-Content $envFile -Raw
	if ($envText -match 'APP_ORIGIN\s*=\s*"?https://princyai\.com') {
		Add-Ok "APP_ORIGIN producao (https://princyai.com)"
	} elseif ($envText -match 'APP_ORIGIN\s*=\s*"?http://127\.0\.0\.1') {
		Add-Warn "APP_ORIGIN local (teste RDP) — em producao publica use https://princyai.com"
	}
	if ($envText -match 'PRINCY_CORS_RELAXED\s*=\s*"?true"?') {
		Add-Issue "PRINCY_CORS_RELAXED=true — desative em producao"
	}
	if ($envText -notmatch 'DATABASE_URL\s*=') {
		Add-Issue ".env sem DATABASE_URL"
	}
	if ($envText -match 'AI_PROVIDER\s*=\s*"?groq"?') {
		if ($envText -notmatch 'GROQ_API_KEY\s*=\s*"?gsk_') {
			Add-Warn "AI_PROVIDER=groq mas GROQ_API_KEY parece vazio/placeholder - chat pode falhar ao enviar"
		}
	}
	if ($envText -match 'AGENT_API_TOKEN\s*=\s*"?[^"\r\n]+"?') {
		$prodSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
		if (Test-Path $prodSettings) {
			$prod = Get-Content $prodSettings -Raw
			if ($prod -match '"princyai\.apiToken"\s*:\s*""') {
				Add-Warn "AGENT_API_TOKEN definido no .env mas editor tem apiToken vazio - pode dar 401 no chat"
			}
		}
	}
}

# --- Reinstalar/iniciar agent se health falhar ---
Write-Host "`n[4] Agent backend (reinstalar se necessario)" -ForegroundColor Cyan
$agentHealth = Test-HttpJson "Agent direto" "http://127.0.0.1:3210/api/agent/health"
$errTail = $null
if (Test-Path $errLog) {
	$errTail = (Get-Content $errLog -Tail 20 -ErrorAction SilentlyContinue) -join "`n"
}
if ($errTail -match 'FST_ERR_DEC_ALREADY_PRESENT|sendFile.*already been added') {
	Add-Warn "Log com crash sendFile duplicado - rebuild backend necessario (git pull + build-princy-agent-backend.ps1)"
	if (-not $SkipBuild) {
		& powershell -ExecutionPolicy Bypass -File (Join-Path $ProjectRoot "deploy\windows\agent-backend\build-princy-agent-backend.ps1") -ProjectRoot $ProjectRoot
		$fixes.Add("Rebuild agent (fix sendFile)")
		try {
			Restart-Service PrincyAiAgentBackend -Force -ErrorAction Stop
			Start-Sleep -Seconds 4
			$agentHealth = Test-HttpJson "Agent apos rebuild" "http://127.0.0.1:3210/api/agent/health"
		} catch {
			Add-Warn "Reinicie manualmente: Restart-Service PrincyAiAgentBackend"
		}
	}
}

if (-not $agentHealth) {
	Write-Host "  Reinstalando PrincyAiAgentBackend ..." -ForegroundColor Cyan
	$fixScript = Join-Path $ProjectRoot "deploy\windows\agent-backend\fix-princy-agent-backend-service.ps1"
	if (Test-Path $fixScript) {
		& powershell -ExecutionPolicy Bypass -File $fixScript -ProjectRoot $ProjectRoot
		if ($LASTEXITCODE -eq 0) {
			$fixes.Add("fix-princy-agent-backend-service.ps1")
			$agentHealth = Test-HttpJson "Agent apos fix" "http://127.0.0.1:3210/api/agent/health"
		}
	} else {
		Add-Issue "Script ausente: $fixScript"
	}
}

# --- Proxy Code Web + HTTPS ---
Write-Host "`n[5] Proxy /princy-api (editor)" -ForegroundColor Cyan
$proxyOk = Test-HttpJson "Code Web proxy" "http://127.0.0.1:3200/princy-api/api/agent/health"
$httpsOk = $false
try {
	$httpsOk = Test-HttpJson "HTTPS Caddy" "https://princyai.com/princy-api/api/agent/health"
} catch {
	Add-Warn "Teste HTTPS falhou (DNS/firewall local) - ignore se VPS externo OK"
}

if (-not $proxyOk -and -not $SkipRestartCodeWeb) {
	Add-Warn "Proxy :3200 falhou - reiniciando PrincyAiCodeWeb"
	try {
		Restart-Service PrincyAiCodeWeb -Force -ErrorAction Stop
		Start-Sleep -Seconds 8
		$fixes.Add("Restart PrincyAiCodeWeb")
		$proxyOk = Test-HttpJson "Proxy apos restart" "http://127.0.0.1:3200/princy-api/api/agent/health"
	} catch {
		Add-Issue "Restart PrincyAiCodeWeb: $($_.Exception.Message)"
	}
	if (-not $proxyOk) {
		Add-Issue "Proxy ainda falha - rode compile-incremental na raiz do Editor e fix-princy-code-web-service.ps1"
	}
}

# --- Diagnostic API ---
Write-Host "`n[6] Diagnostico interno" -ForegroundColor Cyan
if ($agentHealth) {
	try {
		$diag = Invoke-RestMethod "http://127.0.0.1:3210/api/diagnostic" -TimeoutSec 20
		foreach ($c in $diag.checks) {
			if ($c.ok) { Add-Ok "$($c.label): $($c.detail)" }
			else { Add-Issue "$($c.label): $($c.detail)" }
		}
		if ($diag.hints) {
			foreach ($h in $diag.hints) { Add-Warn $h }
		}
	} catch {
		Add-Warn "GET /api/diagnostic falhou: $($_.Exception.Message)"
	}
}

# --- Settings editor ---
Write-Host "`n[7] Settings editor" -ForegroundColor Cyan
$prodSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
$userSettings = Join-Path $ProjectRoot ".princy-user-data\User\settings.json"
if (Test-Path $prodSettings) {
	Copy-Item $prodSettings $userSettings -Force
	$fixes.Add("Settings producao copiados")
	Add-Ok "princy-production.settings.json -> .princy-user-data"
} else {
	Add-Warn "Ausente deploy\windows\princy-production.settings.json"
}

# --- Logs ---
Write-Host "`n[8] Logs recentes" -ForegroundColor Cyan
if (Test-Path $errLog) {
	$tail = Get-Content $errLog -Tail 12 -ErrorAction SilentlyContinue
	if ($tail) {
		Write-Host "--- agent-backend.err.log (12 linhas) ---" -ForegroundColor DarkGray
		$tail | ForEach-Object { Write-Host $_ -ForegroundColor DarkGray }
	}
}
if (-not $agentHealth -and (Test-Path $outLog)) {
	$tailOut = Get-Content $outLog -Tail 8 -ErrorAction SilentlyContinue
	if ($tailOut) {
		Write-Host "--- agent-backend.out.log ---" -ForegroundColor DarkGray
		$tailOut | ForEach-Object { Write-Host $_ -ForegroundColor DarkGray }
	}
}

# --- Resumo ---
Write-Host "`n=== Resumo ===" -ForegroundColor Cyan
$editorReady = $agentHealth -and $proxyOk
$dashboardReady = $agentHealth -and ($httpsOk -or $agentHealth)

if ($editorReady) {
	Write-Host "Editor (webeditor + /princy-api): PRONTO para chat" -ForegroundColor Green
} else {
	Write-Host "Editor: PROBLEMA - corrija itens [X] acima" -ForegroundColor Red
}
if ($dashboardReady) {
	Write-Host "Dashboard/chat publico (:3210 ou dashboard.princyai.com): API UP" -ForegroundColor Green
} else {
	Write-Host "Dashboard: API com problema" -ForegroundColor Red
}

if ($fixes.Count -gt 0) {
	Write-Host "`nCorrecoes aplicadas:" -ForegroundColor Green
	$fixes | ForEach-Object { Write-Host "  - $_" }
}

if ($issues.Count -gt 0) {
	Write-Host "`nPendencias ($($issues.Count)):" -ForegroundColor Yellow
	$issues | ForEach-Object { Write-Host "  - $_" }
	Write-Host "`nDocs: deploy\windows\CHAT-EDITOR-DIAGNOSTICO.md, deploy\windows\CHAT-502.md" -ForegroundColor DarkGray
	exit 1
}

Write-Host "`nTudo OK. No browser: Ctrl+F5 no webeditor; rede deve usar .../princy-api/api/agent/*" -ForegroundColor Green
exit 0
