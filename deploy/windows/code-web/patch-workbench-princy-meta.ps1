# Injeta meta princy-ai nos HTML do workbench em out/ (sem precisar rebundle do workbench.js).
# powershell -ExecutionPolicy Bypass -File deploy\windows\code-web\patch-workbench-princy-meta.ps1

param([string]$ProjectRoot = "C:\Apps\Editor")

$ErrorActionPreference = "Stop"
$pkgPath = Join-Path $ProjectRoot "extensions\princy-ai\package.json"
$extJs = Join-Path $ProjectRoot "extensions\princy-ai\dist\browser\extension.js"
if (-not (Test-Path $pkgPath) -or -not (Test-Path $extJs)) {
	throw "Compile a extensao primeiro: npm run compile-web"
}

$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
$entry = @(@{ extensionPath = "princy-ai"; packageJSON = $pkg }) | ConvertTo-Json -Compress -Depth 30
$escaped = $entry -replace '"', '&quot;'

function Update-WorkbenchHtml {
	param([string]$Path)
	if (-not (Test-Path $Path)) {
		Write-Host "  skip (ausente): $Path" -ForegroundColor DarkGray
		return
	}
	$html = Get-Content $Path -Raw
	if ($html -match 'id="vscode-workbench-builtin-extensions"') {
		$html = $html -replace 'id="vscode-workbench-builtin-extensions"[^>]*>',
			"id=`"vscode-workbench-builtin-extensions`" data-settings=`"$escaped`">"
		Write-Host "  atualizado: $Path" -ForegroundColor Green
	}
	else {
		$meta = "`t`t<meta id=`"vscode-workbench-builtin-extensions`" data-settings=`"$escaped`">`n"
		$html = $html -replace '</head>', "$meta`t</head>"
		Write-Host "  inserido meta: $Path" -ForegroundColor Green
	}
	Set-Content -Path $Path -Value $html -NoNewline
}

Write-Host "Patch meta princy-ai em out/ ..." -ForegroundColor Cyan
Update-WorkbenchHtml (Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.html")
Update-WorkbenchHtml (Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench-dev.html")
