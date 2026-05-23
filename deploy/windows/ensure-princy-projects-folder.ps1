param(
	[string]$ProjectsRoot = "C:\Apps\Projects"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ProjectsRoot)) {
	New-Item -ItemType Directory -Path $ProjectsRoot -Force | Out-Null
	Write-Host "Criado: $ProjectsRoot" -ForegroundColor Green
} else {
	Write-Host "Ja existe: $ProjectsRoot" -ForegroundColor DarkGray
}

Write-Host "Defina no backend (opcional): PRINCY_PROJECTS_ROOT=$ProjectsRoot"
