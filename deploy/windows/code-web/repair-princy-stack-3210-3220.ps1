# Repara landing :3220 + agent API :3210 (servicos, build, health).
# Admin VPS:
#   pwsh -ExecutionPolicy Bypass -File deploy\windows\code-web\repair-princy-stack-3210-3220.ps1 -ProjectRoot C:\Apps\Editor

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$SkipBuild
)

$ErrorActionPreference = "Continue"
$issues = [System.Collections.Generic.List[string]]@()

function Test-PortHealth {
	param([string]$Label, [string]$Url, [switch]$AllowHtml)
	try {
		$r = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 20
		$jsonOk = $r.Content -match '"ok"\s*:\s*true'
		$htmlOk = $AllowHtml -and $r.StatusCode -ge 200 -and $r.StatusCode -lt 400 -and $r.Content.Length -gt 100
		if ($jsonOk -or $htmlOk) {
			Write-Host "  [OK] $Label HTTP $($r.StatusCode)" -ForegroundColor Green
			return $true
		}
		$script:issues.Add("$Label resposta inesperada ($Url)")
		Write-Host "  [X] $Label HTTP $($r.StatusCode) sem health/html" -ForegroundColor Red
		return $false
	} catch {
		$script:issues.Add("$Label - $($_.Exception.Message)")
		Write-Host "  [X] $Label - $($_.Exception.Message)" -ForegroundColor Red
		return $false
	}
}

Write-Host "=== Repair stack Princy :3220 (index) + :3210 (agent) ===" -ForegroundColor Cyan
Set-Location $ProjectRoot

$dashboardRoot = Join-Path $ProjectRoot "apps\ai-dashboard"
$indexJs = Join-Path $dashboardRoot "dist\backend\indexServer.js"
$serverJs = Join-Path $dashboardRoot "dist\backend\server.js"

# --- Build ai-dashboard se faltar dist ---
if (-not $SkipBuild) {
	if (-not (Test-Path $indexJs) -or -not (Test-Path $serverJs)) {
		Write-Host "[Build] apps\ai-dashboard (backend + frontend) ..." -ForegroundColor Cyan
		Push-Location $dashboardRoot
		try {
			if (Test-Path "package.json") {
				npm run build 2>&1 | ForEach-Object { Write-Host $_ }
				if ($LASTEXITCODE -ne 0) { $issues.Add("npm run build em ai-dashboard falhou") }
			}
		} finally {
			Pop-Location
		}
	}
}

# --- Servico index :3220 ---
Write-Host "`n[Index :3220]" -ForegroundColor Cyan
$indexSvc = Get-Service PrincyAiIndex -ErrorAction SilentlyContinue
if (-not $indexSvc) {
	Write-Host "  Instalando PrincyAiIndex ..." -ForegroundColor Yellow
	$installIndex = Join-Path $ProjectRoot "deploy\windows\index\install-princy-index-service.ps1"
	if (Test-Path $installIndex) {
		& powershell -ExecutionPolicy Bypass -File $installIndex -ProjectRoot $ProjectRoot
	} else {
		$issues.Add("PrincyAiIndex nao instalado e script ausente")
	}
} else {
	if ($indexSvc.Status -ne 'Running') {
		try { Start-Service PrincyAiIndex -ErrorAction Stop; Start-Sleep -Seconds 4 } catch {
			$issues.Add("Start-Service PrincyAiIndex: $($_.Exception.Message)")
		}
	}
}

$listen3220 = netstat -ano | Select-String "LISTENING" | Select-String ":3220 "
if (-not $listen3220) {
	$issues.Add("Porta 3220 sem LISTEN")
	Write-Host "  [X] Nada escuta na 3220" -ForegroundColor Red
} else {
	Write-Host "  [OK] Porta 3220 LISTEN" -ForegroundColor Green
}
Test-PortHealth "Index local" "http://127.0.0.1:3220/" -AllowHtml | Out-Null

# --- Servico agent :3210 ---
Write-Host "`n[Agent :3210]" -ForegroundColor Cyan
$repairAgent = Join-Path $ProjectRoot "deploy\windows\agent-backend\repair-princy-agent-3210.ps1"
if (Test-Path $repairAgent) {
	$repairArgs = @('-ExecutionPolicy', 'Bypass', '-File', $repairAgent, '-ProjectRoot', $ProjectRoot)
	if ($SkipBuild.IsPresent) { $repairArgs += '-SkipBuild' }
	& powershell @repairArgs
	if ($LASTEXITCODE -ne 0) {
		$issues.Add("repair-princy-agent-3210.ps1 exit $LASTEXITCODE")
	}
} else {
	$issues.Add("Ausente repair-princy-agent-3210.ps1")
}

Test-PortHealth "Agent health" "http://127.0.0.1:3210/api/agent/health" | Out-Null
Test-PortHealth "Agent /api/health" "http://127.0.0.1:3210/api/health" | Out-Null

# --- Caddy (HTTPS landing + API) ---
Write-Host "`n[Caddy HTTPS]" -ForegroundColor Cyan
try {
	Test-PortHealth "HTTPS /princy-api" "https://princyai.com/princy-api/api/agent/health" | Out-Null
} catch { }
try {
	Test-PortHealth "HTTPS landing" "https://princyai.com/" -AllowHtml | Out-Null
} catch { }

Write-Host ""
if ($issues.Count -gt 0) {
	Write-Host "Pendencias ($($issues.Count)):" -ForegroundColor Red
	$issues | ForEach-Object { Write-Host "  - $_" }
	Write-Host "`nLogs: logs\index.err.log, logs\agent-backend.err.log" -ForegroundColor DarkGray
	exit 1
}

Write-Host "OK: :3220 e :3210 respondem. Proximo: deploy-princy-after-pull.ps1 ou fix-princy-editor-agora.ps1" -ForegroundColor Green
exit 0
