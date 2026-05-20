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
			color: var(--vscode-foreground, #cccccc);
			background: var(--vscode-sideBar-background, #252526);
			font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif);
			font-size: var(--vscode-font-size, 13px);
			height: 100%;
			overflow: hidden;
		}
		.chat-shell {
			display: flex;
			flex-direction: column;
			height: 100vh;
			background: var(--vscode-sideBar-background, #252526);
		}
		.chat-header {
			height: 36px;
			padding: 0 12px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 8px;
			flex-shrink: 0;
			border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
			background: var(--vscode-editor-background, #1e1e1e);
		}
		.chat-title {
			font-size: 13px;
			font-weight: 600;
			color: var(--vscode-foreground, #cccccc);
			white-space: nowrap;
		}
		.header-controls {
			align-items: center;
			display: flex;
			flex: 1;
			gap: 6px;
			justify-content: flex-end;
			min-width: 0;
		}
		.agent-select {
			background: var(--vscode-dropdown-background, #3c3c3c);
			color: var(--vscode-dropdown-foreground, #cccccc);
			border: 1px solid var(--vscode-dropdown-border, #3c3c3c);
			border-radius: 4px;
			padding: 4px 8px;
			font-size: 11px;
			max-width: 110px;
			cursor: pointer;
		}
		.backend-pill {
			color: var(--vscode-errorForeground, #f48771);
			font-size: 10px;
			white-space: nowrap;
		}
		.backend-pill.online { color: var(--vscode-testing-iconPassed, #73c991); }
		.messages-scroll {
			flex: 1;
			overflow-y: auto;
			overflow-x: hidden;
			padding: 12px;
		}
		.empty {
			color: var(--vscode-descriptionForeground, #9d9d9d);
			font-size: 13px;
			line-height: 1.5;
			margin-top: 24px;
			text-align: center;
		}
		.empty strong {
			color: var(--vscode-foreground, #cccccc);
			display: block;
			font-size: 14px;
			font-weight: 600;
			margin-bottom: 8px;
		}
		.empty .engine-pill {
			background: var(--vscode-badge-background, #4d4d4d);
			color: var(--vscode-badge-foreground, #ffffff);
			border-radius: 4px;
			display: inline-block;
			font-size: 11px;
			margin-bottom: 10px;
			padding: 3px 8px;
		}
		.messages { display: flex; flex-direction: column; gap: 14px; }
		.msg-user-wrap { display: flex; justify-content: flex-end; }
		.message.user,
		.msg-user {
			color: var(--vscode-input-foreground, #cccccc);
			line-height: 1.45;
			max-width: 92%;
			padding: 8px 10px;
			white-space: pre-wrap;
			word-break: break-word;
		}
		.message.assistant,
		.msg-assistant {
			line-height: 1.45;
			max-width: 100%;
			white-space: pre-wrap;
			word-break: break-word;
		}
		.message.assistant,
		.msg-assistant:not(.streaming) {
			background: var(--vscode-editorWidget-background, #252526);
			border: 1px solid var(--vscode-widget-border, #454545);
			border-radius: 8px;
			padding: 10px;
		}
		.msg-assistant .label,
		.message.assistant .label {
			color: var(--vscode-descriptionForeground, #9d9d9d);
			display: block;
			font-size: 11px;
			font-weight: 500;
			margin-bottom: 6px;
		}
		.msg-assistant.streaming { background: transparent; border: none; padding: 0; }
		.thinking {
			border-left: 2px solid var(--vscode-panel-border, #3c3c3c);
			color: var(--vscode-descriptionForeground, #9d9d9d);
			font-size: 12px;
			margin: 0 0 12px;
			padding-left: 10px;
		}
		.thinking .step { line-height: 1.6; }
		.thinking .step.active { color: var(--vscode-foreground, #cccccc); }
		.thinking .step.done { color: var(--vscode-testing-iconPassed, #73c991); }
		.status-bar {
			color: var(--vscode-descriptionForeground, #9d9d9d);
			font-size: 11px;
			line-height: 1.4;
			min-height: 16px;
			padding: 0 12px 6px;
		}
		.chat-input-wrap {
			border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
			background: var(--vscode-editor-background, #1e1e1e);
			padding: 8px;
			flex-shrink: 0;
		}
		.quick-actions,
		.chips {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
			margin-bottom: 6px;
			min-height: 0;
		}
		.quick-actions button,
		.chip,
		.mention-btn {
			background: var(--vscode-button-secondaryBackground, #3a3d41);
			color: var(--vscode-button-secondaryForeground, #ffffff);
			border: none;
			border-radius: 4px;
			padding: 3px 8px;
			font-size: 11px;
			cursor: pointer;
		}
		.quick-actions button:hover,
		.mention-btn:hover { opacity: 0.9; }
		.chip.on {
			background: var(--vscode-list-activeSelectionBackground, #094771);
			color: var(--vscode-list-activeSelectionForeground, #ffffff);
		}
		#mentionMenu {
			background: var(--vscode-editorWidget-background, #252526);
			border: 1px solid var(--vscode-widget-border, #454545);
			border-radius: 6px;
			margin-bottom: 6px;
			max-height: 140px;
			overflow: auto;
		}
		textarea {
			width: 100%;
			min-height: 64px;
			max-height: 160px;
			resize: vertical;
			box-sizing: border-box;
			background: var(--vscode-input-background, #3c3c3c);
			color: var(--vscode-input-foreground, #cccccc);
			border: 1px solid var(--vscode-input-border, #3c3c3c);
			border-radius: 6px;
			padding: 8px;
			font-family: var(--vscode-font-family, inherit);
			font-size: var(--vscode-font-size, 13px);
			line-height: 1.45;
			outline: none;
		}
		textarea::placeholder { color: var(--vscode-input-placeholderForeground, #9d9d9d); }
		.send-row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-top: 6px;
			gap: 8px;
		}
		.send-row .tools { display: flex; gap: 4px; }
		.icon-btn {
			background: var(--vscode-button-secondaryBackground, #3a3d41);
			color: var(--vscode-button-secondaryForeground, #ffffff);
			border: none;
			border-radius: 4px;
			padding: 5px 10px;
			font-size: 11px;
			cursor: pointer;
		}
		.icon-btn:hover { opacity: 0.9; }
		.send {
			background: var(--vscode-button-background, #0e639c);
			color: var(--vscode-button-foreground, #ffffff);
			border: none;
			border-radius: 4px;
			padding: 5px 12px;
			font-size: 12px;
			cursor: pointer;
		}
		.send:hover { opacity: 0.92; }
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
	<div class="chat-shell">
		<header class="chat-header">
			<span class="chat-title">Princy IA</span>
			<div class="header-controls">
				<select id="agent" class="agent-select" title="Modelo" aria-label="Modelo">
					<option value="deepseek" selected>DeepSeek</option>
					<option value="princy">Princy</option>
					<option value="qwen">Qwen</option>
					<option value="codellama">CodeLlama</option>
					<option value="llama3">Llama 3.1</option>
					<option value="mistral">Mistral</option>
					<option value="openai">OpenAI</option>
				</select>
				<select id="segment" class="agent-select" title="Modo" aria-label="Modo">
					<option value="">Auto</option>
					<option value="LOGIC">Logic</option>
					<option value="FRONTEND">UI</option>
					<option value="BACKEND">API</option>
					<option value="DEBUG">Debug</option>
				</select>
				<span class="backend-pill" id="backendDot" title="Agent backend">● offline</span>
			</div>
		</header>
		<div class="messages-scroll" id="scroll">
			<div class="empty" id="empty">
				<strong>Princy IA</strong>
				<span class="engine-pill">DeepSeek · Ollama</span>
				<p class="empty-hint">Pergunte sobre o código. Use @ para contexto ou Composer para mudanças multi-arquivo.</p>
			</div>
			<div class="messages" id="messages"></div>
			<div class="thinking" id="thinking"></div>
		</div>
		<div class="status-bar" id="status"></div>
		<footer class="chat-input-wrap">
			<div class="chips" id="contextBar"></div>
			<div class="quick-actions">
				<button type="button" id="qaWorkspace">@workspace</button>
				<button type="button" id="qaFix">/fix</button>
				<button type="button" id="qaExplain">/explain</button>
				<button type="button" class="mention-btn" data-insert="@file:">@file</button>
				<button type="button" class="mention-btn" data-insert="@selection">@selection</button>
				<button type="button" class="mention-btn" data-insert="@terminal">@terminal</button>
			</div>
			<div id="mentionMenu" style="display:none"></div>
			<textarea id="input" rows="3" placeholder="Digite sua mensagem… (@file, @selection, Composer)"></textarea>
			<div class="send-row">
				<div class="tools">
					<button class="icon-btn" id="index" type="button" title="Indexar workspace">Index</button>
					<button class="icon-btn" id="composer" type="button" title="Composer multi-arquivo">Composer</button>
				</div>
				<button class="send" id="send" type="button" title="Enviar (Enter; Ctrl+Enter prioridade)">Enviar</button>
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
		document.getElementById('composer').addEventListener('click', () => {
			const text = input.value.trim();
			if (!text) { input.placeholder = 'Descreva mudança multi-arquivo…'; input.focus(); return; }
			vscode.postMessage({ type: 'requestComposer', text, agent: agent.value });
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
				status.textContent = message.text || '';
			}
			if (message.type === 'backendStatus' && backendDot) {
				backendDot.classList.toggle('online', Boolean(message.online));
				backendDot.textContent = message.online ? '● online' : '● offline';
				backendDot.title = message.message || message.endpoint || 'Agent backend';
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
				streamingNode.className = 'message assistant msg-assistant streaming';
				const label = document.createElement('span');
				label.className = 'label';
				label.textContent = 'Princy Ai';
				streamingBody = document.createElement('span');
				streamingBody.className = 'body cursor-blink';
				streamingNode.appendChild(label);
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
					const label = document.createElement('span');
					label.className = 'label';
					label.textContent = 'Princy Ai';
					streamingNode.appendChild(label);
					renderRichText(streamingNode, text);
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
			const wrap = document.createElement('div');
			wrap.className = 'msg-user-wrap';
			const bubble = document.createElement('div');
			bubble.className = 'message user';
			bubble.textContent = text;
			wrap.appendChild(bubble);
			messages.appendChild(wrap);
		}

		function appendAssistant(text, suggestedCommands) {
			const item = document.createElement('div');
			item.className = 'message assistant';
			const label = document.createElement('span');
			label.className = 'label';
			label.textContent = 'Princy Ai';
			item.appendChild(label);
			renderRichText(item, text);
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
			thinking.innerHTML = '';
			if (!steps.length) return;
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
