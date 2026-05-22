# Diagnostica e reinstala PrincyAiCodeWeb (NSSM). Execute como Administrador.
param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$ServiceName = "PrincyAiCodeWeb",
	[int]$Port = 3200
)

$ErrorActionPreference = "Continue"

function Get-NssmPath {
	$cmd = Get-Command nssm.exe -ErrorAction SilentlyContinue
	if ($cmd) { return $cmd.Source }
	foreach ($path in @(
		"${env:ProgramFiles}\nssm\nssm.exe",
		"${env:ProgramFiles(x86)}\nssm\nssm.exe",
		"C:\Tools\nssm\nssm.exe"
	)) {
		if (Test-Path $path) { return $path }
	}
	return $null
}

Write-Host "=== Fix PrincyAiCodeWeb ===" -ForegroundColor Cyan

$serverMain = Join-Path $ProjectRoot "out\server-main.js"
$workbench = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench-dev.html"
$runner = Join-Path $ProjectRoot "deploy\windows\code-web\run-princy-code-web.ps1"
$logsDir = Join-Path $ProjectRoot "logs"

if (-not (Test-Path $serverMain) -or -not (Test-Path $workbench)) {
	Write-Host "ERRO: compile ausente." -ForegroundColor Red
	Write-Host "  cd $ProjectRoot"
	Write-Host '  $env:NODE_OPTIONS="--max-old-space-size=8192"'
	Write-Host '  $env:VSCODE_SKIP_PRELAUNCH="1"'
	Write-Host "  npm run compile-web"
	exit 1
}

Write-Host "Compile: OK" -ForegroundColor Green

$stopPort = Join-Path $ProjectRoot "deploy\windows\code-web\Stop-CodeWebPort.ps1"
if (Test-Path $stopPort) {
	& powershell -ExecutionPolicy Bypass -File $stopPort -Port $Port
	if ($LASTEXITCODE -ne 0) { exit 1 }
}

$svc = Get-Service $ServiceName -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq 'Running') {
	Stop-Service $ServiceName -Force
	Start-Sleep -Seconds 2
}

if (Test-Path (Join-Path $logsDir "code-web.err.log")) {
	Write-Host "`n--- code-web.err.log (ultimas 25 linhas) ---" -ForegroundColor DarkYellow
	Get-Content (Join-Path $logsDir "code-web.err.log") -Tail 25
}

$nssm = Get-NssmPath
if (-not $nssm) {
	Write-Host "NSSM nao encontrado. Suba manualmente:" -ForegroundColor Yellow
	Write-Host "  powershell -File $runner -ProjectRoot `"$ProjectRoot`""
	exit 1
}

Write-Host "`nReinstalando servico $ServiceName ..." -ForegroundColor Cyan
if ($svc) {
	& $nssm stop $ServiceName confirm 2>$null
	Start-Sleep -Seconds 2
	& $nssm remove $ServiceName confirm 2>$null
	Start-Sleep -Seconds 3
}

New-Item -ItemType Directory -Force $logsDir | Out-Null
& $nssm install $ServiceName "powershell.exe" "-NoProfile -ExecutionPolicy Bypass -File `"$runner`" -ProjectRoot `"$ProjectRoot`" -ServerBasePath /webeditor -Dev"
& $nssm set $ServiceName AppDirectory $ProjectRoot
& $nssm set $ServiceName AppStdout (Join-Path $logsDir "code-web.out.log")
& $nssm set $ServiceName AppStderr (Join-Path $logsDir "code-web.err.log")
& $nssm set $ServiceName Start SERVICE_AUTO_START
& $nssm set $ServiceName AppRestartDelay 10000
& $nssm set $ServiceName AppThrottle 30000
& $nssm set $ServiceName AppExit Default Restart

Start-Service $ServiceName
Start-Sleep -Seconds 5
$after = Get-Service $ServiceName
Write-Host "Status: $($after.Status)" -ForegroundColor $(if ($after.Status -eq 'Running') { 'Green' } else { 'Red' })

if ($after.Status -ne 'Running') {
	Write-Host "`nTeste manual (veja o erro na tela):" -ForegroundColor Yellow
	Write-Host "  powershell -File `"$runner`" -ProjectRoot `"$ProjectRoot`""
	exit 1
}

Select-String -Path (Join-Path $logsDir "code-web.out.log") -Pattern "Web UI available" | Select-Object -Last 1
Write-Host "OK — http://127.0.0.1:$Port/webeditor/" -ForegroundColor Green
