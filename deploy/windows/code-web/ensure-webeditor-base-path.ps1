# Garante PrincyAiCodeWeb com --server-base-path /webeditor (nao na raiz :3200).
# Admin: powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\ensure-webeditor-base-path.ps1

param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$ServiceName = "PrincyAiCodeWeb",
	[string]$ExpectedBasePath = "/webeditor"
)

$ErrorActionPreference = "Continue"

function Get-NssmPath {
	$cmd = Get-Command nssm.exe -ErrorAction SilentlyContinue
	if ($cmd) { return $cmd.Source }
	foreach ($path in @("${env:ProgramFiles}\nssm\nssm.exe", "${env:ProgramFiles(x86)}\nssm\nssm.exe")) {
		if (Test-Path $path) { return $path }
	}
	return $null
}

Write-Host "=== Garantir editor em /webeditor (porta 3200) ===" -ForegroundColor Cyan
Write-Host ""

$base = $ExpectedBasePath.Trim()
if (-not $base.StartsWith('/')) { $base = "/$base" }

$nssm = Get-NssmPath
$needsReinstall = $true
$appParams = $null

if ($nssm) {
	$appParams = & $nssm get $ServiceName AppParameters 2>$null
	if ($appParams -and ($appParams -match 'server-base-path') -and ($appParams -match [regex]::Escape($base))) {
		Write-Host "NSSM AppParameters: OK (contem --server-base-path $base)" -ForegroundColor Green
		$needsReinstall = $false
	} elseif ($appParams) {
		Write-Host "NSSM AppParameters: INCORRETO" -ForegroundColor Red
		Write-Host $appParams
		Write-Host "  Esperado: --server-base-path $base" -ForegroundColor Yellow
	} else {
		Write-Host "NSSM: servico $ServiceName sem parametros legiveis" -ForegroundColor Yellow
	}
} else {
	Write-Host "NSSM nao encontrado." -ForegroundColor Yellow
}

$logOut = Join-Path $ProjectRoot "logs\code-web.out.log"
if (Test-Path $logOut) {
	$line = Select-String -Path $logOut -Pattern "Web UI available" | Select-Object -Last 1
	if ($line) {
		if ($line.Line -match [regex]::Escape($base)) {
			Write-Host "Log: OK — $($line.Line.Trim())" -ForegroundColor Green
		} else {
			Write-Host "Log: ERRO — editor na RAIZ (falta $base no URL)" -ForegroundColor Red
			Write-Host "  $($line.Line.Trim())" -ForegroundColor DarkYellow
			$needsReinstall = $true
		}
	}
}

$envFile = Join-Path $ProjectRoot "apps\ai-dashboard\.env"
if (Test-Path $envFile) {
	$text = Get-Content $envFile -Raw
	if ($text -match 'CODE_WEB_URL\s*=\s*"?https?://[^"\r\n]+"?' -and $text -notmatch 'CODE_WEB_URL[^=]*=[^"\r\n]*webeditor') {
		Write-Host ".env: CODE_WEB_URL sem /webeditor — corrija para http://127.0.0.1:3200/webeditor" -ForegroundColor Yellow
	}
}

if ($needsReinstall) {
	Write-Host ""
	Write-Host "Reinstalando servico com base path $base ..." -ForegroundColor Cyan
	$fix = Join-Path $ProjectRoot "deploy\windows\code-web\fix-princy-code-web-service.ps1"
	& powershell -ExecutionPolicy Bypass -File $fix -ProjectRoot $ProjectRoot -ServerBasePath $base
	exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Editor deve abrir em: https://princyai.com$base/" -ForegroundColor Green
Write-Host "Nao use https://princyai.com/ (landing :3220) nem http://IP:3200/ sem $base" -ForegroundColor DarkGray
