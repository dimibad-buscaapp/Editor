# Princy Ai — hosts e portas (VPS Windows)
# Uso: . .\deploy\windows\princy-hosts.ps1

$script:PrincyVpsIp = '108.181.169.40'
$script:PrincyDomain = 'princyai.com'
$script:PrincyDashboardDomain = 'dashboard.princyai.com'

$script:PrincyIndexPort = 3220
$script:PrincyEditorPort = 3200
$script:PrincyDashboardPort = 3210

$script:PrincyIndexUrl = "http://${PrincyVpsIp}:${PrincyIndexPort}"
$script:PrincyEditorUrl = "http://${PrincyVpsIp}:${PrincyEditorPort}/webeditor"
$script:PrincyEditorInternalUrl = "http://${PrincyVpsIp}:${PrincyEditorPort}"
$script:PrincyDashboardUrl = "http://${PrincyVpsIp}:${PrincyDashboardPort}"
$script:PrincyApiUrl = "http://${PrincyVpsIp}:${PrincyDashboardPort}"

$script:PrincyPublicIndexUrl = "https://${PrincyDomain}/"
$script:PrincyPublicEditorUrl = "https://${PrincyDomain}/webeditor/"
$script:PrincyPublicDashboardUrl = "https://${PrincyDashboardDomain}/"
$script:PrincyPublicApiUrl = "https://${PrincyDomain}/princy-api"
