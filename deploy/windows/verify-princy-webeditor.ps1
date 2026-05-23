# Verifica migracao editor raiz -> /webeditor (VPS)
param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[int]$CodeWebPort = 3200,
	[string]$PublicHost = "princyai.com",
	[string]$EditorBasePath = "/webeditor"
)

$ErrorActionPreference = "Continue"
. (Join-Path $PSScriptRoot "princy-hosts.ps1")
$basePath = $EditorBasePath.Trim()
$vpsHost = $PrincyVpsIp
if (-not $basePath.StartsWith('/')) { $basePath = "/$basePath" }

Write-Host "=== Princy Ai - verificacao /webeditor ===" -ForegroundColor Cyan
Write-Host ""

$issues = @()

function Test-Http {
	param([string]$Label, [string]$Url, [switch]$RequireWorkbench)
	try {
		$r = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 15
		$hasWorkbench = $r.Content -match 'WORKBENCH_WEB_CONFIGURATION|serverBasePath|workbench\.web\.main'
		$ok = $r.StatusCode -eq 200 -and (-not $RequireWorkbench -or $hasWorkbench)
		$color = if ($ok) { 'Green' } else { 'Yellow' }
		Write-Host "$Label : HTTP $($r.StatusCode) len=$($r.Content.Length) workbench=$hasWorkbench" -ForegroundColor $color
		if (-not $ok -and $RequireWorkbench) {
			$script:issues += "$Label - HTML sem workbench (base path ou compile?)"
		}
		return $ok
	}
	catch {
		Write-Host "$Label : FALHA - $_" -ForegroundColor Red
		$script:issues += "$Label - $_"
		return $false
	}
}

# 1) Caddyfile
$caddyFile = "C:\Caddy\Caddyfile"
if (Test-Path $caddyFile) {
	$caddyText = Get-Content $caddyFile -Raw
	if ($caddyText -match 'handle_path\s+/webeditor') {
		$issues += "Caddyfile usa handle_path /webeditor - REMOVA (strip path quebra o VS Code Web)"
		Write-Host "Caddyfile: ERRO handle_path /webeditor" -ForegroundColor Red
	}
	elseif ($caddyText -match 'handle\s+/webeditor') {
		Write-Host "Caddyfile: OK (handle /webeditor*)" -ForegroundColor Green
	}
	else {
		$issues += "Caddyfile sem bloco handle /webeditor"
		Write-Host "Caddyfile: AVISO - sem handle /webeditor" -ForegroundColor Yellow
	}
}
else {
	$issues += "Caddyfile ausente em C:\Caddy\Caddyfile"
}

# 2) NSSM --server-base-path
$nssm = Get-Command nssm.exe -ErrorAction SilentlyContinue
if ($nssm) {
	$params = & $nssm.Source get PrincyAiCodeWeb AppParameters 2>$null
	if ($params -and ($params -match [regex]::Escape($basePath))) {
		Write-Host "NSSM: OK (--server-base-path $basePath)" -ForegroundColor Green
	} else {
		$issues += "NSSM PrincyAiCodeWeb sem --server-base-path $basePath (editor ainda na raiz :3200)"
		Write-Host "NSSM: ERRO - reinstale com ensure-webeditor-base-path.ps1" -ForegroundColor Red
		if ($params) { Write-Host "  $params" -ForegroundColor DarkYellow }
	}
}

# 3) Log base path
$logOut = Join-Path $ProjectRoot "logs\code-web.out.log"
if (Test-Path $logOut) {
	$line = Select-String -Path $logOut -Pattern "Web UI available" | Select-Object -Last 1
	if ($line -and $line.Line -match [regex]::Escape($basePath)) {
		Write-Host "Code Web log: OK ($($line.Line.Trim()))" -ForegroundColor Green
	}
	else {
		$issues += "Code Web sem --server-base-path $basePath (veja logs\code-web.out.log)"
		Write-Host "Code Web log: ERRO - Web UI sem $basePath" -ForegroundColor Red
		if ($line) { Write-Host "  $($line.Line.Trim())" -ForegroundColor DarkYellow }
	}
}

# 3) HTTP VPS (portas internas)
Test-Http "Index :3220" "http://${vpsHost}:$PrincyIndexPort/" | Out-Null
Test-Http "Editor $basePath" "http://${vpsHost}:${CodeWebPort}${basePath}/" -RequireWorkbench | Out-Null
Test-Http "Editor /princy-api" "http://${vpsHost}:${CodeWebPort}/princy-api/api/health" | Out-Null
Test-Http "Dashboard :3210" "http://${vpsHost}:$PrincyDashboardPort/api/health" | Out-Null

# 4) HTTP publico
Test-Http "HTTPS $basePath" "https://${PublicHost}${basePath}/" -RequireWorkbench | Out-Null
Test-Http "HTTPS /princy-api" "https://${PublicHost}/princy-api/api/health" | Out-Null

# 5) Compile
. (Join-Path $PSScriptRoot "code-web\Princy-CodeWeb-Build.ps1")
$build = Get-PrincyCodeWebProdBuildStatus -ProjectRoot $ProjectRoot
if (-not $build.WorkbenchDev) {
	$issues += "Compile ausente: out\vs\code\browser\workbench\workbench-dev.html"
	Write-Host "Compile: FALTA workbench-dev.html" -ForegroundColor Red
}
elseif (-not $build.HasProd) {
	$issues += "Compile PRODUCAO incompleto - VPS publico fica em VSCODE_DEV (tela branca). Rode compile-princy-code-web-production.ps1"
	Write-Host "Compile: DEV only (falta workbench.html ou bundle)" -ForegroundColor Yellow
}
else {
	Write-Host "Compile: OK (dev + producao)" -ForegroundColor Green
}

# 6) .env backend
$envFile = Join-Path $ProjectRoot "apps\ai-dashboard\.env"
if (Test-Path $envFile) {
	$envText = Get-Content $envFile -Raw
	if ($envText -match 'CODE_WEB_URL\s*=\s*"https?://princyai\.com"\s*$' -or $envText -match 'CODE_WEB_URL=https?://princyai\.com\s*$') {
		$issues += ".env CODE_WEB_URL sem /webeditor - use https://princyai.com/webeditor ou http://108.181.169.40:3200/webeditor"
		Write-Host ".env: CODE_WEB_URL aponta raiz (landing), nao o editor" -ForegroundColor Yellow
	}
}

Write-Host ""
if ($issues.Count -eq 0) {
	Write-Host "Nenhum problema critico detectado." -ForegroundColor Green
}
else {
	Write-Host "Problemas ($($issues.Count)):" -ForegroundColor Yellow
	$issues | ForEach-Object { Write-Host "  - $_" }
	exit 1
}
