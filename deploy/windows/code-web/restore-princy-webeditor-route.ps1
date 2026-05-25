# Restaura https://princyai.com/webeditor/ (remove redirect para /webeditor-live).
# Rapido — so Caddy + restart (sem compile).
#
# pwsh -ExecutionPolicy Bypass -File deploy\windows\code-web\restore-princy-webeditor-route.ps1

param([string]$ProjectRoot = "C:\Apps\Editor")

$ErrorActionPreference = "Stop"
$caddySrc = Join-Path $PSScriptRoot "Caddyfile"
$caddyDest = "C:\Caddy\Caddyfile"

if (-not (Test-Path $caddySrc)) {
	throw "Ausente: $caddySrc"
}

Copy-Item $caddySrc $caddyDest -Force
Write-Host "OK: Caddyfile copiado -> $caddyDest" -ForegroundColor Green

$svc = Get-Service PrincyCaddy -ErrorAction SilentlyContinue
if ($svc) {
	Restart-Service PrincyCaddy -Force
	Write-Host "OK: PrincyCaddy reiniciado" -ForegroundColor Green
} else {
	Write-Host "AVISO: servico PrincyCaddy nao encontrado" -ForegroundColor Yellow
}

try {
	$r = Invoke-WebRequest "https://princyai.com/webeditor/" -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 20 -ErrorAction Stop
	Write-Host "AVISO: /webeditor/ nao redirecionou (HTTP $($r.StatusCode))" -ForegroundColor Yellow
}
catch {
	if ($_.Exception.Response.StatusCode.value__ -eq 301 -or $_.Exception.Response.StatusCode.value__ -eq 302) {
		$loc = $_.Exception.Response.Headers['Location']
		if ($loc -match 'webeditor-live') {
			Write-Host "FALHA: ainda redireciona para webeditor-live: $loc" -ForegroundColor Red
			exit 1
		}
	}
	Write-Host "OK: /webeditor/ sem redirect para webeditor-live" -ForegroundColor Green
}

Write-Host ""
Write-Host "Faixa verde: rode fix-princy-editor-agora.ps1 (PROD+bundle; NAO incremental isolado apos bundle):" -ForegroundColor Yellow
Write-Host "  pwsh -File deploy\windows\code-web\fix-princy-editor-agora.ps1 -ProjectRoot $ProjectRoot" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Editor: https://princyai.com/webeditor/" -ForegroundColor Cyan
