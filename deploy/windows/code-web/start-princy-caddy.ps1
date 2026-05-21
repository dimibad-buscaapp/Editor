param(
	[string]$CaddyDir = "C:\Caddy"
)

$ErrorActionPreference = "Stop"

$caddyExe = Join-Path $CaddyDir "caddy.exe"
$configPath = Join-Path $CaddyDir "Caddyfile"

if (-not (Test-Path $caddyExe)) {
	throw "caddy.exe nao encontrado em $caddyExe. Rode install-princy-caddy.ps1 primeiro."
}
if (-not (Test-Path $configPath)) {
	throw "Caddyfile nao encontrado em $configPath"
}

$existing = Get-Process caddy -ErrorAction SilentlyContinue
if ($existing) {
	Write-Host "Caddy ja esta rodando (PID $($existing.Id -join ','))"
	exit 0
}

Write-Host "Iniciando Caddy..."
Write-Host "Config: $configPath"
& $caddyExe run --config $configPath
