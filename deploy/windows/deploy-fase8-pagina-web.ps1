# Deploy Fase 8 - sites web (preview + publicar)
# Admin no VPS: powershell -ExecutionPolicy Bypass -File deploy\windows\deploy-fase8-pagina-web.ps1

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$SkipGitPull,
	[switch]$SkipExtensionSync,
	[switch]$SkipAgentReinstall
)

$ErrorActionPreference = "Stop"

function Get-CaddyExe {
	$cmd = Get-Command caddy.exe -ErrorAction SilentlyContinue
	if ($cmd) { return $cmd.Source }
	if (Test-Path "C:\Caddy\caddy.exe") { return "C:\Caddy\caddy.exe" }
	throw "caddy.exe nao encontrado. Instale Caddy ou copie para C:\Caddy\caddy.exe"
}

function Reload-Caddy {
	param([string]$Root)
	$src = Join-Path $Root "deploy\windows\code-web\Caddyfile"
	if (-not (Test-Path $src)) {
		throw "Caddyfile ausente: $src"
	}
	New-Item -ItemType Directory -Force "C:\Caddy" | Out-Null
	Copy-Item $src "C:\Caddy\Caddyfile" -Force
	$caddy = Get-CaddyExe
	Write-Host "Caddy: $caddy" -ForegroundColor DarkGray
	& $caddy validate --config C:\Caddy\Caddyfile
	$svc = Get-Service PrincyCaddy -ErrorAction SilentlyContinue
	if ($svc) {
		Restart-Service PrincyCaddy
		Write-Host "PrincyCaddy reiniciado." -ForegroundColor Green
	} else {
		& $caddy reload --config C:\Caddy\Caddyfile
		Write-Host "Caddy reload OK." -ForegroundColor Green
	}
}

Write-Host ""
Write-Host "=== Deploy Fase 8 - Pagina web ===" -ForegroundColor Cyan
Write-Host "Raiz: $ProjectRoot"
Write-Host ""

if (-not $SkipGitPull -and (Test-Path (Join-Path $ProjectRoot ".git"))) {
	Write-Host "[1/6] git pull ..." -ForegroundColor Cyan
	Set-Location $ProjectRoot
	git pull --no-rebase origin main
}

Write-Host "[2/6] Pastas princy-sites ..." -ForegroundColor Cyan
$sitesScript = Join-Path $ProjectRoot "deploy\windows\ensure-princy-sites-folder.ps1"
if (-not (Test-Path $sitesScript)) {
	throw "Script ausente: $sitesScript - faca git pull primeiro."
}
powershell -ExecutionPolicy Bypass -File $sitesScript -ProjectRoot $ProjectRoot

Write-Host "[3/6] Build agent backend ..." -ForegroundColor Cyan
$buildScript = Join-Path $ProjectRoot "deploy\windows\agent-backend\build-princy-agent-backend.ps1"
powershell -ExecutionPolicy Bypass -File $buildScript -ProjectRoot $ProjectRoot

Write-Host "[4/6] Caddy (rotas /princy-sites*) ..." -ForegroundColor Cyan
Reload-Caddy -Root $ProjectRoot

if (-not $SkipAgentReinstall) {
	Write-Host "[5/6] Servico PrincyAiAgentBackend ..." -ForegroundColor Cyan
	$fixScript = Join-Path $ProjectRoot "deploy\windows\agent-backend\fix-princy-agent-backend-service.ps1"
	powershell -ExecutionPolicy Bypass -File $fixScript -ProjectRoot $ProjectRoot
} else {
	Write-Host "[5/6] Reinicio simples do agent ..." -ForegroundColor Cyan
	Restart-Service PrincyAiAgentBackend -ErrorAction SilentlyContinue
	Start-Sleep -Seconds 5
}

if (-not $SkipExtensionSync) {
	Write-Host "[6/6] Extensao princy-ai -> out/extensions ..." -ForegroundColor Cyan
	$extJs = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"
	if (-not (Test-Path $extJs)) {
		Write-Host "  A compilar extensao (npm run compile-web na raiz) ..." -ForegroundColor Yellow
		Set-Location $ProjectRoot
		npm run compile-web
	}
	$syncScript = Join-Path $ProjectRoot "deploy\windows\code-web\sync-princy-ai-out-extensions.ps1"
	powershell -ExecutionPolicy Bypass -File $syncScript -ProjectRoot $ProjectRoot
} else {
	Write-Host "[6/6] Extensao ignorada (-SkipExtensionSync)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=== Verificacao ===" -ForegroundColor Cyan
$checks = @(
	@{ Label = "Agent local /api/agent/health"; Url = "http://127.0.0.1:3210/api/agent/health" },
	@{ Label = "Sites local /api/sites"; Url = "http://127.0.0.1:3210/api/sites" },
	@{ Label = "Sites publico /princy-api"; Url = "https://princyai.com/princy-api/api/sites" }
)
$allOk = $true
foreach ($c in $checks) {
	try {
		$r = Invoke-RestMethod $c.Url -TimeoutSec 20
		$ok = $null -ne $r
		if ($c.Url -match '/api/sites' -and $r.ok -ne $true) { $ok = $false }
		$color = if ($ok) { 'Green' } else { 'Yellow' }
		Write-Host ("  OK  {0}" -f $c.Label) -ForegroundColor $color
	} catch {
		$allOk = $false
		Write-Host ("  FALHA {0}: {1}" -f $c.Label, $_.Exception.Message) -ForegroundColor Red
	}
}

Write-Host ""
if ($allOk) {
	Write-Host "Fase 8 deploy concluido." -ForegroundColor Green
	Write-Host "Preview:  https://princyai.com/princy-sites-preview/{slug}/"
	Write-Host "Publicado: https://princyai.com/princy-sites/{slug}/"
} else {
	Write-Host "Deploy com falhas - veja logs:" -ForegroundColor Yellow
	Write-Host "  C:\Apps\Editor\logs\agent-backend.err.log"
	Write-Host '  cd C:\Apps\Editor\apps\ai-dashboard; $env:API_PORT=3210; node dist\backend\server.js'
	exit 1
}
