param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$ServiceName = "PrincyAiAgentBackend",
	[int]$Port = 3210
)

$ErrorActionPreference = "Stop"

$fixer = Join-Path $ProjectRoot "deploy\windows\agent-backend\fix-princy-agent-backend-service.ps1"
if (-not (Test-Path $fixer)) {
	throw "Script nao encontrado: $fixer"
}

powershell -ExecutionPolicy Bypass -File $fixer -ProjectRoot $ProjectRoot -ServiceName $ServiceName -Port $Port
