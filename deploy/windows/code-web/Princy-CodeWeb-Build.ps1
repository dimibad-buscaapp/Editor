# Helpers compartilhados para scripts Code Web (PowerShell 5.1+ e PowerShell 7 / pwsh).

function Get-PrincyPwshExe {
	# Preferir PowerShell 7 quando instalado (VPS tipico: pwsh 7.x)
	$pwshCmd = Get-Command pwsh -ErrorAction SilentlyContinue
	if ($pwshCmd -and $pwshCmd.Source) {
		return $pwshCmd.Source
	}
	$pwshDefault = Join-Path ${env:ProgramFiles} "PowerShell\7\pwsh.exe"
	if (Test-Path $pwshDefault) {
		return $pwshDefault
	}
	# Fallback: mesma sessao (PS 7) ou Windows PowerShell 5.1
	if ($PSVersionTable.PSVersion.Major -ge 6 -and $PSCommandPath) {
		return $PSCommandPath
	}
	return (Get-Command powershell.exe).Source
}

function Invoke-PrincyDeployScript {
	param(
		[Parameter(Mandatory = $true)][string]$ScriptPath,
		[hashtable]$ScriptArgs = @{}
	)
	$exe = Get-PrincyPwshExe
	$argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $ScriptPath)
	foreach ($key in @($ScriptArgs.Keys)) {
		$val = $ScriptArgs[$key]
		if ($val -is [switch]) {
			if ($val.IsPresent) { $argList += "-$key" }
		} elseif ($val -is [bool] -and $val -eq $true) {
			$argList += "-$key"
		} else {
			$argList += "-$key"
			$argList += [string]$val
		}
	}
	& $exe @argList | Out-Host
	$exitCode = $LASTEXITCODE
	if ($null -eq $exitCode) {
		$exitCode = 0
	}
	return [int]$exitCode
}

# workbench.js do esbuild (PROD) costuma ter > 800 KB; tsc parcial fica < 200 KB e causa tela branca.
$script:PrincyWorkbenchBundledMinBytes = 800000

function Get-PrincyWorkbenchBundleInfo {
	param([string]$ProjectRoot = "C:\Apps\Editor")
	$wbJs = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.js"
	$wbCss = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.css"
	$wbHtml = Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench.html"
	$jsBytes = if (Test-Path $wbJs) { (Get-Item $wbJs).Length } else { 0 }
	$bundled = $jsBytes -ge $script:PrincyWorkbenchBundledMinBytes
	$hasCss = (Test-Path $wbCss) -or (Test-Path (Join-Path $ProjectRoot "out\vs\workbench\workbench.web.main.css"))
	@{
		JsPath = $wbJs
		JsBytes = $jsBytes
		IsBundled = $bundled
		HasHtml = Test-Path $wbHtml
		HasCss = $hasCss
	}
}

function Test-PrincyCodeWebProdBuild {
	param([string]$ProjectRoot = "C:\Apps\Editor")
	$info = Get-PrincyWorkbenchBundleInfo -ProjectRoot $ProjectRoot
	return ($info.HasHtml -and $info.IsBundled -and $info.HasCss)
}

function Get-PrincyCodeWebProdBuildStatus {
	param([string]$ProjectRoot = "C:\Apps\Editor")
	$info = Get-PrincyWorkbenchBundleInfo -ProjectRoot $ProjectRoot
	@{
		ServerMain = Test-Path (Join-Path $ProjectRoot "out\server-main.js")
		WorkbenchDev = Test-Path (Join-Path $ProjectRoot "out\vs\code\browser\workbench\workbench-dev.html")
		WorkbenchHtml = $info.HasHtml
		WorkbenchCss = $info.HasCss
		WorkbenchJs = $info.JsBytes -gt 0
		WorkbenchJsBytes = $info.JsBytes
		WorkbenchBundled = $info.IsBundled
		WorkbenchCssLegacy = Test-Path (Join-Path $ProjectRoot "out\vs\workbench\workbench.web.main.css")
		HasProd = (Test-PrincyCodeWebProdBuild -ProjectRoot $ProjectRoot)
	}
}
