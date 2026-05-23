# Pente fino Code-OSS Web (Princy) porta 3200 - tela branca, 502, base path, compile, Caddy, NSSM.
# Admin VPS:
#   powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\audit-code-web-ultra.ps1
#   powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\audit-code-web-ultra.ps1 -Fix

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[int]$CodeWebPort = 3200,
	[string]$EditorBasePath = "/webeditor",
	[string]$PublicHost = "princyai.com",
	[switch]$Fix
)

$ErrorActionPreference = "Continue"
. (Join-Path $PSScriptRoot "..\princy-hosts.ps1")
. (Join-Path $PSScriptRoot "Princy-CodeWeb-Build.ps1")

$base = $EditorBasePath.Trim()
if (-not $base.StartsWith('/')) { $base = "/$base" }

$issues = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()

function Add-Issue { param([string]$Msg) $script:issues.Add($Msg) }
function Add-Warn { param([string]$Msg) $script:warnings.Add($Msg) }

function Get-NssmExe {
	$cmd = Get-Command nssm.exe -ErrorAction SilentlyContinue
	if ($cmd) { return $cmd.Source }
	foreach ($p in @("${env:ProgramFiles}\nssm\nssm.exe", "${env:ProgramFiles(x86)}\nssm\nssm.exe")) {
		if (Test-Path $p) { return $p }
	}
	return $null
}

function Test-PortListening {
	param([int]$Port)
	return [bool](netstat -ano | Select-String "LISTENING" | Select-String ":$Port ")
}

function Test-HttpProbe {
	param(
		[string]$Label,
		[string]$Url,
		[switch]$RequireWorkbench,
		[switch]$AllowNotFound
	)
	try {
		$r = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 20 -MaximumRedirection 5
		$hasWb = $r.Content -match 'WORKBENCH_WEB_CONFIGURATION|serverBasePath'
		$ok = $r.StatusCode -eq 200
		if ($RequireWorkbench -and -not $hasWb) { $ok = $false }
		$color = if ($ok) { 'Green' } else { 'Yellow' }
		Write-Host ("  {0}: HTTP {1} len={2} workbench={3}" -f $Label, $r.StatusCode, $r.Content.Length, $hasWb) -ForegroundColor $color
		if (-not $ok -and $RequireWorkbench) { Add-Issue "$Label - HTML sem WORKBENCH ($Url)" }
		return $ok
	}
	catch {
		$code = $_.Exception.Response.StatusCode.value__
		if ($AllowNotFound -and $code -eq 404) {
			Write-Host ("  {0}: HTTP 404 (esperado em alguns probes)" -f $Label) -ForegroundColor DarkGray
			return $true
		}
		Write-Host ("  {0}: FALHA - {1}" -f $Label, $_.Exception.Message) -ForegroundColor Red
		Add-Issue "$Label - $Url - $($_.Exception.Message)"
		return $false
	}
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AUDIT Code Web (Princy) :3200" -ForegroundColor Cyan
Write-Host "  URL: https://$PublicHost$base/" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- 1) Artefatos de compile ---
Write-Host "[1] Compile (out/)" -ForegroundColor Cyan
$build = Get-PrincyCodeWebProdBuildStatus -ProjectRoot $ProjectRoot
$artifacts = @{
	"server-main.js" = $build.ServerMain
	"workbench-dev.html" = $build.WorkbenchDev
	"workbench.html (PROD)" = $build.WorkbenchHtml
	"workbench.css (browser)" = $build.WorkbenchCss
	"workbench.js (browser)" = $build.WorkbenchJs
	"workbench.web.main.css (legado)" = $build.WorkbenchCssLegacy
}
foreach ($name in $artifacts.Keys) {
	$ok = $artifacts[$name]
	$color = if ($ok) { 'Green' } else { if ($name -match 'server-main|workbench\.html') { 'Red' } else { 'Yellow' } }
	Write-Host ("  {0}: {1}" -f $name, $(if ($ok) { 'OK' } else { 'AUSENTE' })) -ForegroundColor $color
}
$hasProd = $build.HasProd
if (-not $build.ServerMain) {
	Add-Issue "Compile ausente - rode: npm run compile-incremental; npm run bundle-server-web-out; npm run compile-web"
}
if ($build.WorkbenchJs -and -not $build.WorkbenchCss -and -not $build.WorkbenchCssLegacy) {
	Add-Issue "workbench.css AUSENTE (so JS/tsc) - /webeditor/ fica branco; log: File not found workbench.css"
	Add-Warn "Correcao rapida: compile-princy-code-web-production.ps1 -BundleOnly (10-30 min)"
}
if (-not $hasProd) {
	Add-Issue "Compile PRODUCAO incompleto (falta workbench.html ou bundle CSS+JS) - browser fica branco/lento em modo DEV"
	Add-Warn "Correcao: deploy\windows\code-web\compile-princy-code-web-production.ps1 (30-90 min)"
}

# --- 1b) Extensao Princy IA no bundle ---
Write-Host ""
Write-Host "[1b] Extensao princy-ai (tema + chat Cursor-like)" -ForegroundColor Cyan
$extJs = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"
$scannerJs = Join-Path $ProjectRoot "out\vs\workbench\services\extensionManagement\browser\builtinExtensionsScannerService.js"
if (Test-Path $extJs) {
	Write-Host "  extension.js: OK" -ForegroundColor Green
} else {
	Add-Issue "extensions\princy-ai\dist\browser\extension.js AUSENTE - rode npm run compile-web"
	Write-Host "  extension.js: AUSENTE" -ForegroundColor Red
}
if (Test-Path $scannerJs) {
	if (Select-String -Path $scannerJs -Pattern '"princy-ai"' -Quiet) {
		Write-Host "  princy-ai no bundle builtin: OK" -ForegroundColor Green
	} else {
		Add-Issue "princy-ai NAO esta em builtinExtensionsScannerService.js - visual fica VS Code padrao (recompile: compile-web antes de bundle-server-web-out)"
		Write-Host "  princy-ai no bundle builtin: AUSENTE" -ForegroundColor Red
	}
} elseif ($build.ServerMain) {
	Add-Issue "builtinExtensionsScannerService.js ausente - rode npm run bundle-server-web-out"
	Write-Host "  builtinExtensionsScannerService.js: AUSENTE" -ForegroundColor Red
}

# --- 2) Servico Windows ---
Write-Host ""
Write-Host "[2] Servico PrincyAiCodeWeb" -ForegroundColor Cyan
$svc = Get-Service PrincyAiCodeWeb -ErrorAction SilentlyContinue
if (-not $svc) {
	Add-Issue "Servico PrincyAiCodeWeb nao instalado - fix-princy-code-web-service.ps1"
	Write-Host "  Servico: NAO INSTALADO" -ForegroundColor Red
} else {
	Write-Host ("  Status: {0}" -f $svc.Status) -ForegroundColor $(if ($svc.Status -eq 'Running') { 'Green' } else { 'Red' })
	if ($svc.Status -ne 'Running') { Add-Issue "PrincyAiCodeWeb nao esta Running" }
}

if (-not (Test-PortListening -Port $CodeWebPort)) {
	Add-Issue "Porta $CodeWebPort nao escuta - processo Code Web parado ou crash"
} else {
	Write-Host "  Porta ${CodeWebPort}: LISTENING" -ForegroundColor Green
}

$nssm = Get-NssmExe
if ($nssm) {
	$params = & $nssm get PrincyAiCodeWeb AppParameters 2>$null
	$appDir = & $nssm get PrincyAiCodeWeb AppDirectory 2>$null
	$envExtra = & $nssm get PrincyAiCodeWeb AppEnvironmentExtra 2>$null
	if ($params -match [regex]::Escape($base)) {
		Write-Host "  NSSM --server-base-path $base : OK" -ForegroundColor Green
	} else {
		Add-Issue "NSSM sem --server-base-path $base (editor na raiz :3200 = tela branca via HTTPS)"
		Write-Host "  NSSM params: $params" -ForegroundColor DarkYellow
	}
	if ($envExtra -match 'VSCODE_DEV=1') {
		if ($hasProd) {
			Add-Warn "NSSM tem VSCODE_DEV=1 mas existe compile PROD - reinstale servico (fix-princy-code-web-service.ps1)"
		} else {
			Add-Issue "NSSM VSCODE_DEV=1 sem bundle PROD - centenas de modulos JS falham (tela branca)"
		}
	} elseif ($hasProd) {
		Write-Host "  NSSM env: sem VSCODE_DEV (producao OK)" -ForegroundColor Green
	}
	if ($appDir -and $appDir.Trim() -ne $ProjectRoot) {
		Add-Warn "NSSM AppDirectory=$appDir (esperado $ProjectRoot)"
	}
} else {
	Add-Warn "nssm.exe nao encontrado"
}

$logOut = Join-Path $ProjectRoot "logs\code-web.out.log"
$logErr = Join-Path $ProjectRoot "logs\code-web.err.log"
if (Test-Path $logOut) {
	$line = Select-String -Path $logOut -Pattern "Web UI available" | Select-Object -Last 1
	if ($line) {
		if ($line.Line -match [regex]::Escape($base)) {
			Write-Host ("  Log: {0}" -f $line.Line.Trim()) -ForegroundColor Green
		} else {
			Add-Issue "Log mostra Web UI na RAIZ - falta $base no URL"
			Write-Host ("  Log: {0}" -f $line.Line.Trim()) -ForegroundColor Red
		}
	}
}
if (Test-Path $logErr) {
	$tail = Get-Content $logErr -Tail 8 -ErrorAction SilentlyContinue
	$fatal = $tail | Where-Object { $_ -match 'Error|ENOENT|EADDRINUSE|Cannot find module' }
	if ($fatal) {
		Add-Warn "code-web.err.log tem erros recentes - veja logs\code-web.err.log"
		Write-Host "  --- code-web.err.log (ultimas linhas) ---" -ForegroundColor DarkYellow
		$tail | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkYellow }
	}
}

# --- 3) Caddy ---
Write-Host ""
Write-Host "[3] Caddy /webeditor" -ForegroundColor Cyan
$caddyFile = "C:\Caddy\Caddyfile"
$repoCaddy = Join-Path $ProjectRoot "deploy\windows\code-web\Caddyfile"
if (Test-Path $caddyFile) {
	$ct = Get-Content $caddyFile -Raw
	if ($ct -match 'handle_path\s+/webeditor') {
		Add-Issue "Caddyfile usa handle_path /webeditor - REMOVE (strip path = 404 em JS = tela branca)"
		Write-Host "  Caddy: ERRO handle_path /webeditor" -ForegroundColor Red
	} elseif ($ct -match 'handle\s+/webeditor') {
		Write-Host "  Caddy: OK handle /webeditor*" -ForegroundColor Green
	} else {
		Add-Issue "Caddyfile sem handle /webeditor*"
	}
} else {
	Add-Issue "C:\Caddy\Caddyfile ausente - copie de deploy\windows\code-web\Caddyfile"
}
if (Test-Path $repoCaddy) {
	$repoHash = (Get-FileHash $repoCaddy -Algorithm SHA256).Hash
	$liveHash = if (Test-Path $caddyFile) { (Get-FileHash $caddyFile -Algorithm SHA256).Hash } else { '' }
	if ($liveHash -ne $repoHash) {
		Add-Warn "Caddyfile em C:\Caddy difere do repo - Copy-Item e Restart-Service PrincyCaddy"
	}
}
$caddySvc = Get-Service PrincyCaddy -ErrorAction SilentlyContinue
if ($caddySvc) {
	Write-Host ("  PrincyCaddy: {0}" -f $caddySvc.Status) -ForegroundColor $(if ($caddySvc.Status -eq 'Running') { 'Green' } else { 'Red' })
	if ($caddySvc.Status -ne 'Running') { Add-Issue "PrincyCaddy parado - HTTPS/webeditor timeout ou 502" }
}

# --- 4) HTTP probes ---
Write-Host ""
Write-Host "[4] Probes HTTP" -ForegroundColor Cyan
if (Test-PortListening -Port $CodeWebPort) {
	Test-HttpProbe "Local editor" "http://127.0.0.1:${CodeWebPort}${base}/" -RequireWorkbench | Out-Null
	Test-HttpProbe "Local raiz (deve redirecionar)" "http://127.0.0.1:${CodeWebPort}/" | Out-Null
	Test-HttpProbe "Agent proxy" "http://127.0.0.1:${CodeWebPort}/princy-api/api/agent/health" | Out-Null
	$assetUrl = "http://127.0.0.1:${CodeWebPort}${base}/static/out/vs/code/browser/workbench/workbench.js"
	Test-HttpProbe "Asset workbench.js" $assetUrl | Out-Null
	if (-not (Test-HttpProbe "Asset workbench.js HEAD" $assetUrl)) {
		Add-Warn "workbench.js nao encontrado nesse path - compile-web ou base path incorreto"
	}
}
Test-HttpProbe "HTTPS editor" "https://${PublicHost}${base}/" -RequireWorkbench | Out-Null
Test-HttpProbe "HTTPS landing (NAO e editor)" "https://${PublicHost}/" | Out-Null
Test-HttpProbe "HTTPS princy-api" "https://${PublicHost}/princy-api/api/agent/health" | Out-Null

# --- 5) URLs erradas comuns ---
Write-Host ""
Write-Host "[5] Armadilhas (tela branca)" -ForegroundColor Cyan
Write-Host "  ERRADO: https://princyai.com/  -> landing :3220 (React, nao VS Code)" -ForegroundColor DarkGray
Write-Host "  ERRADO: http://IP:3200/       -> sem /webeditor (redirect/404 assets)" -ForegroundColor DarkGray
Write-Host "  ERRADO: cache SW da era editor na raiz -> Ctrl+Shift+R ou aba anonima" -ForegroundColor DarkGray
Write-Host "  CERTO:  https://princyai.com/webeditor/" -ForegroundColor Green

$envFile = Join-Path $ProjectRoot "apps\ai-dashboard\.env"
if (Test-Path $envFile) {
	$et = Get-Content $envFile -Raw
	if ($et -match 'CODE_WEB_URL' -and $et -match 'princyai\.com' -and $et -notmatch 'webeditor') {
		Add-Warn ".env CODE_WEB_URL sem /webeditor"
	}
}

# --- Resumo ---
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($issues.Count -eq 0) {
	Write-Host "  Nenhum problema CRITICO detectado." -ForegroundColor Green
} else {
	Write-Host ("  {0} problema(s) CRITICO(s):" -f $issues.Count) -ForegroundColor Red
	$issues | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red }
}
if ($warnings.Count -gt 0) {
	Write-Host ("  {0} aviso(s):" -f $warnings.Count) -ForegroundColor Yellow
	$warnings | ForEach-Object { Write-Host "    - $_" -ForegroundColor Yellow }
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Boot log no browser: https://${PublicHost}${base}/log/?autostart=1" -ForegroundColor Cyan
Write-Host ""

if ($Fix -and $issues.Count -gt 0) {
	Write-Host "Executando boot-code-web-doctor.ps1 ..." -ForegroundColor Cyan
	$doctor = Join-Path $ProjectRoot "deploy\windows\code-web\boot-code-web-doctor.ps1"
	if (-not $hasProd) {
		& powershell -ExecutionPolicy Bypass -File $doctor -ProjectRoot $ProjectRoot -RunProductionCompile
	} else {
		& powershell -ExecutionPolicy Bypass -File $doctor -ProjectRoot $ProjectRoot
	}
	exit $LASTEXITCODE
}

exit $(if ($issues.Count -gt 0) { 1 } else { 0 })
