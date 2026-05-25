# Testa ligacao editor :3200 -> agent :3210 via /princy-api (e Caddy HTTPS).
# Admin: pwsh -File deploy\windows\code-web\test-princy-3200-3210-proxy.ps1

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$PublicHost = "princyai.com",
	[int]$CodeWebPort = 3200,
	[int]$AgentPort = 3210
)

$ErrorActionPreference = "Continue"
$fail = 0

function Test-Health {
	param([string]$Label, [string]$Url)
	try {
		$r = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 20
		$ok = $r.StatusCode -eq 200 -and $r.Content -match '"ok"\s*:\s*true'
		$color = if ($ok) { 'Green' } else { 'Red' }
		Write-Host ("  [{0}] {1} HTTP {2}" -f $(if ($ok) { 'OK' } else { 'X' }), $Label, $r.StatusCode) -ForegroundColor $color
		if (-not $ok) { $script:fail++ }
		return $ok
	}
	catch {
		Write-Host ("  [X] {0} - {1}" -f $Label, $_.Exception.Message) -ForegroundColor Red
		$script:fail++
		return $false
	}
}

Write-Host "=== Teste proxy 3200 -> 3210 (Princy editor chat) ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "[Agent direto :3210]" -ForegroundColor Cyan
Test-Health "3210 /api/agent/health" "http://127.0.0.1:${AgentPort}/api/agent/health" | Out-Null
Test-Health "3210 /api/health" "http://127.0.0.1:${AgentPort}/api/health" | Out-Null

Write-Host ""
Write-Host "[Code Web :3200 /princy-api -> 3210]" -ForegroundColor Cyan
Test-Health "3200 /princy-api/agent" "http://127.0.0.1:${CodeWebPort}/princy-api/api/agent/health" | Out-Null
Test-Health "3200 /princy-api/health" "http://127.0.0.1:${CodeWebPort}/princy-api/api/health" | Out-Null
Test-Health "3200 /webeditor/princy-api" "http://127.0.0.1:${CodeWebPort}/webeditor/princy-api/api/agent/health" | Out-Null

Write-Host ""
Write-Host "[HTTPS Caddy (browser do editor)]" -ForegroundColor Cyan
Test-Health "HTTPS /princy-api" "https://${PublicHost}/princy-api/api/agent/health" | Out-Null
Test-Health "HTTPS /webeditor/princy-api" "https://${PublicHost}/webeditor/princy-api/api/agent/health" | Out-Null

Write-Host ""
Write-Host "[Servicos]" -ForegroundColor Cyan
foreach ($name in @('PrincyAiAgentBackend', 'PrincyAiCodeWeb', 'PrincyCaddy')) {
	$s = Get-Service $name -ErrorAction SilentlyContinue
	if ($s -and $s.Status -eq 'Running') {
		Write-Host "  [OK] $name Running" -ForegroundColor Green
	} else {
		Write-Host "  [X] $name" -ForegroundColor Red
		$fail++
	}
}

$settings = Join-Path $ProjectRoot ".princy-user-data\User\settings.json"
if (Test-Path $settings) {
	$raw = Get-Content $settings -Raw
	Write-Host ""
	Write-Host "[Settings editor]" -ForegroundColor Cyan
	if ($raw -match '"princyai\.agentEndpoint"\s*:\s*"([^"]+)"') {
		Write-Host ("  agentEndpoint: {0}" -f $Matches[1]) -ForegroundColor DarkGray
		if ($Matches[1] -match ':3210' -and $Matches[1] -notmatch 'princy-api') {
			Write-Host "  AVISO: :3210 no browser do utilizador falha — use https://princyai.com/princy-api" -ForegroundColor Yellow
		}
	}
}

Write-Host ""
Write-Host "[Modo producao]" -ForegroundColor Cyan
$envFile = Join-Path $ProjectRoot "apps\ai-dashboard\.env"
if (Test-Path $envFile) {
	$envText = Get-Content $envFile -Raw
	if ($envText -match 'APP_ORIGIN\s*=\s*"?https://princyai\.com') {
		Write-Host "  [OK] APP_ORIGIN=https://princyai.com" -ForegroundColor Green
	} else {
		Write-Host "  [!] APP_ORIGIN nao e https://princyai.com — pode ser .env de TESTE" -ForegroundColor Yellow
		$fail++
	}
}
try {
	$h = Invoke-RestMethod "http://127.0.0.1:${AgentPort}/api/agent/health" -TimeoutSec 15
	if ($h.environment -eq 'production') {
		Write-Host "  [OK] /api/agent/health environment=production" -ForegroundColor Green
	} elseif ($h.environment) {
		Write-Host "  [X] environment=$($h.environment) (esperado production)" -ForegroundColor Red
		$fail++
	}
} catch { }

Write-Host ""
if ($fail -eq 0) {
	Write-Host "OK: 3200 e 3210 ligados. Verificacao completa: verify-princy-api-production.ps1" -ForegroundColor Green
	exit 0
}

Write-Host "FALHOU: $fail teste(s). Repare com repair-princy-stack-3210-3220.ps1 e Restart-Service PrincyAiCodeWeb, PrincyAiAgentBackend" -ForegroundColor Red
exit 1
