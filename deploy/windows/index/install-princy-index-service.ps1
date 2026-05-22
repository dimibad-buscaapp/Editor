# Servico Windows NSSM — landing index porta 3220
param([string]$ProjectRoot = "C:\Apps\Editor")

$ErrorActionPreference = "Stop"
$ServiceName = "PrincyAiIndex"
$runner = Join-Path $ProjectRoot "deploy\windows\index\run-princy-index.ps1"
$logsDir = Join-Path $ProjectRoot "logs"
New-Item -ItemType Directory -Force $logsDir | Out-Null

$nssmCmd = Get-Command nssm.exe -ErrorAction SilentlyContinue
$nssm = if ($nssmCmd) { $nssmCmd.Source } else { $null }
if (-not $nssm) {
	foreach ($p in @("${env:ProgramFiles}\nssm\nssm.exe", "C:\Tools\nssm\nssm.exe")) {
		if (Test-Path $p) { $nssm = $p; break }
	}
}
if (-not $nssm) {
	Write-Host "Instale NSSM: winget install NSSM.NSSM" -ForegroundColor Red
	exit 1
}

$existing = Get-Service $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
	if ($existing.Status -eq 'Running') { Stop-Service $ServiceName -Force }
	& $nssm remove $ServiceName confirm
	Start-Sleep -Seconds 2
}

& $nssm install $ServiceName "powershell.exe" "-NoProfile -ExecutionPolicy Bypass -File `"$runner`" -ProjectRoot `"$ProjectRoot`""
& $nssm set $ServiceName AppDirectory $ProjectRoot
& $nssm set $ServiceName AppStdout (Join-Path $logsDir "index.out.log")
& $nssm set $ServiceName AppStderr (Join-Path $logsDir "index.err.log")
& $nssm set $ServiceName Start SERVICE_AUTO_START
& $nssm set $ServiceName AppRestartDelay 5000

Start-Service $ServiceName
Write-Host "OK: $ServiceName -> http://108.181.169.40:3220" -ForegroundColor Green
