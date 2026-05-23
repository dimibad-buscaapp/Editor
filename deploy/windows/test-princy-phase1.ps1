# Fase 1 - Gate 0: checklist HTTP minimo (webeditor + princy-api).
# Uso: powershell -ExecutionPolicy Bypass -File deploy\windows\test-princy-phase1.ps1
# Exit 0 = OK, 1 = falha (Task Scheduler / CI).

param(
	[string]$PublicHost = "princyai.com",
	[string]$EditorBasePath = "/webeditor",
	[int]$CodeWebPort = 3200,
	[int]$ApiPort = 3210,
	[int]$TimeoutSec = 20,
	[switch]$SkipPublicHttps
)

$ErrorActionPreference = "Continue"

$basePath = $EditorBasePath.Trim()
if (-not $basePath.StartsWith('/')) { $basePath = "/$basePath" }
if (-not $basePath.EndsWith('/')) { $basePath = "$basePath/" }

Write-Host "=== Princy Fase 1 - Gate 0 (HTTP) ===" -ForegroundColor Cyan
Write-Host ""

$issues = @()
$passed = 0
$total = 0

function Test-Phase1Webeditor {
	param([string]$Label, [string]$Url)
	$script:total++
	try {
		$r = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec $TimeoutSec
		$hasWorkbench = $r.Content -match 'WORKBENCH_WEB_CONFIGURATION|serverBasePath|workbench\.web\.main'
		$ok = ($r.StatusCode -eq 200) -and $hasWorkbench
		if ($ok) {
			$script:passed++
			Write-Host ("{0}: HTTP {1} workbench=OK" -f $Label, $r.StatusCode) -ForegroundColor Green
		}
		else {
			Write-Host ("{0}: HTTP {1} workbench=FALTA" -f $Label, $r.StatusCode) -ForegroundColor Red
			$script:issues += "$Label - HTML sem workbench ($Url)"
		}
		return $ok
	}
	catch {
		Write-Host ("{0}: FALHA - {1}" -f $Label, $_.Exception.Message) -ForegroundColor Red
		$script:issues += "$Label - $($_.Exception.Message)"
		return $false
	}
}

function Test-Phase1Health {
	param([string]$Label, [string]$Url)
	$script:total++
	try {
		$r = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec $TimeoutSec
		$ok = ($r.StatusCode -eq 200) -and ($r.Content -match '"ok"\s*:\s*true')
		if ($ok) {
			$script:passed++
			Write-Host ("{0}: HTTP {1} ok=true" -f $Label, $r.StatusCode) -ForegroundColor Green
		}
		else {
			Write-Host ("{0}: HTTP {1} sem ok=true" -f $Label, $r.StatusCode) -ForegroundColor Red
			$script:issues += "$Label - health JSON invalido ($Url)"
		}
		return $ok
	}
	catch {
		Write-Host ("{0}: FALHA - {1}" -f $Label, $_.Exception.Message) -ForegroundColor Red
		$script:issues += "$Label - $($_.Exception.Message)"
		return $false
	}
}

# Checklist oficial (4 URLs)
Test-Phase1Webeditor "Local Code Web" "http://127.0.0.1:${CodeWebPort}${basePath}" | Out-Null
Test-Phase1Health "Local API direta" "http://127.0.0.1:${ApiPort}/api/health" | Out-Null

if (-not $SkipPublicHttps) {
	Test-Phase1Webeditor "HTTPS webeditor" "https://${PublicHost}${basePath}" | Out-Null
	Test-Phase1Health "HTTPS /princy-api" "https://${PublicHost}/princy-api/api/health" | Out-Null
}
else {
	Write-Host "HTTPS publico: ignorado (-SkipPublicHttps)" -ForegroundColor DarkGray
}

# Proxy same-origin (editor usa /princy-api)
Test-Phase1Health "Code Web proxy /princy-api" "http://127.0.0.1:${CodeWebPort}/princy-api/api/health" | Out-Null

Write-Host ""
Write-Host ("Resultado: {0}/{1} probes OK" -f $passed, $total) -ForegroundColor $(if ($issues.Count -eq 0) { 'Green' } else { 'Yellow' })

if ($issues.Count -eq 0) {
	Write-Host "Gate 0 PASS - proximo: verify-princy-webeditor.ps1 e verify-princy-chat-api.ps1" -ForegroundColor Green
	exit 0
}

Write-Host "Gate 0 FAIL:" -ForegroundColor Red
$issues | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
Write-Host ""
Write-Host "Remediacao: deploy\windows\FASE1-ESTABILIZAR.md" -ForegroundColor Cyan
exit 1
