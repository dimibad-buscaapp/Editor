# Diagnostico da pagina em branco em /webeditor/ (nao altera servicos).
# pwsh -File deploy\windows\code-web\diagnose-webeditor-blank.ps1 -ProjectRoot C:\Apps\Editor

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[int]$CodeWebPort = 3200,
	[string]$PublicHost = "princyai.com"
)

$ErrorActionPreference = "Continue"
Set-Location $ProjectRoot
. (Join-Path $PSScriptRoot "Princy-CodeWeb-Build.ps1")

$base = "/webeditor"
$issues = [System.Collections.Generic.List[string]]@()
$fixes = [System.Collections.Generic.List[string]]@()

function Add-Issue([string]$msg) { $script:issues.Add($msg) }
function Add-Fix([string]$msg) { $script:fixes.Add($msg) }

Write-Host "=== Diagnostico pagina em branco (webeditor) ===" -ForegroundColor Cyan
Write-Host ""

# --- Build local ---
Write-Host "[1] Bundle workbench em out/" -ForegroundColor Cyan
$info = Get-PrincyWorkbenchBundleInfo -ProjectRoot $ProjectRoot
Write-Host ("  workbench.js: {0} bytes (bundled >= 800KB: {1})" -f $info.JsBytes, $info.IsBundled) -ForegroundColor $(if ($info.IsBundled) { 'Green' } else { 'Red' })
Write-Host ("  workbench.html: {0}" -f $info.HasHtml) -ForegroundColor $(if ($info.HasHtml) { 'Green' } else { 'Red' })
Write-Host ("  workbench.css: {0}" -f $info.HasCss) -ForegroundColor $(if ($info.HasCss) { 'Green' } else { 'Red' })

if (-not $info.IsBundled) {
	Add-Issue "workbench.js NAO e bundle esbuild ($($info.JsBytes) bytes) — tela branca tipica"
	Add-Fix "Rode compile-princy-code-web-production.ps1 (NUNCA compile-incremental depois do bundle)"
}
if (-not $info.HasHtml) {
	Add-Issue "Ausente out\vs\code\browser\workbench\workbench.html"
}
if (-not $info.HasCss) {
	Add-Issue "Ausente workbench.css apos bundle"
}

$nls = Join-Path $ProjectRoot "out\nls.messages.js"
if (-not (Test-Path $nls)) {
	Add-Issue "Ausente out\nls.messages.js (NLS do workbench)"
	Add-Fix "Reexecute bundle-server-web-out via compile-princy-code-web-production.ps1"
} else {
	Write-Host ("  nls.messages.js: OK ({0} bytes)" -f (Get-Item $nls).Length) -ForegroundColor Green
}

$extJs = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"
if (-not (Test-Path $extJs)) {
	Add-Issue "Ausente extensions\princy-ai\dist\browser\extension.js"
} else {
	Write-Host "  princy-ai extension.js: OK" -ForegroundColor Green
}

$wbHtmlDisk = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.html"
if (Test-Path $wbHtmlDisk) {
	$diskHtml = Get-Content $wbHtmlDisk -Raw
	if ($diskHtml -match 'princyai\.serverBasePath' -and $diskHtml -notmatch '\{\{WORKBENCH_BUILTIN_EXTENSIONS\}\}') {
		Add-Issue "out/workbench.html corrompido no disco (JSON baked sem placeholder)"
		Add-Fix "pwsh -File deploy\windows\code-web\restore-workbench-html-placeholder.ps1"
	}
}

# --- Servico NSSM / modo DEV ---
Write-Host "`n[2] Servico PrincyAiCodeWeb" -ForegroundColor Cyan
$svc = Get-Service PrincyAiCodeWeb -ErrorAction SilentlyContinue
if (-not $svc) {
	Add-Issue "Servico PrincyAiCodeWeb nao instalado"
} else {
	Write-Host ("  Status: {0}" -f $svc.Status) -ForegroundColor $(if ($svc.Status -eq 'Running') { 'Green' } else { 'Red' })
}
try {
	$nssm = (Get-Command nssm.exe -ErrorAction SilentlyContinue).Source
	if (-not $nssm) { $nssm = "${env:ProgramFiles}\nssm\nssm.exe" }
	if (Test-Path $nssm) {
		$envRaw = & $nssm get PrincyAiCodeWeb AppEnvironmentExtra 2>$null
		if ($envRaw -match 'VSCODE_DEV=1') {
			Add-Issue "NSSM com VSCODE_DEV=1 (modo DEV = import maps, tela branca se bundle existir)"
			Add-Fix "Reinstale servico: fix-princy-code-web-service.ps1 com bundle PROD valido"
			Write-Host "  NSSM: VSCODE_DEV=1 DETECTADO" -ForegroundColor Red
		} else {
			Write-Host "  NSSM: sem VSCODE_DEV (modo PROD esperado)" -ForegroundColor Green
		}
	}
} catch { }

# --- HTTP ---
Write-Host "`n[3] HTTP local e assets" -ForegroundColor Cyan
$editorUrl = "http://127.0.0.1:${CodeWebPort}${base}/"
$staticJs = "http://127.0.0.1:${CodeWebPort}${base}/static/out/vs/code/browser/workbench/workbench.js"
$staticCss = "http://127.0.0.1:${CodeWebPort}${base}/static/out/vs/code/browser/workbench/workbench.css"
$staticNls = "http://127.0.0.1:${CodeWebPort}${base}/static/out/nls.messages.js"
$wrongJs = "http://127.0.0.1:${CodeWebPort}${base}/out/vs/code/browser/workbench/workbench.js"

foreach ($pair in @(
	@{ L = "Editor HTML"; U = $editorUrl; NeedMeta = $true },
	@{ L = "workbench.js /static/"; U = $staticJs; NeedMeta = $false },
	@{ L = "workbench.css /static/"; U = $staticCss; NeedMeta = $false },
	@{ L = "nls.messages.js"; U = $staticNls; NeedMeta = $false }
)) {
	try {
		$r = Invoke-WebRequest $pair.U -UseBasicParsing -TimeoutSec 20
		$ok = $r.StatusCode -eq 200
		if ($pair.NeedMeta) {
			$meta = $r.Content -match 'vscode-workbench-web-configuration'
			if (-not $meta) {
				$ok = $false
				Add-Issue "HTML sem meta vscode-workbench-web-configuration (servidor errado ou 403?)"
			}
			if ($r.Content -match '<body[^>]*>([\s\S]*?)</body>' -and $Matches[1] -match 'princyai\.|extensionPath') {
				$ok = $false
				Add-Issue "HTML corrompido: JSON do package.json visivel no body (patch meta antigo quebrou workbench.html)"
				Add-Fix "pwsh -File deploy\windows\code-web\fix-workbench-html-corruption.ps1 -ProjectRoot $ProjectRoot"
			}
			if ($r.Content -match 'src="([^"]*workbench\.js[^"]*)"') {
				Write-Host ("  script no HTML: {0}" -f $Matches[1]) -ForegroundColor DarkGray
			}
		}
		Write-Host ("  {0}: HTTP {1}" -f $pair.L, $r.StatusCode) -ForegroundColor $(if ($ok) { 'Green' } else { 'Red' })
		if (-not $ok) { Add-Issue "$($pair.L) falhou: $($pair.U)" }
	}
	catch {
		Write-Host ("  {0}: ERRO {1}" -f $pair.L, $_.Exception.Message) -ForegroundColor Red
		Add-Issue "$($pair.L): $($_.Exception.Message)"
	}
}

try {
	$w = Invoke-WebRequest $wrongJs -UseBasicParsing -TimeoutSec 8
	if ($w.StatusCode -eq 200) {
		Add-Issue "workbench.js responde SEM /static/ — HTML/base URL pode estar errado"
	}
} catch { }

# --- Caddy ---
Write-Host "`n[4] Caddy" -ForegroundColor Cyan
$caddy = "C:\Caddy\Caddyfile"
if (Test-Path $caddy) {
	$ct = Get-Content $caddy -Raw
	if ($ct -match 'handle_path\s+/webeditor') {
		Add-Issue "Caddyfile usa handle_path /webeditor (strip path = assets 404 = branco)"
		Add-Fix "Copie Caddyfile do repo e Restart-Service PrincyCaddy"
	} else {
		Write-Host "  Caddyfile: sem handle_path /webeditor" -ForegroundColor Green
	}
}
try {
	$r = Invoke-WebRequest "https://${PublicHost}${base}/" -UseBasicParsing -TimeoutSec 25
	$meta = $r.Content -match 'vscode-workbench-web-configuration'
	Write-Host ("  HTTPS editor: HTTP {0} meta={1}" -f $r.StatusCode, $meta) -ForegroundColor $(if ($meta) { 'Green' } else { 'Red' })
	if (-not $meta) { Add-Issue "HTTPS sem HTML workbench valido" }
}
catch {
	Add-Issue "HTTPS editor: $($_.Exception.Message)"
}

# --- Logs ---
Write-Host "`n[5] Logs (ultimas linhas)" -ForegroundColor Cyan
$errLog = Join-Path $ProjectRoot "logs\code-web.err.log"
if (Test-Path $errLog) {
	Get-Content $errLog -Tail 8 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($issues.Count -eq 0) {
	Write-Host "Nenhum problema estrutural detectado. Se ainda branco: F12 Console no browser." -ForegroundColor Green
	exit 0
}

Write-Host ("{0} problema(s):" -f $issues.Count) -ForegroundColor Red
$issues | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
if ($fixes.Count -gt 0) {
	Write-Host "Correcao recomendada:" -ForegroundColor Yellow
	$fixes | Select-Object -Unique | ForEach-Object { Write-Host "  -> $_" -ForegroundColor Yellow }
}
Write-Host ""
Write-Host "Comando unico:" -ForegroundColor Cyan
Write-Host "  pwsh -File deploy\windows\code-web\fix-webeditor-blank-page.ps1 -ProjectRoot $ProjectRoot" -ForegroundColor White
exit 1
