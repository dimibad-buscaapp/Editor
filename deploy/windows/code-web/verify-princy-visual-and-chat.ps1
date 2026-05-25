# Verificacao unificada: visual r8, faixa verde, webeditor, chat API.
# Admin: pwsh -File deploy\windows\code-web\verify-princy-visual-and-chat.ps1

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$PublicHost = "princyai.com",
	[int]$CodeWebPort = 3200,
	[switch]$SkipChatApi
)

$ErrorActionPreference = "Continue"
. (Join-Path $PSScriptRoot "..\princy-ui-revision.ps1")
. (Join-Path $PSScriptRoot "..\princy-hosts.ps1")

$Rev = Get-PrincyUiRevision
$issues = @()

Write-Host "=== Verificacao Visual + Chat (Princy) ===" -ForegroundColor Cyan
Write-Host "Revisao UI esperada: $Rev" -ForegroundColor DarkGray
Write-Host ""

if (-not (Test-Path $ProjectRoot)) {
	$ProjectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
	if (-not (Test-Path (Join-Path $ProjectRoot "extensions\princy-ai"))) {
		$ProjectRoot = (Get-Location).Path
	}
}

function Resolve-PrincyBrowserExtensionJs {
	param([string]$Root)
	$candidates = @(
		(Join-Path $Root "extensions\princy-ai\dist\browser\extension.js"),
		(Join-Path $Root "out\extensions\princy-ai\dist\browser\extension.js"),
		(Join-Path $Root "extensions\princy-ai\dist\extension.js")
	)
	foreach ($p in $candidates) {
		if (Test-Path $p) { return $p }
	}
	return $null
}

$extJs = Resolve-PrincyBrowserExtensionJs -Root $ProjectRoot
$webClientJs = Join-Path $ProjectRoot "out\vs\server\node\webClientServer.js"

Write-Host "[Build / marcadores]" -ForegroundColor Cyan
if (-not $extJs) {
	$issues += "princy-ai dist/browser/extension.js ausente - npm run compile-web (ou compile-princy-code-web-production)"
	Write-Host "  dist/browser/extension.js: AUSENTE (extensions e out\extensions)" -ForegroundColor Red
} elseif ($extJs -match '\\dist\\extension\.js$' -and $extJs -notmatch '\\browser\\') {
	$issues += "so existe dist\extension.js (node) - Code Web precisa dist\browser\extension.js"
	Write-Host "  AVISO: $($extJs) e node-only; rode compile-web" -ForegroundColor Yellow
} else {
	Write-Host "  bundle: $extJs" -ForegroundColor DarkGray
	$extText = Get-Content $extJs -Raw -ErrorAction SilentlyContinue
	$extOk = $true
	foreach ($m in (Get-PrincyUiRevisionMarkers)) {
		if ($extText -notmatch [regex]::Escape($m)) {
			$extOk = $false
			$issues += "extension.js sem marcador: $m"
			Write-Host "  extension.js falta: $m" -ForegroundColor Red
		}
	}
	if ($extOk) {
		Write-Host "  extension.js: marcadores OK ($Rev)" -ForegroundColor Green
	}
}

if (-not (Test-Path $webClientJs)) {
	$issues += "webClientServer.js ausente - npm run compile-incremental"
	Write-Host "  webClientServer.js: AUSENTE" -ForegroundColor Red
} elseif ((Get-Content $webClientJs -Raw) -notmatch 'princy-deploy-strip') {
	$issues += "webClientServer.js sem strip princy-deploy-strip"
	Write-Host "  webClientServer.js: strip NAO encontrado" -ForegroundColor Red
} else {
	Write-Host "  webClientServer.js: strip faixa verde OK" -ForegroundColor Green
}

Write-Host ""
Write-Host "[HTTP editor + faixa verde]" -ForegroundColor Cyan
$webUrls = @(
	"http://127.0.0.1:${CodeWebPort}/",
	"https://${PublicHost}/webeditor/"
)
foreach ($url in $webUrls) {
	try {
		$r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 25 -MaximumRedirection 0 -ErrorAction Stop
		$hasStrip = $r.Content -match 'princy-deploy-strip|webeditor-live.*chat-live'
		$color = if ($r.StatusCode -eq 200 -and -not $hasStrip) { 'Green' } else { 'Red' }
		Write-Host ("  {0}: HTTP {1} strip={2}" -f $url, $r.StatusCode, $hasStrip) -ForegroundColor $color
		if ($r.StatusCode -ne 200) { $issues += "$url HTTP $($r.StatusCode)" }
		if ($hasStrip) { $issues += "$url contem faixa verde ou links live antigos" }
	}
	catch {
		if ($_.Exception.Response.StatusCode.value__ -eq 302) {
			$loc = $_.Exception.Response.Headers['Location']
			Write-Host ("  {0}: redirect 302 -> {1}" -f $url, $loc) -ForegroundColor Yellow
			if ($loc -match 'webeditor-live') {
				$issues += "$url redireciona para webeditor-live"
			}
		} else {
			Write-Host ("  {0}: FALHA - {1}" -f $url, $_.Exception.Message) -ForegroundColor Red
			$issues += "$url - $($_.Exception.Message)"
		}
	}
}

Write-Host ""
Write-Host "[Settings producao]" -ForegroundColor Cyan
$prodSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
if (Test-Path $prodSettings) {
	$raw = Get-Content $prodSettings -Raw
	$settingsOk = $true
	foreach ($line in @(
		'"princyai.ui.openChatOnStartup": false',
		'"princyai.ui.panelOpenOnStartup": false',
		'"workbench.secondarySideBar.defaultVisibility": "hidden"',
		'"princyai.agentEndpoint": "https://princyai.com/princy-api"'
	)) {
		if ($raw -notmatch [regex]::Escape($line)) {
			$settingsOk = $false
			$issues += "princy-production.settings.json falta: $line"
			Write-Host "  settings: falta $line" -ForegroundColor Red
		}
	}
	if ($settingsOk) {
		Write-Host "  princy-production.settings.json: arranque fechado + /princy-api OK" -ForegroundColor Green
	}
} else {
	Write-Host "  princy-production.settings.json: nao encontrado" -ForegroundColor Yellow
}

if (-not $SkipChatApi) {
	Write-Host ""
	Write-Host "[Chat API - delegar verify-princy-chat-api.ps1]" -ForegroundColor Cyan
	$chatScript = Join-Path $PSScriptRoot "verify-princy-chat-api.ps1"
	if (Test-Path $chatScript) {
		& $chatScript -ProjectRoot $ProjectRoot -PublicHost $PublicHost -CodeWebPort $CodeWebPort -SkipBuildCenterSmoke
		if ($LASTEXITCODE -ne 0) {
			$issues += "verify-princy-chat-api falhou"
		}
	} else {
		$issues += "verify-princy-chat-api.ps1 ausente"
	}
}

Write-Host ""
Write-Host "Checklist browser (apos Ctrl+F5 em https://${PublicHost}/webeditor/):" -ForegroundColor Cyan
Write-Host "  1. Sem faixa verde no rodape"
Write-Host "  2. Painel inferior fechado ao carregar"
Write-Host "  3. Chat fechado; ao abrir: visual Cursor (header #1e1e1e)"
Write-Host "  4. DevTools no painel chat: document.body.dataset.princyUiRev = $Rev"
Write-Host "  5. Mensagem de teste usa /princy-api (nao :3210 no browser)"
Write-Host ""

if ($issues.Count -gt 0) {
	Write-Host "FALHOU ($($issues.Count) problema(s)):" -ForegroundColor Red
	$issues | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
	exit 1
}

Write-Host "OK: verificacao visual + infra passou." -ForegroundColor Green
exit 0
