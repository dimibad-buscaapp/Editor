param(
	[string]$ProjectRoot = "C:\Apps\Editor"
)

$ErrorActionPreference = "Stop"

$storageRoot = Join-Path $ProjectRoot "apps\ai-dashboard\workspace-storage"
$sites = Join-Path $storageRoot "princy-sites"
$preview = Join-Path $storageRoot "princy-sites-preview"

foreach ($dir in @($storageRoot, $sites, $preview)) {
	if (-not (Test-Path $dir)) {
		New-Item -ItemType Directory -Path $dir -Force | Out-Null
		Write-Host "Criado: $dir" -ForegroundColor Green
	} else {
		Write-Host "Ja existe: $dir" -ForegroundColor DarkGray
	}
}

Write-Host ""
Write-Host "PRINCY_SITES_ROOT=$sites"
Write-Host "PRINCY_SITES_PREVIEW_ROOT=$preview"
Write-Host "Preview URL: https://princyai.com/princy-sites-preview/{slug}/"
Write-Host "Publicado:   https://princyai.com/princy-sites/{slug}/"
