# Revisao unica do visual chat Princy — scripts de deploy leem daqui (nao duplicar string).
function Get-PrincyUiRevision {
	return 'cursor-agent-2026.05.25-r11'
}

function Get-PrincyUiRevisionMarkers {
	return @(
		(Get-PrincyUiRevision),
		'cursor-agent-track',
		'cursor-shell',
		'forceVisualUnlock',
		'princy.unlockEditorLayout',
		'offlineBanner',
		'reconnectBackend'
	)
}
