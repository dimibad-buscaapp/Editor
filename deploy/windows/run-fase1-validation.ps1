# Executa Gates 0-2 da Fase 1 (HTTP + infra + chat API + stack-probes).
# Admin recomendado no VPS.

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[switch]$SkipPublicHttps,
	[switch]$SkipComposer,
	[switch]$SkipStackProbes
)

$ErrorActionPreference = "Continue"
$root = if (Test-Path $ProjectRoot) { $ProjectRoot } else { Split-Path (Split-Path $PSScriptRoot -Parent) -Parent }
if (-not (Test-Path (Join-Path $root "package.json"))) {
	$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$scripts = @{
	Gate0 = Join-Path $PSScriptRoot "test-princy-phase1.ps1"
	Gate1 = Join-Path $PSScriptRoot "verify-princy-webeditor.ps1"
	Gate2 = Join-Path $PSScriptRoot "code-web\verify-princy-chat-api.ps1"
}

$failed = @()

function Invoke-Gate {
	param([string]$Name, [string]$Path, [string[]]$ExtraArgs)
	Write-Host ""
	Write-Host "========== $Name ==========" -ForegroundColor Cyan
	if (-not (Test-Path $Path)) {
		Write-Host "Script ausente: $Path" -ForegroundColor Red
		$script:failed += $Name
		return
	}
	$argList = @('-ExecutionPolicy', 'Bypass', '-File', $Path) + $ExtraArgs
	& powershell @argList
	if ($LASTEXITCODE -ne 0) { $script:failed += $Name }
}

Write-Host "=== Princy Fase 1 - validacao completa ===" -ForegroundColor Cyan
Write-Host "ProjectRoot: $root"

$gate0Args = @('-ProjectRoot', $root)
if ($SkipPublicHttps) { $gate0Args += '-SkipPublicHttps' }

Invoke-Gate "Gate 0 (HTTP)" $scripts.Gate0 $gate0Args
Invoke-Gate "Gate 1 (webeditor)" $scripts.Gate1 @('-ProjectRoot', $root)
$gate2Args = @('-ProjectRoot', $root)
if ($SkipComposer) { $gate2Args += '-SkipComposer' }
Invoke-Gate "Gate 2 (chat API)" $scripts.Gate2 $gate2Args

if (-not $SkipStackProbes) {
	Write-Host ""
	Write-Host "========== stack-probes ==========" -ForegroundColor Cyan
	try {
		$probes = Invoke-RestMethod "http://127.0.0.1:3210/api/editor/stack-probes" -TimeoutSec 30
		$probes.probes | ForEach-Object {
			$c = if ($_.ok) { 'Green' } else { 'Red' }
			Write-Host ("  {0}: ok={1} {2}ms - {3}" -f $_.name, $_.ok, $_.ms, $_.hint) -ForegroundColor $c
			if (-not $_.ok) { $failed += "stack-probe:$($_.name)" }
		}
	}
	catch {
		Write-Host "stack-probes: FALHA - $($_.Exception.Message)" -ForegroundColor Red
		$failed += 'stack-probes'
	}
}

Write-Host ""
if ($failed.Count -eq 0) {
	Write-Host "Fase 1 Gates 0-2 PASS. Complete Gate 3 no browser (FASE1-ESTABILIZAR.md)." -ForegroundColor Green
	exit 0
}
Write-Host "Falhas: $($failed -join ', ')" -ForegroundColor Red
Write-Host "Ver deploy\windows\FASE1-ESTABILIZAR.md" -ForegroundColor Cyan
exit 1
