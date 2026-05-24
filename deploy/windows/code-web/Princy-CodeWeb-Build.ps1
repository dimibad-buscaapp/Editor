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
