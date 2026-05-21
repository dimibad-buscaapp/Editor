param(
	[string]$ProjectRoot = "C:\Apps\Editor",
	[string]$CaddyDir = "C:\Caddy",
	[string]$CaddyVersion = "2.9.1"
)

$ErrorActionPreference = "Stop"

function Get-CaddyExecutable {
	$local = Join-Path $CaddyDir "caddy.exe"
	if (Test-Path $local) {
		return $local
	}
	$cmd = Get-Command caddy -ErrorAction SilentlyContinue
	if ($cmd) {
		return $cmd.Source
	}
	return $null
}

Write-Host "Princy Ai — instalar/configurar Caddy"
Write-Host "Pasta: $CaddyDir"

New-Item -ItemType Directory -Force $CaddyDir | Out-Null

$sourceCaddyfile = Join-Path $ProjectRoot "deploy\windows\code-web\Caddyfile"
if (-not (Test-Path $sourceCaddyfile)) {
	throw "Caddyfile nao encontrado: $sourceCaddyfile"
}
Copy-Item $sourceCaddyfile (Join-Path $CaddyDir "Caddyfile") -Force
Write-Host "Caddyfile copiado para $CaddyDir\Caddyfile"

$caddyExe = Get-CaddyExecutable
if (-not $caddyExe) {
	Write-Host "Caddy nao encontrado. Tentando winget ..."
	try {
		winget install --id CaddyServer.Caddy -e --accept-source-agreements --accept-package-agreements
		$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
		$caddyExe = Get-CaddyExecutable
	} catch {
		Write-Host "winget falhou: $_"
	}
}

if (-not $caddyExe) {
	Write-Host "Baixando Caddy $CaddyVersion para $CaddyDir ..."
	$zipUrl = "https://github.com/caddyserver/caddy/releases/download/v$CaddyVersion/caddy_${CaddyVersion}_windows_amd64.zip"
	$zipPath = Join-Path $CaddyDir "caddy.zip"
	Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
	Expand-Archive -Path $zipPath -DestinationPath $CaddyDir -Force
	Remove-Item $zipPath -Force
	$caddyExe = Join-Path $CaddyDir "caddy.exe"
}

if (-not (Test-Path $caddyExe)) {
	throw "caddy.exe nao encontrado apos instalacao."
}

Write-Host "Caddy: $caddyExe"
& $caddyExe version

Write-Host ""
Write-Host "Proximo passo (PowerShell como Administrador — portas 80/443):"
Write-Host "  & `"$caddyExe`" run --config `"$CaddyDir\Caddyfile`""
Write-Host ""
Write-Host "Ou em segundo plano:"
Write-Host "  Start-Process -FilePath `"$caddyExe`" -ArgumentList 'run','--config',`"$CaddyDir\Caddyfile`" -WindowStyle Hidden"
Write-Host ""
Write-Host "Antes disso: backend na 3210 e Code Web na 3200 devem estar rodando."
