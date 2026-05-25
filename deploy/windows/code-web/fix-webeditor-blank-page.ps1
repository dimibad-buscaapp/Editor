# Recupera pagina em branco no /webeditor/ (workbench.js 404 ou bundle corrompido).
# Admin VPS:
#   pwsh -ExecutionPolicy Bypass -File deploy\windows\code-web\fix-webeditor-blank-page.ps1 -ProjectRoot C:\Apps\Editor

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$BundleOnly
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

. (Join-Path $PSScriptRoot "Princy-CodeWeb-Build.ps1")
. (Join-Path $PSScriptRoot "..\princy-ui-revision.ps1")

$base = "/webeditor"
$port = 3200
$RevMarker = Get-PrincyUiRevision

Write-Host "=== Fix webeditor pagina em branco ===" -ForegroundColor Magenta

function Test-Asset {
	param([string]$Label, [string]$Url)
	try {
		$r = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 25
		$ok = $r.StatusCode -eq 200 -and $r.Content.Length -gt 1000
		$color = if ($ok) { 'Green' } else { 'Red' }
		Write-Host ("  {0}: HTTP {1} len={2}" -f $Label, $r.StatusCode, $r.Content.Length) -ForegroundColor $color
		return $ok
	}
	catch {
		Write-Host ("  {0}: FALHA {1}" -f $Label, $_.Exception.Message) -ForegroundColor Red
		return $false
	}
}

Write-Host "`n[Diagnostico antes]" -ForegroundColor Cyan
$htmlOk = $false
try {
	$html = Invoke-WebRequest "http://127.0.0.1:$port$base/" -UseBasicParsing -TimeoutSec 25
	$htmlOk = $html.Content -match 'vscode-workbench-web-configuration|serverBasePath'
	Write-Host ("  HTML: HTTP {0} workbench_meta={1} bytes={2}" -f $html.StatusCode, $htmlOk, $html.Content.Length) -ForegroundColor $(if ($htmlOk) { 'Green' } else { 'Yellow' })
	if ($html.Content -match 'src="([^"]+workbench\.js[^"]*)"') {
		Write-Host ("  script workbench: {0}" -f $Matches[1]) -ForegroundColor DarkGray
	}
}
catch {
	Write-Host "  HTML: servico nao responde - $($_.Exception.Message)" -ForegroundColor Red
}

$staticJs = "http://127.0.0.1:$port$base/static/out/vs/code/browser/workbench/workbench.js"
$wrongJs = "http://127.0.0.1:$port$base/out/vs/code/browser/workbench/workbench.js"
$jsOk = Test-Asset "workbench.js (caminho correto /static/)" $staticJs
if (-not $jsOk) {
	Test-Asset "workbench.js (caminho ERRADO sem /static/)" $wrongJs | Out-Null
}

$prod = Test-PrincyCodeWebProdBuild -ProjectRoot $ProjectRoot
Write-Host ("  Build PROD local: {0}" -f $prod) -ForegroundColor $(if ($prod) { 'Green' } else { 'Red' })

if (-not $prod -or -not $jsOk) {
	Write-Host "`n[Rebuild PROD — ordem: incremental -> compile-web -> bundle (NUNCA incremental depois do bundle)]" -ForegroundColor Cyan
	$prodScript = Join-Path $PSScriptRoot "compile-princy-code-web-production.ps1"
	$args = @{ ProjectRoot = $ProjectRoot; SkipRestart = $true }
	if ($BundleOnly) { $args['BundleOnly'] = $true }
	& pwsh -NoProfile -ExecutionPolicy Bypass -File $prodScript @args
	if ($LASTEXITCODE -ne 0) { throw "compile-princy-code-web-production falhou" }
}

$prodSettings = Join-Path $ProjectRoot "deploy\windows\princy-production.settings.json"
$userSettings = Join-Path $ProjectRoot ".princy-user-data\User\settings.json"
if (Test-Path $prodSettings) {
	New-Item -ItemType Directory -Force (Split-Path $userSettings -Parent) | Out-Null
	Copy-Item $prodSettings $userSettings -Force
}

Write-Host "`n[Reiniciar PrincyAiCodeWeb + Caddy]" -ForegroundColor Cyan
& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "fix-princy-code-web-service.ps1") -ProjectRoot $ProjectRoot -Port $port | Out-Host
Restart-Service PrincyCaddy -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 5

Write-Host "`n[Diagnostico depois]" -ForegroundColor Cyan
$html2 = Invoke-WebRequest "http://127.0.0.1:$port$base/" -UseBasicParsing -TimeoutSec 25
$meta = $html2.Content -match 'vscode-workbench-web-configuration'
if (-not $meta) { throw "HTML ainda invalido apos rebuild" }
if (-not (Test-Asset "workbench.js" $staticJs)) {
	throw "workbench.js ainda inacessivel em $staticJs — veja logs\code-web.err.log"
}

Write-Host ""
Write-Host "OK. Browser: Ctrl+Shift+Delete + Ctrl+F5 em https://princyai.com/webeditor/" -ForegroundColor Green
Write-Host "  F12 Console: sem 404 em .../static/.../workbench.js" -ForegroundColor DarkGray
Write-Host "  Chat rev: $RevMarker" -ForegroundColor DarkGray
