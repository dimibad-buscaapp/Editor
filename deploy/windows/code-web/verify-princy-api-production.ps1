# Verifica princy-api em MODO PRODUCAO (nao teste/local) e ligacao 100% 3200 -> 3210.
# Admin VPS:
#   pwsh -File deploy\windows\code-web\verify-princy-api-production.ps1 -ProjectRoot C:\Apps\Editor

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$PublicHost = "princyai.com",
	[int]$CodeWebPort = 3200,
	[int]$AgentPort = 3210,
	[switch]$FixSettings,
	[switch]$SkipChatPost
)

$ErrorActionPreference = "Continue"
$issues = [System.Collections.Generic.List[string]]@()
$warnings = [System.Collections.Generic.List[string]]@()

function Add-Issue([string]$m) { $script:issues.Add($m); Write-Host "  [X] $m" -ForegroundColor Red }
function Add-Warn([string]$m) { $script:warnings.Add($m); Write-Host "  [!] $m" -ForegroundColor Yellow }
function Add-Ok([string]$m) { Write-Host "  [OK] $m" -ForegroundColor Green }

function Test-HealthUrl {
	param([string]$Label, [string]$Url)
	try {
		$r = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 25
		$jsonOk = $r.StatusCode -eq 200 -and $r.Content -match '"ok"\s*:\s*true'
		if ($jsonOk) { Add-Ok "$Label HTTP $($r.StatusCode)"; return @{ ok = $true; body = $r.Content } }
		Add-Issue "$Label HTTP $($r.StatusCode) sem ok:true"
		return @{ ok = $false; body = $r.Content }
	}
	catch {
		Add-Issue "$Label - $($_.Exception.Message)"
		return @{ ok = $false; body = '' }
	}
}

function Get-EnvValue {
	param([string]$Text, [string]$Key)
	if ($Text -match "(?m)^\s*$([regex]::Escape($Key))\s*=\s*[`"']?([^`"'\r\n#]+)") {
		return $Matches[2].Trim()
	}
	return $null
}

Write-Host "=== Verificacao princy-api PRODUCAO + 3200->3210 ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $ProjectRoot)) {
	Write-Host "ProjectRoot invalido: $ProjectRoot" -ForegroundColor Red
	exit 1
}

$appRoot = Join-Path $ProjectRoot "apps\ai-dashboard"
$envFile = Join-Path $appRoot ".env"
$prodExample = Join-Path $appRoot "deploy\windows\princyai.env.production.example"
$localExample = Join-Path $appRoot "deploy\windows\princyai.env.local.example"
$prodSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
$userSettings = Join-Path $ProjectRoot ".princy-user-data\User\settings.json"

# --- 1) .env producao vs teste ---
Write-Host "[1] Backend .env (producao vs teste)" -ForegroundColor Cyan
if (-not (Test-Path $envFile)) {
	Add-Issue "Ausente apps\ai-dashboard\.env — copie princyai.env.production.example"
} else {
	Add-Ok ".env presente"
	$envText = Get-Content $envFile -Raw
	$appOrigin = Get-EnvValue $envText 'APP_ORIGIN'
	$apiHost = Get-EnvValue $envText 'API_HOST'
	$corsRelaxed = Get-EnvValue $envText 'PRINCY_CORS_RELAXED'
	$codeWebUrl = Get-EnvValue $envText 'CODE_WEB_URL'

	if ($appOrigin -match '^https://(princyai\.com|www\.princyai\.com)') {
		Add-Ok "APP_ORIGIN producao: $appOrigin"
	} elseif ($appOrigin -match '^http://127\.0\.0\.1|^http://localhost') {
		Add-Issue "APP_ORIGIN parece TESTE/LOCAL: $appOrigin — use https://princyai.com em producao"
	} else {
		Add-Warn "APP_ORIGIN incomum: $appOrigin (esperado https://princyai.com)"
	}

	if ($apiHost -eq '0.0.0.0') {
		Add-Ok "API_HOST=0.0.0.0 (agent escuta no VPS)"
	} elseif ($apiHost -eq '127.0.0.1') {
		Add-Warn "API_HOST=127.0.0.1 (ok se Caddy faz proxy; producao tipica usa 0.0.0.0)"
	}

	if ($corsRelaxed -eq 'true') {
		Add-Issue "PRINCY_CORS_RELAXED=true — modo desenvolvimento, desative em producao"
	} else {
		Add-Ok "PRINCY_CORS_RELAXED nao ativo (producao)"
	}

	if ($codeWebUrl -match '/webeditor') {
		Add-Ok "CODE_WEB_URL com /webeditor: $codeWebUrl"
	} else {
		Add-Warn "CODE_WEB_URL sem /webeditor: $codeWebUrl"
	}

	if ($envText -match 'NODE_ENV\s*=\s*development') {
		Add-Issue ".env com NODE_ENV=development no agent"
	}
	if ($envText -match 'PRINCY_LIVE_MODE\s*=\s*"?1"?|PRINCY_LIVE_MODE\s*=\s*true') {
		Add-Warn ".env com PRINCY_LIVE_MODE — rotas live/teste"
	}
}

# --- 2) Code Web modo PROD (nao VSCODE_DEV) ---
Write-Host ""
Write-Host "[2] Code Web :$CodeWebPort (bundle PROD, nao teste)" -ForegroundColor Cyan
$wbJs = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.js"
if (Test-Path $wbJs) {
	$bytes = (Get-Item $wbJs).Length
	if ($bytes -ge 800000) { Add-Ok "workbench.js bundled ($([math]::Round($bytes/1MB,2)) MB)" }
	else { Add-Issue "workbench.js pequeno ($bytes bytes) — modo teste/DEV, rode compile-princy-code-web-production.ps1" }
} else {
	Add-Issue "workbench.js ausente em out\"
}

$nssm = Join-Path $env:ProgramFiles "nssm\nssm.exe"
if (Test-Path $nssm) {
	$extra = & $nssm get PrincyAiCodeWeb AppEnvironmentExtra 2>$null
	if ($extra -match 'VSCODE_DEV=1') {
		Add-Issue "Servico PrincyAiCodeWeb com VSCODE_DEV=1 (modo teste — pagina branca/offline)"
	} else {
		Add-Ok "PrincyAiCodeWeb sem VSCODE_DEV"
	}
	if ($extra -match 'PRINCY_LIVE_MODE=1') {
		Add-Warn "PrincyAiCodeWeb com PRINCY_LIVE_MODE (porta live/teste)"
	}
}

$listen3201 = netstat -ano 2>$null | Select-String "LISTENING" | Select-String ":3201 "
if ($listen3201) {
	Add-Warn "Porta 3201 (webeditor-live) em LISTEN — confirme que URL principal e /webeditor/ na 3200"
}

# --- 3) Settings editor (endpoint HTTPS producao) ---
Write-Host ""
Write-Host "[3] Settings editor (princy-api no browser)" -ForegroundColor Cyan
if ($FixSettings -and (Test-Path $prodSettings)) {
	New-Item -ItemType Directory -Force (Split-Path $userSettings -Parent) | Out-Null
	Copy-Item $prodSettings $userSettings -Force
	Add-Ok "Copiado princy-production.settings.json -> .princy-user-data"
}
if (Test-Path $userSettings) {
	$us = Get-Content $userSettings -Raw
	if ($us -match '"princyai\.agentEndpoint"\s*:\s*"(https://[^"]+/princy-api)"') {
		Add-Ok "agentEndpoint HTTPS: $($Matches[1])"
	} elseif ($us -match '"princyai\.agentEndpoint"\s*:\s*"/princy-api"') {
		Add-Warn 'agentEndpoint relativo "/princy-api" — use https://princyai.com/princy-api apos git pull'
	} elseif ($us -match ':3210') {
		Add-Issue "agentEndpoint aponta :3210 direto — falha no browser do utilizador"
	}
} else {
	Add-Warn "Ausente .princy-user-data\User\settings.json"
}

# --- 4) Servicos ---
Write-Host ""
Write-Host "[4] Servicos Windows" -ForegroundColor Cyan
foreach ($n in @('PrincyAiAgentBackend', 'PrincyAiCodeWeb', 'PrincyCaddy')) {
	$s = Get-Service $n -ErrorAction SilentlyContinue
	if ($s -and $s.Status -eq 'Running') { Add-Ok "$n Running" }
	else { Add-Issue "$n nao Running" }
}

# --- 5) Ligacao 3210 + proxy 3200 + HTTPS ---
Write-Host ""
Write-Host "[5] Ligacao API 3210 e proxy 3200->3210" -ForegroundColor Cyan
$agentDirect = Test-HealthUrl "Agent :3210 /api/agent/health" "http://127.0.0.1:${AgentPort}/api/agent/health"
if ($agentDirect.ok -and $agentDirect.body -match '"environment"\s*:\s*"production"') {
	Add-Ok 'Health reporta environment=production'
} elseif ($agentDirect.ok -and $agentDirect.body -match '"environment"\s*:\s*"development"') {
	Add-Issue 'Health reporta environment=development — ajuste APP_ORIGIN=https://princyai.com e PRINCY_CORS_RELAXED=false'
} elseif ($agentDirect.ok) {
	Add-Warn 'Health sem campo environment (git pull + rebuild agent para versao nova)'
}

Test-HealthUrl "Proxy :3200 /princy-api" "http://127.0.0.1:${CodeWebPort}/princy-api/api/agent/health" | Out-Null
Test-HealthUrl "Proxy :3200 /webeditor/princy-api" "http://127.0.0.1:${CodeWebPort}/webeditor/princy-api/api/agent/health" | Out-Null
Test-HealthUrl "HTTPS Caddy /princy-api" "https://${PublicHost}/princy-api/api/agent/health" | Out-Null
Test-HealthUrl "HTTPS /webeditor/princy-api" "https://${PublicHost}/webeditor/princy-api/api/agent/health" | Out-Null

# --- 6) Chat POST (funcionalidade real) ---
if (-not $SkipChatPost) {
	Write-Host ""
	Write-Host "[6] Chat POST via /princy-api (producao)" -ForegroundColor Cyan
	try {
		$body = @{
			agent = 'princy'
			message = 'ping producao verify'
			async = $false
			priority = 'normal'
		} | ConvertTo-Json -Compress
		$chatUrl = "https://${PublicHost}/princy-api/api/agent/chat"
		$r = Invoke-WebRequest $chatUrl -Method Post -Body $body -ContentType 'application/json' -UseBasicParsing -TimeoutSec 90
		if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) {
			Add-Ok "POST $chatUrl HTTP $($r.StatusCode)"
		} else {
			Add-Issue "POST chat HTTP $($r.StatusCode)"
		}
	}
	catch {
		Add-Issue "POST chat via HTTPS - $($_.Exception.Message)"
		try {
			$proxyChat = "http://127.0.0.1:${CodeWebPort}/princy-api/api/agent/chat"
			$r2 = Invoke-WebRequest $proxyChat -Method Post -Body $body -ContentType 'application/json' -UseBasicParsing -TimeoutSec 90
			Add-Ok "POST proxy local OK (HTTPS falhou mas 3200->3210 funciona) HTTP $($r2.StatusCode)"
		} catch {
			Add-Issue "POST chat proxy local - $($_.Exception.Message)"
		}
	}
}

# --- Resumo ---
Write-Host ""
Write-Host "Mapa producao esperado:" -ForegroundColor DarkGray
Write-Host "  https://princyai.com/princy-api/*  -> Caddy -> :3210 (agent)" -ForegroundColor DarkGray
Write-Host "  https://princyai.com/webeditor/*    -> Caddy -> :3200 (Code Web)" -ForegroundColor DarkGray
Write-Host "  http://127.0.0.1:3200/princy-api/* -> proxy interno -> :3210" -ForegroundColor DarkGray

if ($warnings.Count -gt 0) {
	Write-Host ""
	Write-Host "Avisos ($($warnings.Count)):" -ForegroundColor Yellow
	$warnings | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
}

if ($issues.Count -gt 0) {
	Write-Host ""
	Write-Host "FALHOU ($($issues.Count)):" -ForegroundColor Red
	$issues | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
	Write-Host ""
	Write-Host "Reparo: pwsh -File deploy\windows\agent-backend\repair-princy-agent-3210.ps1 -ProjectRoot $ProjectRoot" -ForegroundColor Cyan
	Write-Host "        pwsh -File deploy\windows\code-web\fix-princy-editor-agora.ps1 -ProjectRoot $ProjectRoot -FixSettings" -ForegroundColor Cyan
	exit 1
}

Write-Host ""
Write-Host "OK: princy-api em configuracao PRODUCAO e ligacao 3200->3210 funcional." -ForegroundColor Green
exit 0
