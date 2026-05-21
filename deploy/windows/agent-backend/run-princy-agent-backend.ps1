param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[int]$Port = 3210
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
}

$env:API_PORT = "$Port"
$env:NODE_OPTIONS = "--max-old-space-size=8192"

$distServer = Join-Path $appRoot "dist\backend\server.js"
if (-not (Test-Path $distServer)) {
	Write-Host "Build ausente. Rode build-princy-agent-backend.ps1 antes do servico."
	exit 1
}

function Resolve-NodeExe {
	$cmd = Get-Command node.exe -ErrorAction SilentlyContinue
	if ($cmd) {
		return $cmd.Source
	}
	foreach ($candidate in @(
		"$env:ProgramFiles\nodejs\node.exe",
		"${env:ProgramFiles(x86)}\nodejs\node.exe",
		"C:\Program Files\nodejs\node.exe"
	)) {
		if (Test-Path $candidate) {
			return $candidate
		}
	}
	throw "node.exe nao encontrado. Instale Node.js LTS no VPS."
}

$nodeExe = Resolve-NodeExe
Write-Host "Princy agent backend (run) http://127.0.0.1:$Port via $nodeExe"
& $nodeExe $distServer
