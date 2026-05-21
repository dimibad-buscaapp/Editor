# Reinicia servicos Princy (requer Admin se instalados via NSSM)
param(
	[switch]$StopOnly,
	[switch]$StartOnly
)

$services = @('PrincyCaddy', 'PrincyAiCodeWeb', 'PrincyAiAgentBackend')

foreach ($name in $services) {
	$svc = Get-Service $name -ErrorAction SilentlyContinue
	if (-not $svc) {
		Write-Host "Servico $name nao instalado (ignore)."
		continue
	}
	if ($StartOnly) {
		if ($svc.Status -ne 'Running') {
			Start-Service $name
			Write-Host "Iniciado $name"
		}
		continue
	}
	if (-not $StopOnly) {
		Restart-Service $name -Force -ErrorAction SilentlyContinue
		Write-Host "Reiniciado $name"
	} else {
		Stop-Service $name -Force -ErrorAction SilentlyContinue
		Write-Host "Parado $name"
	}
}

if (-not $StopOnly) {
	Start-Sleep -Seconds 3
	powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check-princy-ports.ps1")
}
