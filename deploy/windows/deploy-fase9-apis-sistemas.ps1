# Deploy Fase 9 - API Studio (APIs e sistemas)
# Admin no VPS: powershell -ExecutionPolicy Bypass -File deploy\windows\deploy-fase9-apis-sistemas.ps1

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$SkipGitPull,
	[switch]$SkipExtensionSync,
	[switch]$SkipAgentReinstall
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Deploy Fase 9 - API Studio ===" -ForegroundColor Cyan
Write-Host "Raiz: $ProjectRoot"
Write-Host ""

if (-not $SkipGitPull -and (Test-Path (Join-Path $ProjectRoot ".git"))) {
	Write-Host "[1/4] git pull ..." -ForegroundColor Cyan
	Set-Location $ProjectRoot
	git pull --no-rebase origin main
}

Write-Host "[2/4] Build agent backend ..." -ForegroundColor Cyan
$buildScript = Join-Path $ProjectRoot "deploy\windows\agent-backend\build-princy-agent-backend.ps1"
powershell -ExecutionPolicy Bypass -File $buildScript -ProjectRoot $ProjectRoot

if (-not $SkipAgentReinstall) {
	Write-Host "[3/4] Servico PrincyAiAgentBackend ..." -ForegroundColor Cyan
	$fixScript = Join-Path $ProjectRoot "deploy\windows\agent-backend\fix-princy-agent-backend-service.ps1"
	powershell -ExecutionPolicy Bypass -File $fixScript -ProjectRoot $ProjectRoot
} else {
	Write-Host "[3/4] Reinicio simples do agent ..." -ForegroundColor Cyan
	Restart-Service PrincyAiAgentBackend -ErrorAction SilentlyContinue
	Start-Sleep -Seconds 5
}

if (-not $SkipExtensionSync) {
	Write-Host "[4/4] Extensao princy-ai -> out/extensions ..." -ForegroundColor Cyan
	$extJs = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"
	if (-not (Test-Path $extJs)) {
		Write-Host "  A compilar extensao (npm run compile-web na raiz) ..." -ForegroundColor Yellow
		Set-Location $ProjectRoot
		npm run compile-web
	}
	$syncScript = Join-Path $ProjectRoot "deploy\windows\code-web\sync-princy-ai-out-extensions.ps1"
	powershell -ExecutionPolicy Bypass -File $syncScript -ProjectRoot $ProjectRoot
} else {
	Write-Host "[4/4] Extensao ignorada (-SkipExtensionSync)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=== Verificacao ===" -ForegroundColor Cyan
$checks = @(
	@{ Label = "Agent local /api/agent/health"; Url = "http://127.0.0.1:3210/api/agent/health" },
	@{ Label = "API Studio /api/studio"; Url = "http://127.0.0.1:3210/api/studio" },
	@{ Label = "API Studio publico /princy-api"; Url = "https://princyai.com/princy-api/api/studio" }
)
$allOk = $true
foreach ($c in $checks) {
	try {
		$r = Invoke-RestMethod $c.Url -TimeoutSec 20
		$ok = $null -ne $r
		if ($c.Url -match '/api/studio' -and $r.ok -ne $true) { $ok = $false }
		$color = if ($ok) { 'Green' } else { 'Yellow' }
		Write-Host ("  OK  {0}" -f $c.Label) -ForegroundColor $color
	} catch {
		$allOk = $false
		Write-Host ("  FALHA {0}: {1}" -f $c.Label, $_.Exception.Message) -ForegroundColor Red
	}
}

Write-Host ""
if ($allOk) {
	Write-Host "Fase 9 deploy concluido." -ForegroundColor Green
	Write-Host "No chat Princy AI: modo API Studio -> Creator (api/express-api) -> Nova rota / Migrate / Testar / Swagger"
} else {
	Write-Host "Deploy com falhas - veja logs:" -ForegroundColor Yellow
	Write-Host "  C:\Apps\Editor\logs\agent-backend.err.log"
	Write-Host '  cd C:\Apps\Editor\apps\ai-dashboard; $env:API_PORT=3210; node dist\backend\server.js'
	exit 1
}
