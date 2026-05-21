param(
	[string]$ProjectRoot = "C:\Apps\Editor"
)

$ErrorActionPreference = "Stop"
$appRoot = Join-Path $ProjectRoot "apps\ai-dashboard"
Set-Location $appRoot

if (-not (Test-Path ".env")) {
	$example = Join-Path $appRoot "deploy\windows\princyai.env.production.example"
	if (-not (Test-Path $example)) {
		$example = Join-Path $appRoot "deploy\windows\princyai.env.example"
	}
	Copy-Item $example ".\.env"
	Write-Host "Criado .env a partir do example. Revise SESSION_SECRET e DATABASE_URL."
}

$env:NODE_OPTIONS = "--max-old-space-size=8192"
npm run prisma:generate
npm run prisma:deploy
npm run build
Write-Host "Build do agent backend concluido."
