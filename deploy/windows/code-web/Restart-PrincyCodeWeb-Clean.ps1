# Atalho: reinicia stack (3200 + Caddy + API). Execute como Administrador.
param([string]$ProjectRoot = "C:\Apps\Editor")

$always = Join-Path $ProjectRoot "deploy\windows\Start-PrincyAlwaysOnline.ps1"
& powershell -ExecutionPolicy Bypass -File $always -ProjectRoot $ProjectRoot -SkipGitPull