# Instala fontes usadas pelo Princy Ai (editor + UI).
# Execute como Administrador:
#   powershell -ExecutionPolicy Bypass -File .\deploy\windows\install-princy-fonts.ps1

$ErrorActionPreference = 'Stop'

function Install-WingetFont {
	param([string]$Id, [string]$Name)
	if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
		return $false
	}
	Write-Host "winget: $Name ($Id)..."
	$proc = Start-Process winget -ArgumentList @(
		'install', '--id', $Id,
		'--accept-package-agreements', '--accept-source-agreements',
		'-e', '--silent'
	) -Wait -PassThru -NoNewWindow
	return $proc.ExitCode -eq 0 -or $proc.ExitCode -eq 3010
}

function Install-JetBrainsMonoFromGitHub {
	$fontsDir = Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Fonts'
	if (-not (Test-Path $fontsDir)) {
		New-Item -ItemType Directory -Path $fontsDir -Force | Out-Null
	}

	$zipUrl = 'https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip'
	$tempZip = Join-Path $env:TEMP 'JetBrainsMono.zip'
	$extractDir = Join-Path $env:TEMP 'JetBrainsMono'

	Write-Host 'Baixando JetBrains Mono do GitHub...'
	Invoke-WebRequest -Uri $zipUrl -OutFile $tempZip -UseBasicParsing
	if (Test-Path $extractDir) {
		Remove-Item $extractDir -Recurse -Force
	}
	Expand-Archive -Path $tempZip -DestinationPath $extractDir -Force

	$installed = 0
	Get-ChildItem $extractDir -Recurse -Filter '*.ttf' | ForEach-Object {
		$dest = Join-Path $fontsDir $_.Name
		Copy-Item $_.FullName $dest -Force
		$installed++
	}

	Remove-Item $tempZip -Force -ErrorAction SilentlyContinue
	Write-Host "JetBrains Mono: $installed arquivos .ttf instalados em $fontsDir"
	return $installed -gt 0
}

Write-Host '=== Princy Ai — instalacao de fontes ===' -ForegroundColor Cyan

$jbOk = Install-WingetFont -Id 'JetBrains.JetBrainsMono' -Name 'JetBrains Mono'
if (-not $jbOk) {
	Install-JetBrainsMonoFromGitHub | Out-Null
}

Install-WingetFont -Id 'Microsoft.CascadiaCode' -Name 'Cascadia Code' | Out-Null
Install-WingetFont -Id 'Microsoft.CascadiaMono' -Name 'Cascadia Mono' | Out-Null

# Cascadia costuma vir com Windows Terminal / VS; opcional via GitHub:
if (-not (Get-ChildItem "$env:WINDIR\Fonts" -Filter 'Cascadia*.ttf' -ErrorAction SilentlyContinue)) {
	Write-Host 'Cascadia: use Windows Terminal ou instale manualmente se o editor nao mostrar a fonte.'
}

Write-Host ''
Write-Host 'Fontes do Princy Ai:' -ForegroundColor Green
Write-Host "  Editor: 'JetBrains Mono', 'Cascadia Code', Consolas"
Write-Host '  Reinicie o Princy Ai Web apos instalar.' -ForegroundColor Yellow
