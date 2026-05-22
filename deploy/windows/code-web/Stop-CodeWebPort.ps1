# Libera a porta do Code Web (3200). Execute como Administrador se necessario.
param([int]$Port = 3200)

$ErrorActionPreference = "Continue"
Write-Host "Encerrando processos na porta $Port ..." -ForegroundColor Cyan

$killed = 0
foreach ($line in netstat -ano | Select-String "LISTENING" | Select-String ":$Port\s") {
	if ($line -match '\s+(\d+)\s*$') {
		$procId = [int]$matches[1]
		if ($procId -gt 0) {
			try {
				Stop-Process -Id $procId -Force -ErrorAction Stop
				Write-Host "  PID $procId encerrado" -ForegroundColor Yellow
				$killed++
			} catch {
				Write-Host "  PID $procId : $_" -ForegroundColor DarkYellow
			}
		}
	}
}

Start-Sleep -Seconds 2
$still = netstat -ano | Select-String "LISTENING" | Select-String ":$Port\s"
if ($still) {
	Write-Host "Porta $Port ainda em uso:" -ForegroundColor Red
	$still
	exit 1
}

Write-Host "Porta $Port livre ($killed processo(s))." -ForegroundColor Green
