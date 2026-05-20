/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function buildChatPanelHtml(cspSource: string, nonce: string): string {
	return /* html */`<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
	<title>Princy Ai</title>
	<style>
		* { box-sizing: border-box; margin: 0; padding: 0; }
		body {
			margin: 0;
			padding: 0;
			overflow: hidden;
			color: var(--vscode-foreground, #cccccc);
			background: var(--vscode-editor-background, #1e1e1e);
			font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif);
			font-size: var(--vscode-font-size, 13px);
		}
		.princy-root {
			height: 100vh;
			display: flex;
			flex-direction: column;
			background: var(--vscode-editor-background, #1e1e1e);
		}
		.princy-header {
			height: 42px;
			flex: 0 0 auto;
			padding: 0 12px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
			background: var(--vscode-sideBar-background, #252526);
		}
		.princy-title {
			display: flex;
			align-items: center;
			gap: 8px;
			font-weight: 600;
		}
		.princy-dot {
			width: 8px;
			height: 8px;
			border-radius: 999px;
			background: var(--vscode-errorForeground, #f48771);
			flex-shrink: 0;
		}
		.princy-dot.online {
			background: var(--vscode-testing-iconPassed, #73c991);
			box-shadow: 0 0 8px var(--vscode-testing-iconPassed, #73c991);
		}
		.princy-agent {
			max-width: 140px;
			height: 26px;
			background: var(--vscode-dropdown-background, #3c3c3c);
			color: var(--vscode-dropdown-foreground, #cccccc);
			border: 1px solid var(--vscode-dropdown-border, #3c3c3c);
			border-radius: 4px;
			padding: 2px 8px;
			outline: none;
			font-size: 11px;
		}
		.princy-messages {
			flex: 1;
			overflow-y: auto;
			padding: 16px 14px;
		}
		.princy-empty {
			min-height: 220px;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			text-align: center;
			opacity: 0.9;
		}
		.princy-logo {
			width: 42px;
			height: 42px;
			margin-bottom: 10px;
			border-radius: 12px;
			display: grid;
			place-items: center;
			background: var(--vscode-editorWidget-background, #252526);
			border: 1px solid var(--vscode-widget-border, #454545);
			font-size: 20px;
		}
		.princy-empty h2 { margin: 0 0 6px; font-size: 17px; font-weight: 600; }
		.princy-empty p {
			margin: 0;
			max-width: 320px;
			color: var(--vscode-descriptionForeground, #9d9d9d);
			line-height: 1.45;
		}
		.princy-message { margin: 0 0 14px; line-height: 1.5; }
		.princy-message-header {
			margin-bottom: 6px;
			color: var(--vscode-descriptionForeground, #9d9d9d);
			font-size: 11px;
		}
		.princy-bubble {
			padding: 10px 12px;
			border-radius: 8px;
			white-space: pre-wrap;
			word-break: break-word;
		}
		.princy-message.user .princy-bubble {
			background: transparent;
			border: 1px solid var(--vscode-input-border, #3c3c3c);
		}
		.princy-message.assistant .princy-bubble {
			background: var(--vscode-editorWidget-background, #252526);
			border: 1px solid var(--vscode-widget-border, #454545);
		}
		.princy-composer {
			flex: 0 0 auto;
			padding: 10px;
			border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
			background: var(--vscode-sideBar-background, #252526);
		}
		.princy-context-row, .chips {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
			margin-bottom: 8px;
		}
		.princy-context-row button, .chips .chip {
			height: 24px;
			padding: 0 8px;
			border-radius: 999px;
			border: none;
			background: var(--vscode-button-secondaryBackground, #3a3d41);
			color: var(--vscode-button-secondaryForeground, #ffffff);
			font-size: 11px;
			cursor: pointer;
		}
		.chips .chip.on {
			background: var(--vscode-list-activeSelectionBackground, #094771);
		}
		.princy-input-box {
			border: 1px solid var(--vscode-input-border, #3c3c3c);
			background: var(--vscode-input-background, #3c3c3c);
			border-radius: 8px;
			overflow: hidden;
		}
		.princy-input-box textarea {
			width: 100%;
			min-height: 78px;
			max-height: 180px;
			resize: vertical;
			border: none;
			outline: none;
			padding: 10px;
			display: block;
			color: var(--vscode-input-foreground, #cccccc);
			background: transparent;
			font-family: inherit;
			font-size: inherit;
			line-height: 1.45;
		}
		.princy-actions {
			min-height: 34px;
			padding: 6px 8px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
		}
		.princy-status {
			color: var(--vscode-descriptionForeground, #9d9d9d);
			font-size: 11px;
		}
		.princy-action-btns { display: flex; gap: 6px; }
		.princy-secondary {
			height: 26px;
			padding: 0 10px;
			border: none;
			border-radius: 4px;
			background: var(--vscode-button-secondaryBackground, #3a3d41);
			color: var(--vscode-button-secondaryForeground, #fff);
			font-size: 11px;
			cursor: pointer;
		}
		.princy-send {
			height: 26px;
			padding: 0 12px;
			border: none;
			border-radius: 4px;
			background: var(--vscode-button-background, #0e639c);
			color: var(--vscode-button-foreground, #ffffff);
			cursor: pointer;
			font-size: 12px;
		}
		.princy-send:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
		.thinking {
			border-left: 2px solid var(--vscode-panel-border, #3c3c3c);
			color: var(--vscode-descriptionForeground, #9d9d9d);
			font-size: 12px;
			margin: 8px 0;
			padding-left: 10px;
		}
		.thinking .step { line-height: 1.6; }
		.thinking .step.active { color: var(--vscode-foreground, #cccccc); }
		.thinking .step.done { color: var(--vscode-testing-iconPassed, #73c991); }
		#mentionMenu {
			background: var(--vscode-editorWidget-background, #252526);
			border: 1px solid var(--vscode-widget-border, #454545);
			border-radius: 6px;
			margin-bottom: 6px;
			max-height: 140px;
			overflow: auto;
		}
		.msg-assistant.streaming .princy-bubble { border: none; background: transparent; }
		.cursor-blink::after {
			animation: blink 1s step-end infinite;
			color: var(--vscode-descriptionForeground, #9d9d9d);
			content: '▋';
			margin-left: 1px;
		}
		@keyframes blink { 50% { opacity: 0; } }
		.cmd-btn {
			background: var(--vscode-button-secondaryBackground, #3a3d41);
			color: var(--vscode-button-secondaryForeground, #ffffff);
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: 11px;
			margin-top: 6px;
			padding: 4px 10px;
		}
		.plan {
			background: var(--vscode-editorWidget-background, #252526);
			border: 1px solid var(--vscode-widget-border, #454545);
			border-radius: 8px;
			padding: 12px;
		}
		.plan > strong { display: block; margin-bottom: 8px; }
		.operation { margin: 10px 0; }
		.operation-row { align-items: flex-start; display: flex; gap: 8px; }
		.operation span {
			color: var(--vscode-descriptionForeground, #9d9d9d);
			flex: 1;
			font-size: 12px;
			white-space: pre-wrap;
		}
		.diff {
			background: var(--vscode-textCodeBlock-background, #0a0a0a);
			border: 1px solid var(--vscode-panel-border, #3c3c3c);
			border-radius: 6px;
			font-family: var(--vscode-editor-font-family, Consolas, monospace);
			font-size: 11px;
			margin-top: 6px;
			overflow: auto;
			padding: 8px;
		}
		.diff-line.add { color: var(--vscode-gitDecoration-addedResourceForeground, #73c991); }
		.diff-line.remove { color: var(--vscode-gitDecoration-deletedResourceForeground, #f48771); }
		.code-block {
			background: var(--vscode-textCodeBlock-background, #0a0a0a);
			border: 1px solid var(--vscode-panel-border, #3c3c3c);
			border-radius: 6px;
			margin: 10px 0;
			overflow: hidden;
		}
		.code-actions {
			border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
			display: flex;
			flex-wrap: wrap;
			gap: 4px;
			padding: 4px 6px;
		}
		.code-actions button {
			background: transparent;
			border: none;
			border-radius: 4px;
			color: var(--vscode-descriptionForeground, #9d9d9d);
			cursor: pointer;
			font-size: 11px;
			padding: 4px 8px;
		}
		.code-actions button:hover {
			background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
			color: var(--vscode-foreground, #cccccc);
		}
		.code-block pre {
			font-family: var(--vscode-editor-font-family, Consolas, monospace);
			font-size: 12px;
			line-height: 1.45;
			margin: 0;
			overflow: auto;
			padding: 10px 12px;
		}
		.plan-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
		.plan-actions button {
			background: var(--vscode-button-secondaryBackground, #3a3d41);
			color: var(--vscode-button-secondaryForeground, #ffffff);
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: 12px;
			padding: 6px 12px;
		}
		.plan-actions button.primary {
			background: var(--vscode-button-background, #0e639c);
			color: var(--vscode-button-foreground, #ffffff);
		}
		.cursor-blink::after {
			animation: blink 1s step-end infinite;
			color: var(--vscode-descriptionForeground, #9d9d9d);
			content: '▋';
			margin-left: 1px;
		}
		@keyframes blink { 50% { opacity: 0; } }
		.cmd-btn {
			background: var(--vscode-button-secondaryBackground, #3a3d41);
			color: var(--vscode-button-secondaryForeground, #ffffff);
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: 11px;
			margin-top: 6px;
			padding: 4px 10px;
		}
	</style>
</head>
<body>
	<div class="princy-root">
		<header class="princy-header">
			<div class="princy-title">
				<span class="princy-dot" id="backendDot" title="Agent backend"></span>
				<span>Princy IA</span>
			</div>
			<select id="agent" class="princy-agent" title="Modelo" aria-label="Modelo">
				<option value="auto" selected>Auto</option>
				<option value="deepseek">DeepSeek</option>
				<option value="princy">Princy IA</option>
				<option value="qwen">Qwen</option>
				<option value="codellama">CodeLlama</option>
			</select>
			<select id="segment" class="princy-agent" style="display:none" aria-hidden="true">
				<option value="">Auto</option>
			</select>
		</header>
		<main class="princy-messages" id="scroll">
			<div class="princy-empty" id="empty">
				<div class="princy-logo">✦</div>
				<h2>Como posso ajudar?</h2>
				<p>Peça para explicar, corrigir ou criar código no projeto atual.</p>
			</div>
			<div id="messages"></div>
			<div class="thinking" id="thinking" style="display:none"></div>
		</main>
		<footer class="princy-composer">
			<div class="chips" id="contextBar"></div>
			<div class="princy-context-row">
				<button type="button" data-chip="workspace" id="qaWorkspace">@workspace</button>
				<button type="button" id="qaFix">/fix</button>
				<button type="button" id="qaExplain">/explain</button>
				<button type="button" id="composer">/composer</button>
				<button type="button" class="mention-btn" data-insert="@file:">@file</button>
				<button type="button" class="mention-btn" data-insert="@selection">@selection</button>
			</div>
			<div id="mentionMenu" style="display:none"></div>
			<div class="princy-input-box">
				<textarea id="input" placeholder="Pergunte ao Princy IA…"></textarea>
				<div class="princy-actions">
					<span id="status" class="princy-status">Pronto</span>
					<div class="princy-action-btns">
						<button type="button" class="princy-secondary" id="index" title="Indexar workspace">Index</button>
						<button type="button" class="princy-send" id="send">Enviar</button>
					</div>
				</div>
			</div>
		</footer>
	</div>
	<script nonce="${nonce}">
	${getChatPanelScript()}
	</script>
</body>
</html>`;
}

function getChatPanelScript(): string {
	return `
		const vscode = acquireVsCodeApi();
		const input = document.getElementById('input');
		const agent = document.getElementById('agent');
		const segment = document.getElementById('segment');
		const messages = document.getElementById('messages');
		const scroll = document.getElementById('scroll');
		const empty = document.getElementById('empty');
		const status = document.getElementById('status');
		const backendDot = document.getElementById('backendDot');
		const thinking = document.getElementById('thinking');
		const contextBar = document.getElementById('contextBar');
		const mentionMenu = document.getElementById('mentionMenu');
		let streamingNode = null;
		let streamingBody = null;

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
				const query = input.value.slice(at + 1);
				vscode.postMessage({ type: 'mentionQuery', query });
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

		function setStatus(text) {
			if (status) status.textContent = text || 'Pronto';
		}

		function postChatMessage(priority) {
			const text = input.value.trim();
			if (!text) return;
			vscode.postMessage({
				type: 'sendMessage',
				text,
				agent: agent.value,
				segmentMode: segment.value || undefined,
				priority: priority || 'normal'
			});
			input.value = '';
			autoResizeInput();
		}

		function autoResizeInput() {
			input.style.height = 'auto';
			input.style.height = Math.min(input.scrollHeight, 160) + 'px';
		}

		document.getElementById('send').addEventListener('click', () => postChatMessage('normal'));
		document.getElementById('composer')?.addEventListener('click', () => {
			const text = input.value.trim();
			if (!text) { input.placeholder = 'Descreva mudança multi-arquivo…'; input.focus(); return; }
			const picked = agent.value === 'auto' ? 'deepseek' : agent.value;
			vscode.postMessage({ type: 'requestComposer', text, agent: picked });
			input.value = '';
			autoResizeInput();
		});
		document.getElementById('index').addEventListener('click', () => vscode.postMessage({ type: 'indexWorkspace' }));
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
				input.placeholder = 'Descreva mudança multi-arquivo para o Composer…';
				input.focus();
			}
			if (message.type === 'prefillComposer') {
				input.value = message.text || '';
				input.placeholder = 'Descreva mudança multi-arquivo para o Composer…';
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
				agent.value = message.agent;
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
				streamingNode = document.createElement('div');
				streamingNode.className = 'princy-message assistant msg-assistant streaming';
				const header = document.createElement('div');
				header.className = 'princy-message-header';
				header.textContent = 'Princy IA';
				streamingBody = document.createElement('div');
				streamingBody.className = 'princy-bubble cursor-blink';
				streamingNode.appendChild(header);
				streamingNode.appendChild(streamingBody);
				messages.appendChild(streamingNode);
				scrollBottom();
			}
			if (message.type === 'streamDelta' && streamingBody) {
				streamingBody.textContent = message.text || '';
				scrollBottom();
			}
			if (message.type === 'streamEnd') {
				if (streamingNode) {
					const text = message.text || '';
					streamingNode.replaceChildren();
					const header = document.createElement('div');
					header.className = 'princy-message-header';
					header.textContent = 'Princy IA';
					const bubble = document.createElement('div');
					bubble.className = 'princy-bubble';
					streamingNode.appendChild(header);
					streamingNode.appendChild(bubble);
					renderRichText(bubble, text);
					if (message.suggestedCommands) {
						for (const command of message.suggestedCommands) {
							const button = document.createElement('button');
							button.className = 'cmd-btn';
							button.textContent = '▶ ' + command;
							button.addEventListener('click', () => vscode.postMessage({ type: 'runCommand', command }));
							streamingNode.appendChild(button);
						}
					}
				} else if (message.text) {
					appendAssistant(message.text, message.suggestedCommands);
				}
				streamingNode = null;
				streamingBody = null;
				scrollBottom();
			}
		});

		function appendUser(text) {
			const item = document.createElement('div');
			item.className = 'princy-message user';
			const header = document.createElement('div');
			header.className = 'princy-message-header';
			header.textContent = 'Você';
			const bubble = document.createElement('div');
			bubble.className = 'princy-bubble';
			bubble.textContent = text;
			item.appendChild(header);
			item.appendChild(bubble);
			messages.appendChild(item);
		}

		function appendAssistant(text, suggestedCommands) {
			const item = document.createElement('div');
			item.className = 'princy-message assistant';
			const header = document.createElement('div');
			header.className = 'princy-message-header';
			header.textContent = 'Princy IA';
			const bubble = document.createElement('div');
			bubble.className = 'princy-bubble';
			item.appendChild(header);
			item.appendChild(bubble);
			renderRichText(bubble, text);
			if (suggestedCommands) {
				for (const command of suggestedCommands) {
					const button = document.createElement('button');
					button.className = 'cmd-btn';
					button.textContent = '▶ ' + command;
					button.addEventListener('click', () => vscode.postMessage({ type: 'runCommand', command }));
					item.appendChild(button);
				}
			}
			messages.appendChild(item);
		}

		function renderMentionMenu(items) {
			if (!mentionMenu) return;
			mentionMenu.innerHTML = '';
			if (!items.length) { mentionMenu.style.display = 'none'; return; }
			mentionMenu.style.display = 'block';
			for (const item of items) {
				const row = document.createElement('button');
				row.type = 'button';
				row.className = 'chip';
				row.style.display = 'block';
				row.style.width = '100%';
				row.style.textAlign = 'left';
				row.style.margin = '4px';
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
			const selected = agent.value || 'deepseek';
			agent.innerHTML = '';
			for (const model of models) {
				const option = document.createElement('option');
				option.value = model.id;
				option.textContent = model.label;
				agent.appendChild(option);
			}
			if (Array.from(agent.options).some(o => o.value === selected)) agent.value = selected;
			else if (agent.options.length) agent.value = agent.options[0].value;
		}

		function renderComposerPlan(instruction, agentName, plan) {
			const wrapper = document.createElement('div');
			wrapper.className = 'plan';
			const title = document.createElement('strong');
			title.textContent = plan.summary;
			wrapper.appendChild(title);

			if (plan.affectedFiles && plan.affectedFiles.length) {
				const files = document.createElement('div');
				files.style.fontSize = '12px';
				files.style.color = 'var(--vscode-descriptionForeground, #9d9d9d)';
				files.style.margin = '8px 0';
				files.textContent = 'Arquivos: ' + plan.affectedFiles.join(', ');
				wrapper.appendChild(files);
			}

			const topActions = document.createElement('div');
			topActions.className = 'plan-actions';
			const applyAll = document.createElement('button');
			applyAll.className = 'primary';
			applyAll.textContent = 'Apply All';
			applyAll.addEventListener('click', () => {
				const operationIds = (plan.operations || []).map(o => o.id);
				vscode.postMessage({ type: 'applyComposerPlan', instruction, agent: agentName, plan, operationIds });
			});
			const rejectAll = document.createElement('button');
			rejectAll.textContent = 'Reject All';
			rejectAll.addEventListener('click', () => wrapper.remove());
			topActions.appendChild(applyAll);
			topActions.appendChild(rejectAll);
			wrapper.appendChild(topActions);

			for (const warning of plan.warnings || []) {
				const w = document.createElement('div');
				w.style.color = 'var(--vscode-descriptionForeground, #9d9d9d)';
				w.style.fontSize = '12px';
				w.style.marginTop = '6px';
				w.textContent = warning;
				wrapper.appendChild(w);
			}
			for (const operation of plan.operations || []) {
				const block = document.createElement('div');
				block.className = 'operation';
				const row = document.createElement('label');
				row.className = 'operation-row';
				const checkbox = document.createElement('input');
				checkbox.type = 'checkbox';
				checkbox.checked = true;
				checkbox.value = operation.id;
				const text = document.createElement('span');
				text.textContent = operation.type + ' · ' + (operation.filePath || operation.command);
				row.appendChild(checkbox);
				row.appendChild(text);
				block.appendChild(row);
				if (operation.type === 'modify' || operation.type === 'create') {
					const preview = document.createElement('button');
					preview.className = 'cmd-btn';
					preview.textContent = 'Diff no editor';
					preview.addEventListener('click', () => vscode.postMessage({ type: 'previewComposerOperation', operation }));
					block.appendChild(preview);
				}
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
				const operationIds = Array.from(wrapper.querySelectorAll('input:checked')).map(i => i.value);
				vscode.postMessage({ type: 'applyComposerPlan', instruction, agent: agentName, plan, operationIds });
			});
			const reject = document.createElement('button');
			reject.textContent = 'Reject';
			reject.addEventListener('click', () => wrapper.remove());
			actions.appendChild(apply);
			actions.appendChild(reject);
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
			wrapper.appendChild(actions);
			wrapper.appendChild(pre);
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
	`;
}
