/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PRINCY_DESIGN_TOKENS_CSS } from './princyDesignTokens';

export function buildChatPanelHtml(cspSource: string, nonce: string): string {
	return /* html */`<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
	<title>Princy IA</title>
	<style>
		:root {
			${PRINCY_DESIGN_TOKENS_CSS}
		}
		* { box-sizing: border-box; margin: 0; padding: 0; }
		body {
			overflow: hidden;
			color: var(--vscode-foreground, var(--princy-text));
			background: var(--vscode-sideBar-background, var(--princy-bg));
			font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif);
			font-size: var(--vscode-font-size, 13px);
			line-height: 1.5;
			-webkit-font-smoothing: antialiased;
		}
		.chat-panel {
			height: 100vh;
			display: flex;
			flex-direction: column;
			background: var(--vscode-sideBar-background, var(--princy-bg));
		}
		.chat-header {
			flex-shrink: 0;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 8px;
			padding: 10px 14px 6px;
			border-bottom: 1px solid var(--vscode-sideBar-border, var(--princy-border));
		}
		.chat-header-brand {
			display: flex;
			align-items: center;
			gap: 8px;
			min-width: 0;
		}
		.chat-header-logo {
			width: 22px;
			height: 22px;
			border-radius: 6px;
			display: grid;
			place-items: center;
			font-size: 12px;
			background: var(--princy-elevated);
			color: var(--princy-text-strong);
			border: 1px solid var(--princy-border);
		}
		.chat-header-title {
			font-size: 12px;
			font-weight: 600;
			color: var(--vscode-sideBarTitle-foreground, var(--princy-text-strong));
			letter-spacing: 0.01em;
		}
		.chat-header-sub {
			font-size: 10px;
			color: var(--vscode-descriptionForeground, var(--princy-muted));
		}
		.chat-header-actions {
			display: flex;
			align-items: center;
			gap: 4px;
		}
		.chat-header-btn {
			height: 26px;
			padding: 0 10px;
			border: 1px solid var(--vscode-widget-border, var(--princy-border));
			border-radius: 6px;
			background: transparent;
			color: var(--vscode-foreground, var(--princy-text));
			font-size: 11px;
			cursor: pointer;
		}
		.chat-header-btn:hover {
			background: var(--vscode-list-hoverBackground, var(--princy-elevated));
		}
		.chat-scroll {
			flex: 1;
			overflow-y: auto;
			overflow-x: hidden;
			padding: 12px 14px 8px;
		}
		.chat-welcome {
			min-height: min(320px, 50vh);
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			text-align: center;
			padding: 24px 16px;
			gap: 8px;
		}
		.chat-welcome-icon {
			width: 44px;
			height: 44px;
			border-radius: 12px;
			display: grid;
			place-items: center;
			font-size: 20px;
			background: var(--princy-elevated);
			color: var(--princy-text-strong);
			border: 1px solid var(--princy-border);
			margin-bottom: 4px;
		}
		.chat-welcome h2 {
			font-size: 17px;
			font-weight: 600;
			color: var(--vscode-foreground, var(--princy-text-strong));
		}
		.chat-welcome p {
			max-width: 280px;
			color: var(--vscode-descriptionForeground, var(--princy-muted));
			font-size: 12px;
			line-height: 1.55;
		}
		.chat-suggestions {
			display: flex;
			flex-wrap: wrap;
			justify-content: center;
			gap: 8px;
			margin-top: 14px;
			max-width: 320px;
		}
		.chat-suggest {
			padding: 8px 12px;
			border-radius: 10px;
			border: 1px solid var(--vscode-widget-border, var(--princy-border));
			background: var(--vscode-input-background, var(--princy-elevated));
			color: var(--vscode-foreground, var(--princy-text));
			font-size: 12px;
			line-height: 1.35;
			text-align: left;
			cursor: pointer;
			max-width: 150px;
		}
		.chat-suggest:hover {
			border-color: var(--vscode-focusBorder, #3F3F46);
			background: var(--vscode-list-hoverBackground, #27272A);
		}
		@keyframes chat-turn-enter {
			from { opacity: 0; transform: translateY(6px); }
			to { opacity: 1; transform: translateY(0); }
		}
		@keyframes chat-blink {
			50% { opacity: 0; }
		}
		@keyframes chat-pulse {
			0%, 100% { opacity: 0.45; }
			50% { opacity: 1; }
		}
		.chat-turn-list {
			display: flex;
			flex-direction: column;
			gap: 20px;
		}
		.chat-turn {
			display: flex;
			flex-direction: column;
			gap: 6px;
			max-width: 100%;
			animation: chat-turn-enter 0.22s ease-out;
		}
		.chat-turn.user {
			align-items: flex-end;
		}
		.chat-turn.assistant {
			align-items: stretch;
		}
		.chat-turn-header {
			display: flex;
			align-items: center;
			gap: 6px;
			font-size: 11px;
			font-weight: 600;
			color: var(--vscode-descriptionForeground, #9d9d9d);
			letter-spacing: 0.02em;
		}
		.chat-turn.user .chat-turn-header {
			flex-direction: row-reverse;
		}
		.chat-turn-avatar {
			width: 18px;
			height: 18px;
			border-radius: 4px;
			display: grid;
			place-items: center;
			font-size: 10px;
			flex-shrink: 0;
			background: var(--vscode-input-background, #3c3c3c);
			color: var(--vscode-foreground, #cccccc);
		}
		.chat-turn.assistant .chat-turn-avatar {
			background: var(--princy-elevated);
			color: var(--princy-text-strong);
			border: 1px solid var(--princy-border);
		}
		.chat-turn-body {
			white-space: pre-wrap;
			word-break: break-word;
			line-height: 1.55;
			font-size: 13px;
		}
		.chat-turn.user .chat-turn-body {
			max-width: 92%;
			padding: 8px 12px;
			border-radius: 10px;
			background: var(--vscode-input-background, var(--princy-elevated));
			border: 1px solid var(--vscode-input-border, var(--princy-border));
			color: var(--vscode-input-foreground, var(--princy-text));
		}
		.chat-turn.assistant .chat-turn-body {
			padding: 0 2px;
			color: var(--vscode-foreground, #cccccc);
		}
		.chat-turn.assistant.streaming .chat-turn-body {
			min-height: 1.2em;
		}
		.cursor-blink::after {
			content: '▋';
			margin-left: 1px;
			animation: chat-blink 1s step-end infinite;
			color: var(--princy-muted);
		}
		.chat-welcome {
			animation: chat-turn-enter 0.35s ease-out;
		}
		.chat-thinking {
			display: none;
			margin: 8px 0;
			padding: 8px 10px;
			border-radius: 6px;
			background: var(--vscode-editorWidget-background, #252526);
			border: 1px solid var(--vscode-widget-border, #454545);
			font-size: 12px;
			color: var(--vscode-descriptionForeground, #9d9d9d);
		}
		.chat-thinking .step { line-height: 1.6; }
		.chat-thinking .step.active { color: var(--vscode-foreground, #cccccc); }
		.chat-thinking .step.done { color: var(--vscode-testing-iconPassed, #73c991); }
		.chat-composer {
			flex-shrink: 0;
			padding: 6px 12px 14px;
			background: var(--vscode-sideBar-background, var(--princy-bg));
			border-top: 1px solid var(--vscode-sideBar-border, var(--princy-border));
			position: relative;
			z-index: 2;
		}
		.chat-context-chips {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
			margin-bottom: 8px;
			min-height: 0;
		}
		.chat-context-chips:empty { display: none; }
		.chip {
			height: 22px;
			padding: 0 8px;
			border-radius: 4px;
			font-size: 11px;
			line-height: 22px;
			background: var(--vscode-badge-background, #4d4d4d);
			color: var(--vscode-badge-foreground, #ffffff);
		}
		.chip.on {
			background: var(--vscode-list-activeSelectionBackground, #27272A);
			color: var(--vscode-list-activeSelectionForeground, var(--princy-text-strong));
			border: 1px solid var(--princy-border);
		}
		.chat-followups {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
			margin-bottom: 8px;
		}
		.chat-followups button {
			height: 24px;
			padding: 0 10px;
			border: 1px solid var(--princy-border);
			border-radius: 999px;
			font-size: 11px;
			cursor: pointer;
			background: var(--princy-elevated);
			color: var(--princy-text);
			transition: border-color var(--princy-transition-fast), background var(--princy-transition-fast), box-shadow var(--princy-transition-fast);
		}
		.chat-followups button:hover {
			border-color: #3F3F46;
			background: #27272A;
			box-shadow: 0 0 0 1px var(--princy-glow-soft);
		}
		#mentionMenu {
			display: none;
			margin-bottom: 8px;
			max-height: 140px;
			overflow: auto;
			border-radius: 6px;
			border: 1px solid var(--vscode-widget-border, #454545);
			background: var(--vscode-editorWidget-background, #252526);
		}
		#mentionMenu button {
			display: block;
			width: 100%;
			text-align: left;
			padding: 6px 10px;
			border: none;
			background: transparent;
			color: var(--vscode-foreground, #cccccc);
			font-size: 12px;
			cursor: pointer;
		}
		#mentionMenu button:hover {
			background: var(--vscode-list-hoverBackground, #2a2d2e);
		}
		.chat-input-container {
			position: relative;
			border: 1px solid var(--vscode-input-border, var(--princy-border));
			border-radius: 12px;
			background: var(--vscode-input-background, var(--princy-elevated));
			overflow: hidden;
			box-shadow: 0 1px 0 rgba(0, 0, 0, 0.35);
			transition: border-color 0.15s ease, box-shadow 0.15s ease;
		}
		.chat-input-container:focus-within {
			border-color: var(--vscode-focusBorder, #3F3F46);
			box-shadow: 0 0 0 1px var(--vscode-focusBorder, #3F3F46);
		}
		.chat-input-container textarea {
			width: 100%;
			min-height: 52px;
			max-height: 200px;
			resize: none;
			border: none;
			outline: none;
			padding: 10px 12px 4px;
			display: block;
			background: transparent;
			color: var(--vscode-input-foreground, #cccccc);
			font-family: inherit;
			font-size: 13px;
			line-height: 1.45;
		}
		.chat-input-container textarea::placeholder {
			color: var(--vscode-input-placeholderForeground, #9d9d9d);
		}
		.chat-input-toolbar {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 8px;
			padding: 4px 8px 8px;
			min-height: 32px;
		}
		.chat-toolbar-left {
			display: flex;
			align-items: center;
			gap: 8px;
			min-width: 0;
			flex: 1;
		}
		.chat-sr-only {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			margin: -1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
			border: 0;
			pointer-events: none;
		}
		#princy-boot-error {
			margin: 8px 12px;
			padding: 10px 12px;
			border-radius: 6px;
			font-size: 12px;
			line-height: 1.45;
			color: var(--vscode-errorForeground, #f48771);
			background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
			border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
		}
		.chat-model-select {
			height: 24px;
			max-width: 130px;
			padding: 0 8px;
			border-radius: 4px;
			border: 1px solid var(--vscode-dropdown-border, #3c3c3c);
			background: var(--vscode-dropdown-background, #3c3c3c);
			color: var(--vscode-dropdown-foreground, #cccccc);
			font-size: 11px;
			outline: none;
			cursor: pointer;
		}
		.chat-status {
			font-size: 11px;
			color: var(--vscode-descriptionForeground, #9d9d9d);
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.chat-backend-dot {
			width: 6px;
			height: 6px;
			border-radius: 50%;
			flex-shrink: 0;
			background: var(--vscode-errorForeground, #f48771);
			animation: chat-pulse 2.4s ease-in-out infinite;
		}
		.chat-backend-dot.online {
			background: var(--vscode-testing-iconPassed, #73c991);
			animation: none;
		}
		.chat-toolbar-right {
			display: flex;
			align-items: center;
			gap: 4px;
		}
		.chat-toolbar-btn {
			height: 24px;
			min-width: 24px;
			padding: 0 8px;
			border: none;
			border-radius: 4px;
			font-size: 11px;
			cursor: pointer;
			background: transparent;
			color: var(--vscode-foreground, #cccccc);
		}
		.chat-toolbar-btn:hover {
			background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
		}
		.chat-send-btn {
			width: 28px;
			height: 28px;
			padding: 0;
			border: none;
			border-radius: 8px;
			cursor: pointer;
			display: grid;
			place-items: center;
			font-size: 14px;
			font-weight: 600;
			background: var(--vscode-button-background, var(--princy-accent));
			color: var(--vscode-button-foreground, var(--princy-accent-fg));
			transition: transform 0.12s ease, background 0.12s ease;
		}
		.chat-send-btn:hover {
			background: var(--vscode-button-hoverBackground, #E4E4E7);
			transform: scale(1.04);
		}
		.chat-send-btn:active {
			transform: scale(0.96);
		}
		.chat-send-btn:disabled {
			opacity: 0.45;
			cursor: not-allowed;
		}
		.cmd-btn {
			margin-top: 8px;
			height: 24px;
			padding: 0 10px;
			border: none;
			border-radius: 4px;
			font-size: 11px;
			cursor: pointer;
			background: var(--vscode-button-secondaryBackground, #3a3d41);
			color: var(--vscode-button-secondaryForeground, #ffffff);
		}
		.code-block {
			margin: 10px 0;
			border-radius: 8px;
			overflow: hidden;
			border: 1px solid var(--vscode-panel-border, var(--princy-border));
			background: var(--vscode-textCodeBlock-background, var(--princy-surface));
		}
		.code-actions {
			display: flex;
			gap: 4px;
			padding: 4px 6px;
			border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
		}
		.code-actions button {
			border: none;
			background: transparent;
			color: var(--vscode-descriptionForeground, #9d9d9d);
			font-size: 11px;
			padding: 4px 8px;
			border-radius: 4px;
			cursor: pointer;
		}
		.code-actions button:hover {
			background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
			color: var(--vscode-foreground, #cccccc);
		}
		.code-block pre {
			margin: 0;
			padding: 10px 12px;
			overflow: auto;
			font-family: var(--vscode-editor-font-family, Consolas, monospace);
			font-size: 12px;
			line-height: 1.45;
		}
		.plan {
			padding: 14px;
			border-radius: 10px;
			border: 1px solid var(--princy-border);
			background: var(--princy-surface);
			box-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
			animation: chat-turn-enter var(--princy-transition-panel);
		}
		.plan > strong {
			display: block;
			margin-bottom: 8px;
			color: var(--princy-text-strong);
			font-size: 13px;
		}
		.operation { margin: 10px 0; }
		.operation-row { display: flex; gap: 8px; align-items: flex-start; }
		.operation span {
			flex: 1;
			font-size: 12px;
			color: var(--vscode-descriptionForeground, #9d9d9d);
			white-space: pre-wrap;
		}
		.diff {
			margin-top: 6px;
			padding: 8px;
			border-radius: 4px;
			font-family: var(--vscode-editor-font-family, Consolas, monospace);
			font-size: 11px;
			background: var(--vscode-textCodeBlock-background, #1e1e1e);
			border: 1px solid var(--vscode-panel-border, #3c3c3c);
			overflow: auto;
		}
		.diff-line.add { color: var(--vscode-gitDecoration-addedResourceForeground, #73c991); }
		.diff-line.remove { color: var(--vscode-gitDecoration-deletedResourceForeground, #f48771); }
		.plan-actions {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
			margin-top: 10px;
		}
		.plan-actions button {
			padding: 6px 12px;
			border: 1px solid var(--princy-border);
			border-radius: 6px;
			font-size: 12px;
			cursor: pointer;
			background: var(--princy-elevated);
			color: var(--princy-text);
			transition: background var(--princy-transition-fast), transform var(--princy-transition-fast);
		}
		.plan-actions button:hover {
			background: #27272A;
		}
		.plan-actions button.primary {
			border-color: transparent;
			background: var(--princy-accent);
			color: var(--princy-accent-fg);
		}
		.plan-actions button.primary:hover {
			filter: brightness(1.06);
			transform: translateY(-1px);
		}
		.loading-dots span {
			display: inline-block;
			width: 4px;
			height: 4px;
			margin: 0 2px;
			border-radius: 50%;
			background: var(--princy-muted);
			animation: chat-pulse 1.2s ease-in-out infinite;
		}
		.loading-dots span:nth-child(2) { animation-delay: 0.15s; }
		.loading-dots span:nth-child(3) { animation-delay: 0.3s; }
	</style>
</head>
<body>
	<div class="chat-panel">
		<header class="chat-header">
			<div class="chat-header-brand">
				<span class="chat-header-logo" aria-hidden="true">✦</span>
				<div>
					<div class="chat-header-title">Princy IA</div>
					<div class="chat-header-sub">Agent · Composer</div>
				</div>
			</div>
			<div class="chat-header-actions">
				<button type="button" class="chat-header-btn" id="newChat" title="Nova conversa">+ Novo</button>
			</div>
		</header>
		<div class="chat-scroll" id="scroll">
			<div class="chat-welcome" id="empty">
				<div class="chat-welcome-icon">✦</div>
				<h2>Como posso ajudar?</h2>
				<p>Layout estilo Cursor — tema Princy Black, chat à direita, @contexto e Composer multi-arquivo.</p>
				<div class="chat-suggestions">
					<button type="button" class="chat-suggest" data-prompt="Explique o arquivo aberto e sugira melhorias.">Explicar código</button>
					<button type="button" class="chat-suggest" data-prompt="Corrija erros e bugs no projeto atual.">Corrigir bugs</button>
					<button type="button" class="chat-suggest" data-prompt="Refatore para código mais limpo e tipado.">Refatorar</button>
					<button type="button" class="chat-suggest" data-prompt="Crie testes para o módulo selecionado.">Gerar testes</button>
				</div>
			</div>
			<div class="chat-turn-list" id="messages"></div>
			<div class="chat-thinking" id="thinking"></div>
		</div>
		<div class="chat-composer">
			<div class="chat-context-chips" id="contextBar"></div>
			<div class="chat-followups">
				<button type="button" id="qaWorkspace">@workspace</button>
				<button type="button" id="qaFix">/fix</button>
				<button type="button" id="qaExplain">/explain</button>
				<button type="button" id="composer">/composer</button>
				<button type="button" class="mention-btn" data-insert="@file:">@file</button>
				<button type="button" class="mention-btn" data-insert="@selection">@selection</button>
			</div>
			<div id="mentionMenu"></div>
			<div class="chat-input-container">
				<label class="chat-sr-only" for="princy-chat-input">Mensagem</label>
				<textarea id="princy-chat-input" rows="1" placeholder="Pergunte ao Princy IA…"></textarea>
				<div class="chat-input-toolbar">
					<div class="chat-toolbar-left">
						<span class="chat-backend-dot" id="backendDot" title="Agent backend"></span>
						<label class="chat-sr-only" for="princy-agent-select">Modelo</label>
						<select id="princy-agent-select" class="chat-model-select" title="Modelo">
							<option value="auto" selected>Auto</option>
							<option value="deepseek">DeepSeek</option>
							<option value="princy">Princy IA</option>
							<option value="qwen">Qwen</option>
							<option value="codellama">CodeLlama</option>
						</select>
						<select id="segment" style="display:none" aria-hidden="true"><option value="">Auto</option></select>
						<span class="chat-status" id="status">Pronto</span>
					</div>
					<div class="chat-toolbar-right">
						<button type="button" class="chat-toolbar-btn" id="index" title="Indexar workspace">Index</button>
						<button type="button" class="chat-send-btn" id="send" title="Enviar">↑</button>
					</div>
				</div>
			</div>
		</div>
	</div>
	<script nonce="${nonce}">
	${getChatPanelScript()}
	</script>
</body>
</html>`;
}

function getChatPanelScript(): string {
	return `
	(function bootPrincyChat() {
		const vscode = acquireVsCodeApi();
		const input = document.getElementById('princy-chat-input') || document.getElementById('input');
		const agent = document.getElementById('princy-agent-select') || document.getElementById('agent');
		const segment = document.getElementById('segment');
		const messages = document.getElementById('messages');
		const scroll = document.getElementById('scroll');
		const empty = document.getElementById('empty');
		const status = document.getElementById('status');
		const backendDot = document.getElementById('backendDot');
		const thinking = document.getElementById('thinking');
		const contextBar = document.getElementById('contextBar');
		const mentionMenu = document.getElementById('mentionMenu');
		const sendBtn = document.getElementById('send');
		let streamingNode = null;
		let streamingBody = null;

		if (!input) {
			const banner = document.createElement('div');
			banner.id = 'princy-boot-error';
			banner.textContent = 'Painel Princy IA desatualizado (cache). Feche e reabra o painel ou execute: Developer: Reload Window.';
			document.querySelector('.chat-composer')?.prepend(banner) || document.body.prepend(banner);
			vscode.postMessage({ type: 'bootError' });
			return;
		}

		input.removeAttribute('readonly');
		input.removeAttribute('disabled');
		setTimeout(() => input.focus(), 50);

		function insertAtInput(text) {
			input.value = (input.value + (input.value.endsWith(' ') || !input.value ? '' : ' ') + text).trimStart();
			input.focus();
			autoResizeInput();
		}

		for (const btn of document.querySelectorAll('.mention-btn')) {
			btn.addEventListener('click', () => {
				const insert = btn.getAttribute('data-insert') || '';
				insertAtInput(insert);
				if (insert.endsWith(':')) input.setSelectionRange(input.value.length, input.value.length);
			});
		}

		document.getElementById('qaWorkspace')?.addEventListener('click', () => insertAtInput('@codebase '));
		document.getElementById('qaFix')?.addEventListener('click', () => vscode.postMessage({ type: 'quickFix' }));
		document.getElementById('qaExplain')?.addEventListener('click', () => vscode.postMessage({ type: 'quickExplain' }));

		input.addEventListener('input', () => {
			autoResizeInput();
			const at = input.value.lastIndexOf('@');
			if (at >= 0 && !/\\s/.test(input.value.slice(at))) {
				vscode.postMessage({ type: 'mentionQuery', query: input.value.slice(at + 1) });
			} else if (mentionMenu) {
				mentionMenu.style.display = 'none';
			}
		});

		function scrollBottom() {
			scroll.scrollTop = scroll.scrollHeight;
		}

		function hideEmpty() {
			if (empty) empty.style.display = 'none';
		}

		function showEmpty() {
			if (empty) empty.style.display = '';
		}

		function resetConversation() {
			if (messages) messages.innerHTML = '';
			if (thinking) {
				thinking.innerHTML = '';
				thinking.style.display = 'none';
			}
			if (contextBar) contextBar.innerHTML = '';
			streamingNode = null;
			streamingBody = null;
			showEmpty();
			setStatus('Pronto');
			scrollBottom();
		}

		document.getElementById('newChat')?.addEventListener('click', () => {
			resetConversation();
			input.value = '';
			autoResizeInput();
			input.focus();
		});

		for (const pill of document.querySelectorAll('.chat-suggest')) {
			pill.addEventListener('click', () => {
				const prompt = pill.getAttribute('data-prompt') || '';
				if (!prompt) return;
				input.value = prompt;
				autoResizeInput();
				hideEmpty();
				input.focus();
			});
		}

		function setStatus(text) {
			if (status) status.textContent = text || 'Pronto';
		}

		function postChatMessage(priority) {
			const text = input.value.trim();
			if (!text) return;
			vscode.postMessage({
				type: 'sendMessage',
				text,
				agent: agent?.value || 'auto',
				segmentMode: segment?.value || undefined,
				priority: priority || 'normal'
			});
			input.value = '';
			autoResizeInput();
		}

		function autoResizeInput() {
			input.style.height = 'auto';
			input.style.height = Math.min(input.scrollHeight, 200) + 'px';
		}

		sendBtn?.addEventListener('click', () => postChatMessage('normal'));
		document.getElementById('composer')?.addEventListener('click', () => {
			const text = input.value.trim();
			if (!text) {
				input.placeholder = 'Descreva mudança multi-arquivo…';
				input.focus();
				return;
			}
			const picked = !agent || agent.value === 'auto' ? 'deepseek' : agent.value;
			vscode.postMessage({ type: 'requestComposer', text, agent: picked });
			input.value = '';
			autoResizeInput();
		});
		document.getElementById('index')?.addEventListener('click', () => vscode.postMessage({ type: 'indexWorkspace' }));
		input.addEventListener('keydown', event => {
			if (event.key === 'Enter' && !event.shiftKey) {
				event.preventDefault();
				postChatMessage(event.ctrlKey || event.metaKey ? 'high' : 'normal');
			}
		});

		window.addEventListener('message', event => {
			const message = event.data;
			if (message.type === 'focusInput') input.focus();
			if (message.type === 'focusComposer') {
				input.placeholder = 'Descreva mudança multi-arquivo…';
				input.focus();
			}
			if (message.type === 'prefillComposer') {
				input.value = message.text || '';
				input.placeholder = 'Descreva mudança multi-arquivo…';
				autoResizeInput();
				input.focus();
			}
			if (message.type === 'status' || message.type === 'intelligence_status') {
				setStatus(message.text || 'Pronto');
			}
			if (message.type === 'backendStatus' && backendDot) {
				backendDot.classList.toggle('online', Boolean(message.online));
				backendDot.title = (message.online ? 'Backend online' : 'Backend offline') + (message.endpoint ? ' — ' + message.endpoint : '');
			}
			if (message.type === 'defaultAgent' && message.agent && agent) {
				if (Array.from(agent.options).some(o => o.value === message.agent)) {
					agent.value = message.agent;
				}
			}
			if (message.type === 'reloadPanel') {
				input.removeAttribute('readonly');
				input.removeAttribute('disabled');
				input.focus();
			}
			if (message.type === 'agents') renderAgents(message.models || []);
			if (message.type === 'thinking') renderThinking(message.steps || []);
			if (message.type === 'append') {
				hideEmpty();
				if (message.role === 'user') appendUser(message.text);
				else appendAssistant(message.text, message.suggestedCommands);
				scrollBottom();
			}
			if (message.type === 'composerPlan') {
				hideEmpty();
				renderComposerPlan(message.instruction, message.agent, message.plan);
				scrollBottom();
			}
			if (message.type === 'context') renderContext(message);
			if (message.type === 'mentionSuggestions') renderMentionMenu(message.items || []);
			if (message.type === 'streamStart') {
				hideEmpty();
				streamingNode = createTurn('assistant', 'Princy IA', true);
				streamingBody = streamingNode.querySelector('.chat-turn-body');
				if (streamingBody) {
					streamingBody.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span>';
				}
				messages.appendChild(streamingNode);
				scrollBottom();
			}
			if (message.type === 'streamDelta' && streamingBody) {
				streamingBody.textContent = message.text || '';
				scrollBottom();
			}
			if (message.type === 'streamEnd') {
				if (streamingNode && streamingBody) {
					const text = message.text || '';
					streamingBody.classList.remove('cursor-blink');
					streamingBody.textContent = '';
					renderRichText(streamingBody, text);
					if (message.suggestedCommands) {
						appendCommandButtons(streamingNode, message.suggestedCommands);
					}
				} else if (message.text) {
					appendAssistant(message.text, message.suggestedCommands);
				}
				streamingNode = null;
				streamingBody = null;
				scrollBottom();
			}
		});

		function createTurn(role, label, streaming) {
			const turn = document.createElement('div');
			turn.className = 'chat-turn ' + role + (streaming ? ' streaming' : '');
			const header = document.createElement('div');
			header.className = 'chat-turn-header';
			const avatar = document.createElement('span');
			avatar.className = 'chat-turn-avatar';
			avatar.textContent = role === 'user' ? 'V' : '✦';
			const name = document.createElement('span');
			name.textContent = label;
			header.appendChild(avatar);
			header.appendChild(name);
			const body = document.createElement('div');
			body.className = 'chat-turn-body' + (streaming ? ' cursor-blink' : '');
			turn.appendChild(header);
			turn.appendChild(body);
			return turn;
		}

		function appendUser(text) {
			const turn = createTurn('user', 'Você', false);
			turn.querySelector('.chat-turn-body').textContent = text;
			messages.appendChild(turn);
		}

		function appendAssistant(text, suggestedCommands) {
			const turn = createTurn('assistant', 'Princy IA', false);
			const body = turn.querySelector('.chat-turn-body');
			renderRichText(body, text);
			if (suggestedCommands) appendCommandButtons(turn, suggestedCommands);
			messages.appendChild(turn);
		}

		function appendCommandButtons(container, commands) {
			for (const command of commands) {
				const button = document.createElement('button');
				button.className = 'cmd-btn';
				button.textContent = '▶ ' + command;
				button.addEventListener('click', () => vscode.postMessage({ type: 'runCommand', command }));
				container.appendChild(button);
			}
		}

		function renderMentionMenu(items) {
			if (!mentionMenu) return;
			mentionMenu.innerHTML = '';
			if (!items.length) {
				mentionMenu.style.display = 'none';
				return;
			}
			mentionMenu.style.display = 'block';
			for (const item of items) {
				const row = document.createElement('button');
				row.type = 'button';
				row.textContent = item.label || item.insert;
				row.addEventListener('click', () => {
					const at = input.value.lastIndexOf('@');
					const prefix = at >= 0 ? input.value.slice(0, at) : input.value;
					input.value = (prefix + item.insert).trim();
					mentionMenu.style.display = 'none';
					input.focus();
				});
				mentionMenu.appendChild(row);
			}
		}

		function renderContext(message) {
			contextBar.innerHTML = '';
			if (message.fileName) {
				const chip = document.createElement('span');
				chip.className = 'chip on';
				chip.textContent = message.fileName;
				contextBar.appendChild(chip);
			}
			if (message.hasSelection) {
				const chip = document.createElement('span');
				chip.className = 'chip on';
				chip.textContent = 'Selection' + (message.selectionPreview ? ': ' + message.selectionPreview : '');
				contextBar.appendChild(chip);
			}
		}

		function renderAgents(models) {
			if (!agent) return;
			const selected = agent.value || 'auto';
			const autoOpt = agent.querySelector('option[value="auto"]');
			agent.innerHTML = '';
			if (autoOpt) agent.appendChild(autoOpt);
			else {
				const o = document.createElement('option');
				o.value = 'auto';
				o.textContent = 'Auto';
				agent.appendChild(o);
			}
			for (const model of models) {
				const option = document.createElement('option');
				option.value = model.id;
				option.textContent = model.label.replace(/^Princy Ai\\s*/i, '').trim() || model.label;
				agent.appendChild(option);
			}
			if (Array.from(agent.options).some(o => o.value === selected)) agent.value = selected;
		}

		function renderComposerPlan(instruction, agentName, plan) {
			const wrapper = document.createElement('div');
			wrapper.className = 'plan';
			const title = document.createElement('strong');
			title.textContent = plan.summary;
			wrapper.appendChild(title);
			if (plan.affectedFiles?.length) {
				const files = document.createElement('div');
				files.style.cssText = 'font-size:12px;color:var(--vscode-descriptionForeground,#9d9d9d);margin:8px 0';
				files.textContent = 'Arquivos: ' + plan.affectedFiles.join(', ');
				wrapper.appendChild(files);
			}
			const topActions = document.createElement('div');
			topActions.className = 'plan-actions';
			const applyAll = document.createElement('button');
			applyAll.className = 'primary';
			applyAll.textContent = 'Apply All';
			applyAll.addEventListener('click', () => {
				vscode.postMessage({ type: 'applyComposerPlan', instruction, agent: agentName, plan, operationIds: (plan.operations || []).map(o => o.id) });
			});
			const rejectAll = document.createElement('button');
			rejectAll.textContent = 'Reject All';
			rejectAll.addEventListener('click', () => wrapper.remove());
			topActions.append(applyAll, rejectAll);
			wrapper.appendChild(topActions);
			for (const warning of plan.warnings || []) {
				const w = document.createElement('div');
				w.style.cssText = 'font-size:12px;color:var(--vscode-descriptionForeground,#9d9d9d);margin-top:6px';
				w.textContent = warning;
				wrapper.appendChild(w);
			}
			for (let opIndex = 0; opIndex < (plan.operations || []).length; opIndex++) {
				const operation = plan.operations[opIndex];
				const block = document.createElement('div');
				block.className = 'operation';
				const fieldId = 'princy-op-' + opIndex + '-' + String(operation.id || 'op').replace(/[^a-zA-Z0-9_-]/g, '_');
				const checkbox = document.createElement('input');
				checkbox.type = 'checkbox';
				checkbox.id = fieldId;
				checkbox.checked = true;
				checkbox.value = operation.id;
				const row = document.createElement('label');
				row.className = 'operation-row';
				row.htmlFor = fieldId;
				const text = document.createElement('span');
				text.textContent = operation.type + ' · ' + (operation.filePath || operation.command);
				row.appendChild(text);
				block.append(checkbox, row);
				const diff = renderOperationPreview(operation);
				if (diff) block.appendChild(diff);
				wrapper.appendChild(block);
			}
			const actions = document.createElement('div');
			actions.className = 'plan-actions';
			const apply = document.createElement('button');
			apply.className = 'primary';
			apply.textContent = 'Apply';
			apply.addEventListener('click', () => {
				vscode.postMessage({ type: 'applyComposerPlan', instruction, agent: agentName, plan, operationIds: Array.from(wrapper.querySelectorAll('input:checked')).map(i => i.value) });
			});
			const reject = document.createElement('button');
			reject.textContent = 'Reject';
			reject.addEventListener('click', () => wrapper.remove());
			actions.append(apply, reject);
			wrapper.appendChild(actions);
			messages.appendChild(wrapper);
		}

		function renderThinking(steps) {
			if (!thinking) return;
			thinking.innerHTML = '';
			if (!steps.length) {
				thinking.style.display = 'none';
				return;
			}
			thinking.style.display = 'block';
			for (const step of steps) {
				const item = document.createElement('div');
				item.className = 'step ' + step.state;
				item.textContent = step.label;
				thinking.appendChild(item);
			}
		}

		function renderRichText(container, text) {
			const fence = String.fromCharCode(96, 96, 96);
			const parts = String(text || '').split(fence);
			for (let index = 0; index < parts.length; index++) {
				if (index % 2 === 0) {
					if (parts[index]) container.appendChild(document.createTextNode(parts[index]));
					continue;
				}
				const raw = parts[index];
				const nl = raw.indexOf('\\n');
				const code = (nl >= 0 ? raw.slice(nl + 1) : raw).trim();
				container.appendChild(renderCodeBlock(code));
			}
		}

		function renderCodeBlock(code) {
			const wrapper = document.createElement('div');
			wrapper.className = 'code-block';
			const actions = document.createElement('div');
			actions.className = 'code-actions';
			for (const [label, fn] of [
				['Copy', () => navigator.clipboard?.writeText(code)],
				['Insert', () => vscode.postMessage({ type: 'insertCode', code })],
				['Apply', () => vscode.postMessage({ type: 'applyCodeToFile', code })],
			]) {
				const button = document.createElement('button');
				button.textContent = label;
				button.addEventListener('click', fn);
				actions.appendChild(button);
			}
			const pre = document.createElement('pre');
			pre.textContent = code;
			wrapper.append(actions, pre);
			return wrapper;
		}

		function renderOperationPreview(operation) {
			if (!['modify','create','delete'].includes(operation.type)) return undefined;
			const diff = document.createElement('div');
			diff.className = 'diff';
			if (operation.type === 'modify') {
				appendDiffLine(diff, '- ' + (operation.search || '…'), 'remove');
				appendDiffLine(diff, '+ ' + (operation.replace || operation.content || '…'), 'add');
			} else if (operation.type === 'create') {
				appendDiffLine(diff, '+ ' + operation.filePath, 'add');
			} else {
				appendDiffLine(diff, '- ' + operation.filePath, 'remove');
			}
			return diff;
		}

		function appendDiffLine(container, text, kind) {
			const line = document.createElement('div');
			line.className = 'diff-line ' + kind;
			line.textContent = text;
			container.appendChild(line);
		}
	})();
	`;
}
