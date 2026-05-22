# Helpers compartilhados para scripts Code Web (PowerShell 5.1, ASCII only).

function Test-PrincyCodeWebProdBuild {
	param([string]$ProjectRoot = "C:\Apps\Editor")
	$wbHtml = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.html"
	if (-not (Test-Path $wbHtml)) {
		return $false
	}
	$paths = @(
		"out\vs\code\browser\workbench\workbench.css",
		"out\vs\code\browser\workbench\workbench.js",
		"out\vs\workbench\workbench.web.main.css"
	)
	foreach ($rel in $paths) {
		if (Test-Path (Join-Path $ProjectRoot $rel)) {
			return $true
		}
	}
	return $false
}

function Get-PrincyCodeWebProdBuildStatus {
	param([string]$ProjectRoot = "C:\Apps\Editor")
	@{
		ServerMain = Test-Path (Join-Path $ProjectRoot "out\server-main.js")
		WorkbenchDev = Test-Path (Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench-dev.html")
		WorkbenchHtml = Test-Path (Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.html")
		WorkbenchCss = Test-Path (Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.css")
		WorkbenchJs = Test-Path (Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.js")
		WorkbenchCssLegacy = Test-Path (Join-Path $ProjectRoot "out\vs\workbench\workbench.web.main.css")
		HasProd = (Test-PrincyCodeWebProdBuild -ProjectRoot $ProjectRoot)
	}
}
