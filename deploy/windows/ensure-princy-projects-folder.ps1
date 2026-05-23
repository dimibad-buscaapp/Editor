param(
	[string]$ProjectRoot = "C:\Apps\Editor"
)

$ErrorActionPreference = "Stop"

$storageRoot = Join-Path $ProjectRoot "apps\ai-dashboard\workspace-storage"
$ProjectsRoot = Join-Path $storageRoot "projetos"

if (-not (Test-Path $ProjectsRoot)) {
	New-Item -ItemType Directory -Path $ProjectsRoot -Force | Out-Null
	Write-Host "Criado: $ProjectsRoot" -ForegroundColor Green
} else {
	Write-Host "Ja existe: $ProjectsRoot" -ForegroundColor DarkGray
}

Write-Host "Defina no backend (opcional): PRINCY_PROJECTS_ROOT=$ProjectsRoot"
Write-Host "Ou use WORKSPACE_STORAGE_ROOT=$storageRoot (padrao Fase 5)"
