param(
	[string]$ProjectRoot = "C:\Apps\Editor"
)

$ErrorActionPreference = "Stop"

$storageRoot = Join-Path $ProjectRoot "apps\ai-dashboard\workspace-storage"
$projetos = Join-Path $storageRoot "projetos"
$builds = Join-Path $storageRoot "builds"

foreach ($dir in @($storageRoot, $projetos, (Join-Path $builds "apk"), (Join-Path $builds "exe"), (Join-Path $builds "web"), (Join-Path $builds "api"))) {
	if (-not (Test-Path $dir)) {
		New-Item -ItemType Directory -Path $dir -Force | Out-Null
		Write-Host "Criado: $dir" -ForegroundColor Green
	} else {
		Write-Host "Ja existe: $dir" -ForegroundColor DarkGray
	}
}

Write-Host ""
Write-Host "WORKSPACE_STORAGE_ROOT=$storageRoot"
Write-Host "Projetos (Fase 5): $projetos"
Write-Host "Builds: $builds"
