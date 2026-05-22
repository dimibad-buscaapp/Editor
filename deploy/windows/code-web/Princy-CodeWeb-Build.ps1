# Helpers compartilhados para scripts Code Web (PowerShell 5.1, ASCII only).

function Test-PrincyCodeWebProdBuild {
	param([string]$ProjectRoot = "C:\Apps\Editor")
	$wbHtml = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.html"
	if (-not (Test-Path $wbHtml)) {
		return $false
	}
	$hasJs = Test-Path (Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.js")
	$hasCss = (Test-Path (Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.css")) -or
		(Test-Path (Join-Path $ProjectRoot "out\vs\workbench\workbench.web.main.css"))
	# JS sozinho (tsc parcial) nao basta: workbench.html referencia workbench.css
	return ($hasJs -and $hasCss)
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
