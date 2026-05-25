# Restaura workbench.html em out/ com placeholders {{}} — o servidor Code Web injeta meta em runtime.
# Corrige pagina branca com JSON do package.json visivel (patch antigo corrompia o HTML).
#
# pwsh -ExecutionPolicy Bypass -File deploy\windows\code-web\restore-workbench-html-placeholder.ps1

param([string]$ProjectRoot = "C:\Apps\Editor")

$ErrorActionPreference = "Stop"

$src = Join-Path $ProjectRoot "src\vs\code\browser\workbench\workbench.html"
if (-not (Test-Path $src)) {
	throw "Ausente template: $src"
}

$content = Get-Content $src -Raw
$dests = @(
	Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.html"
	Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench-dev.html"
)

Write-Host "Restaurar workbench HTML (placeholders) ..." -ForegroundColor Cyan
foreach ($dest in $dests) {
	$dir = Split-Path $dest -Parent
	if (-not (Test-Path $dir)) {
		Write-Host "  skip (pasta ausente): $dest" -ForegroundColor DarkGray
		continue
	}
	Set-Content -Path $dest -Value $content -NoNewline
	Write-Host "  OK: $dest" -ForegroundColor Green
}
