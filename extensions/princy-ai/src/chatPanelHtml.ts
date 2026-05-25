/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PRINCY_CHAT_UI_REVISION, PRINCY_DESIGN_TOKENS_CSS } from './princyDesignTokens';

/** Template visual base do painel Princy Chat (CSP aplicado em buildChatPanelHtml). */
export function getPrincyChatHtml(cspSource: string, nonce: string, styleUri?: string): string {
	return buildChatPanelHtml(cspSource, nonce, styleUri);
}

export function buildChatPanelHtml(cspSource: string, nonce: string, styleUri?: string, cursorStyleUri?: string): string {
	const styleLink = styleUri ? `<link rel="stylesheet" href="${styleUri}">` : '';
	const cursorStyleLink = cursorStyleUri ? `<link rel="stylesheet" href="${cursorStyleUri}">` : '';
	return /* html */`<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
	<title>Princy IA</title>
	${styleLink}
	${cursorStyleLink}
	<style>
		:root {
			${PRINCY_DESIGN_TOKENS_CSS}
		}
		* { box-sizing: border-box; margin: 0; padding: 0; }
		body {
			overflow: hidden;
			color: var(--vscode-foreground, var(--princy-text));
			background: var(--vscode-sideBar-background, var(--princy-bg));
			font-family: var(--vscode-font-family, Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
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
			height: 44px;
			padding: 0 12px;
			border-bottom: 1px solid var(--vscode-panel-border, var(--princy-border));
			background: rgba(20, 24, 33, 0.82);
			backdrop-filter: blur(12px);
		}
		.princy-orb {
			width: 10px;
			height: 10px;
			border-radius: 50%;
			flex-shrink: 0;
			background: linear-gradient(135deg, var(--princy-accent), var(--princy-accent-2));
			box-shadow: 0 0 18px rgba(124, 92, 255, 0.8);
			animation: pulseOrb 2.2s ease-in-out infinite;
		}
		@keyframes pulseOrb {
			0%, 100% { transform: scale(1); opacity: 0.8; }
			50% { transform: scale(1.28); opacity: 1; }
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
		.chat-mode-bar {
			flex-shrink: 0;
			display: flex;
			gap: 4px;
			padding: 6px 14px 4px;
			border-bottom: 1px solid var(--vscode-sideBar-border, var(--princy-border));
		}
		.chat-mode-pill {
			flex: 1;
			height: 32px;
			border: 1px solid transparent;
			border-radius: 9px;
			background: transparent;
			color: var(--princy-muted);
			font-size: 11px;
			font-weight: 500;
			cursor: pointer;
			transition: all 0.16s ease;
		}
		.chat-mode-pill:hover {
			background: rgba(255, 255, 255, 0.045);
			color: var(--princy-text);
		}
		.chat-mode-pill.active {
			color: var(--princy-text-strong);
			background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.035));
			border-color: rgba(124, 92, 255, 0.35);
			box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
		}
		.chat-history {
			flex-shrink: 0;
			border-bottom: 1px solid var(--vscode-sideBar-border, var(--princy-border));
		}
		.chat-history summary {
			padding: 6px 14px;
			font-size: 11px;
			font-weight: 600;
			color: var(--vscode-descriptionForeground, var(--princy-muted));
			cursor: pointer;
			list-style: none;
			user-select: none;
		}
		.chat-history summary::-webkit-details-marker { display: none; }
		.chat-history-list {
			max-height: 140px;
			overflow-y: auto;
			padding: 0 8px 8px;
		}
		.chat-history-item {
			display: flex;
			align-items: center;
			gap: 6px;
			width: 100%;
			padding: 6px 8px;
			border: none;
			border-radius: 6px;
			background: transparent;
			color: var(--vscode-foreground, var(--princy-text));
			font-size: 11px;
			text-align: left;
			cursor: pointer;
		}
		.chat-history-item:hover {
			background: var(--vscode-list-hoverBackground, var(--princy-elevated));
		}
		.chat-history-item.active {
			background: var(--vscode-list-activeSelectionBackground, var(--princy-elevated));
		}
		.chat-history-item-title {
			flex: 1;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.chat-history-item-mode {
			font-size: 9px;
			text-transform: uppercase;
			color: var(--vscode-descriptionForeground, var(--princy-muted));
		}
		.chat-history-del {
			flex-shrink: 0;
			width: 20px;
			height: 20px;
			border: none;
			border-radius: 4px;
			background: transparent;
			color: var(--princy-muted);
			cursor: pointer;
			font-size: 14px;
			line-height: 1;
		}
		.chat-history-del:hover {
			background: var(--vscode-inputValidation-errorBackground, #3f1d1d);
			color: var(--vscode-errorForeground, #f87171);
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
			min-width: 30px;
			height: 30px;
			padding: 0 12px;
			border: none;
			border-radius: 9px;
			cursor: pointer;
			display: grid;
			place-items: center;
			font-size: 14px;
			font-weight: 650;
			background: linear-gradient(135deg, var(--princy-accent), var(--princy-accent-2));
			color: #fff;
			transition: all 0.16s ease;
		}
		.chat-send-btn:hover {
			filter: brightness(1.08);
			transform: translateY(-1px);
			box-shadow: 0 8px 28px rgba(124, 92, 255, 0.28);
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
		.plan-dag {
			padding: 12px;
			border-radius: 10px;
			border: 1px dashed var(--princy-border-strong);
			background: var(--princy-panel-soft);
			margin: 8px 0;
		}
		.plan-dag-node {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 6px 8px;
			margin: 4px 0;
			border-radius: 6px;
			font-size: 12px;
			border-left: 3px solid var(--princy-muted);
		}
		.plan-dag-node.active { border-left-color: var(--princy-success); background: rgba(137, 209, 133, 0.08); }
		.plan-dag-node.done { border-left-color: var(--princy-success); opacity: 0.85; }
		.plan-dag-node.pending { border-left-color: var(--princy-muted); }
		.plan-dag-node.failed { border-left-color: var(--princy-danger); }
		.reviewer-report {
			margin-top: 8px;
			padding: 8px 10px;
			border-radius: 8px;
			font-size: 11px;
			background: rgba(255, 255, 255, 0.04);
			border: 1px solid var(--princy-border);
		}
		.swarm-dashboard {
			display: none;
			flex-direction: column;
			gap: 10px;
			padding: 12px;
			margin-bottom: 8px;
			border-radius: 10px;
			border: 1px solid var(--princy-border);
			background: linear-gradient(180deg, rgba(255,255,255,0.03), transparent);
		}
		.swarm-dashboard.visible { display: flex; }
		.swarm-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 8px;
		}
		.swarm-title {
			font-size: 12px;
			font-weight: 600;
			color: var(--princy-text-strong);
		}
		.swarm-orb-row {
			display: flex;
			gap: 6px;
			flex-wrap: wrap;
		}
		.swarm-agent-orb {
			width: 28px;
			height: 28px;
			border-radius: 50%;
			display: grid;
			place-items: center;
			font-size: 9px;
			font-weight: 700;
			text-transform: uppercase;
			border: 1px solid var(--princy-border);
			background: var(--princy-elevated);
			transition: transform 0.3s ease, box-shadow 0.3s ease;
		}
		.swarm-agent-orb.active {
			animation: swarmPulse 1.6s ease-in-out infinite;
			box-shadow: 0 0 16px var(--princy-glow-soft);
		}
		.swarm-agent-orb.done { opacity: 0.7; border-color: var(--princy-success); }
		.swarm-agent-orb.failed { border-color: var(--princy-danger); }
		@keyframes swarmPulse {
			0%, 100% { transform: scale(1); }
			50% { transform: scale(1.12); }
		}
		.swarm-kanban {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 6px;
		}
		.swarm-kanban-col {
			padding: 6px;
			border-radius: 6px;
			background: var(--princy-surface);
			min-height: 48px;
		}
		.swarm-kanban-col h4 {
			font-size: 10px;
			text-transform: uppercase;
			color: var(--princy-muted);
			margin-bottom: 4px;
		}
		.swarm-kanban-card {
			font-size: 11px;
			padding: 4px 6px;
			margin: 2px 0;
			border-radius: 4px;
			background: var(--princy-elevated);
		}
		.swarm-graph-edges {
			height: 2px;
			background: linear-gradient(90deg, transparent, var(--princy-glow-soft), transparent);
			margin: 4px 0;
		}
		.princy-live-cursor {
			position: fixed;
			pointer-events: none;
			width: 2px;
			height: 18px;
			background: var(--princy-success);
			box-shadow: 0 0 8px var(--princy-success);
			opacity: 0;
			transition: opacity 0.2s;
			z-index: 9999;
			animation: liveCursorBlink 1s step-end infinite;
		}
		.princy-live-cursor.visible { opacity: 0.85; }
		@keyframes liveCursorBlink {
			0%, 100% { opacity: 0.85; }
			50% { opacity: 0.2; }
		}
		body.princy-phase-planning .princy-live-cursor { background: #7c92ff; box-shadow: 0 0 8px #7c92ff; }
		body.princy-phase-editing .princy-live-cursor { background: var(--princy-success); }
		body.princy-phase-testing .princy-live-cursor { background: #ffb347; box-shadow: 0 0 8px #ffb347; }
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
<body data-princy-ui-rev="${PRINCY_CHAT_UI_REVISION}" class="cursor-agent-ui">
	<div class="chat-panel cursor-shell">
		<header class="chat-header cursor-header">
			<div class="cursor-header-left">
				<span class="cursor-header-title">Princy</span>
				<span class="cursor-header-sub" id="chatHeaderSub">Princy IA</span>
			</div>
			<div class="chat-header-actions">
				<button type="button" class="cursor-icon-btn" id="toggleHistory" title="Histórico">⏱</button>
				<button type="button" class="cursor-icon-btn" id="newChat" title="Nova conversa">+</button>
				<button type="button" class="cursor-icon-btn" id="openSettings" title="Configurações">⋯</button>
			</div>
		</header>
		<div class="chat-offline-banner" id="offlineBanner" style="display:none" role="alert">
			<div class="chat-offline-copy">
				<span class="chat-offline-text" id="offlineBannerText">Backend offline</span>
				<span class="chat-offline-endpoint" id="offlineBannerEndpoint" hidden></span>
			</div>
			<button type="button" class="chat-offline-reconnect" id="reconnectBackend">Reconectar</button>
		</div>
		<div class="chat-mode-bar" aria-label="Modos">
			<button type="button" class="chat-mode-pill" data-mode="chat">Chat</button>
			<button type="button" class="chat-mode-pill" data-mode="plan">Plan</button>
			<button type="button" class="chat-mode-pill" data-mode="agent">Agent</button>
			<button type="button" class="chat-mode-pill" data-mode="composer">Composer</button>
			<button type="button" class="chat-mode-pill" data-mode="swarm">Swarm</button>
			<button type="button" class="chat-mode-pill" data-mode="buildCenter">Build Center</button>
			<button type="button" class="chat-mode-pill" data-mode="apiStudio">API Studio</button>
			<button type="button" class="chat-mode-pill" data-mode="automationStudio">Automations</button>
			<button type="button" class="chat-mode-pill" data-mode="creator">Creator</button>
		</div>
		<div class="build-center-panel" id="buildCenterPanel" style="display:none">
			<div class="build-center-header">
				<span class="build-center-title">Build Center</span>
				<span class="build-center-status-badge waiting" id="buildCenterStatusBadge">aguardando</span>
			</div>
			<div class="build-center-form">
				<label class="chat-sr-only" for="bcBuildType">Tipo</label>
				<select id="bcBuildType" class="chat-model-select" title="Tipo de build">
					<option value="web">Web</option>
					<option value="api">API</option>
					<option value="exe" title="Windows: Electron + electron-builder">EXE</option>
					<option value="apk" title="Android: Capacitor + Gradle">APK</option>
				</select>
				<label class="chat-sr-only" for="bcProject">Projeto</label>
				<select id="bcProject" class="chat-model-select" title="Projeto">
					<option value="">Workspace aberto</option>
				</select>
				<button type="button" class="chat-toolbar-btn" id="bcStartBtn">Iniciar build</button>
				<button type="button" class="chat-toolbar-btn" id="bcDownloadBtn" disabled>Download</button>
			</div>
			<div class="web-publisher-panel" id="webPublisherPanel" style="display:none">
				<div class="web-publisher-stepper" id="webPublisherStepper" aria-label="Fluxo pagina web">
					<span class="web-step" data-step="create">1 Criar</span>
					<span class="web-step" data-step="code">2 Codigo</span>
					<span class="web-step active" data-step="build">3 Build</span>
					<span class="web-step" data-step="preview">4 Preview</span>
					<span class="web-step" data-step="publish">5 Publicar</span>
				</div>
				<div class="web-publisher-urls" id="webPublisherUrls"></div>
				<div class="web-publisher-actions">
					<button type="button" class="chat-toolbar-btn" id="bcGoCreatorBtn" title="Abrir Creator">Creator</button>
					<button type="button" class="chat-toolbar-btn" id="bcPreviewBtn" disabled>Abrir preview</button>
					<button type="button" class="chat-toolbar-btn" id="bcPublishBtn" disabled>Publicar</button>
				</div>
			</div>
			<pre class="build-center-log" id="buildCenterLog" aria-live="polite"></pre>
		</div>
		<div class="build-center-panel api-studio-panel" id="apiStudioPanel" style="display:none">
			<div class="build-center-header">
				<span class="build-center-title">API Studio</span>
				<span class="build-center-status-badge waiting" id="apiStudioStatusBadge">pronto</span>
			</div>
			<div class="web-publisher-stepper" aria-label="Fluxo API">
				<span class="web-step" data-step="create">1 Criar</span>
				<span class="web-step" data-step="schema">2 Rotas/DB</span>
				<span class="web-step" data-step="migrate">3 Migrate</span>
				<span class="web-step" data-step="test">4 Testar</span>
				<span class="web-step" data-step="docs">5 Swagger</span>
			</div>
			<div class="build-center-form">
				<label class="chat-sr-only" for="asProject">Projeto API</label>
				<select id="asProject" class="chat-model-select" title="Projeto">
					<option value="">Selecione o projeto</option>
				</select>
				<select id="asMethod" class="chat-model-select" title="Metodo">
					<option value="GET">GET</option>
					<option value="POST">POST</option>
					<option value="PUT">PUT</option>
					<option value="PATCH">PATCH</option>
					<option value="DELETE">DELETE</option>
				</select>
				<input type="text" id="asRoutePath" class="creator-input" placeholder="/api/recurso" style="min-width:120px" />
				<button type="button" class="chat-toolbar-btn" id="asRouteBtn">Nova rota</button>
				<button type="button" class="chat-toolbar-btn" id="asMigrateBtn">Migrate</button>
				<button type="button" class="chat-toolbar-btn" id="asTestBtn">Testar</button>
				<button type="button" class="chat-toolbar-btn" id="asDocsBtn">Swagger</button>
			</div>
			<div class="web-publisher-urls" id="apiStudioUrls"></div>
			<pre class="build-center-log" id="apiStudioLog" aria-live="polite"></pre>
		</div>
		<div class="build-center-panel automation-studio-panel" id="automationStudioPanel" style="display:none">
			<div class="build-center-header">
				<span class="build-center-title">Princy Automations</span>
				<span class="build-center-status-badge waiting" id="automationStudioStatusBadge">pronto</span>
			</div>
			<div class="web-publisher-stepper" aria-label="Fluxo Automacao">
				<span class="web-step" data-step="create">1 Criar</span>
				<span class="web-step" data-step="generate">2 Gerar</span>
				<span class="web-step" data-step="schedule">3 Agendar</span>
				<span class="web-step" data-step="run">4 Executar</span>
				<span class="web-step" data-step="monitor">5 Monitorar</span>
			</div>
			<div class="build-center-form">
				<label class="chat-sr-only" for="autoProject">Projeto</label>
				<select id="autoProject" class="chat-model-select" title="Projeto">
					<option value="">Selecione o projeto</option>
				</select>
				<input type="text" id="autoJobName" class="creator-input" placeholder="nome-do-job" style="min-width:100px" />
				<input type="text" id="autoSchedule" class="creator-input" placeholder="*/15 * * * *" style="min-width:100px" />
				<button type="button" class="chat-toolbar-btn" id="autoScaffoldBtn">Gerar</button>
				<button type="button" class="chat-toolbar-btn" id="autoScheduleBtn">Agendar</button>
				<button type="button" class="chat-toolbar-btn" id="autoRunBtn">Executar</button>
				<button type="button" class="chat-toolbar-btn" id="autoTestBtn">Testar</button>
				<button type="button" class="chat-toolbar-btn" id="autoPipelineBtn">Pipeline</button>
				<button type="button" class="chat-toolbar-btn" id="autoRunLocalBtn">Executar aqui</button>
			</div>
			<div class="web-publisher-urls" id="automationStudioUrls"></div>
			<pre class="build-center-log" id="automationStudioLog" aria-live="polite"></pre>
		</div>
		<div class="creator-panel" id="creatorPanel" style="display:none">
			<div class="creator-header">
				<span class="creator-title">Criador de projetos</span>
				<span class="creator-root" id="creatorRoot">C:\\Apps\\Projects</span>
			</div>
			<div class="creator-form">
				<label class="chat-sr-only" for="projectName">Nome do projeto</label>
				<input type="text" id="projectName" class="creator-input" placeholder="nome-do-projeto" maxlength="64" />
				<label class="creator-check"><input type="checkbox" id="runInstall" checked /> npm install</label>
			</div>
			<div class="creator-grid" id="creatorGrid"></div>
			<div class="creator-result" id="creatorResult" style="display:none"></div>
		</div>
		<details class="chat-history" id="historyPanel">
			<summary>Histórico</summary>
			<div class="chat-history-list" id="historyList"></div>
		</details>
		<div class="chat-scroll" id="scroll">
			<div class="action-run-panel cursor-agent-track" id="actionRunPanel" aria-live="polite">
				<div class="action-run-title" id="actionRunTitle">Agent</div>
				<div class="action-run-steps" id="actionRunSteps"></div>
				<div class="action-run-result" id="actionRunResult"></div>
			</div>
			<div class="swarm-dashboard" id="swarmDashboard" aria-live="polite">
				<div class="swarm-header">
					<span class="swarm-title">Swarm — agentes em paralelo</span>
					<span class="chat-header-sub" id="swarmStatus">aguardando</span>
				</div>
				<div class="swarm-orb-row" id="swarmOrbs"></div>
				<div class="swarm-graph-edges" id="swarmEdges"></div>
				<div class="swarm-kanban" id="swarmKanban"></div>
			</div>
			<div class="princy-live-cursor" id="liveCursor" aria-hidden="true"></div>
			<div class="chat-welcome" id="empty">
				<div class="chat-welcome-icon">◇</div>
				<h2>Ask anything</h2>
				<p>Agent, Chat e Composer no estilo Cursor. Use @ para contexto ou /composer para multi-arquivo.</p>
				<div class="chat-suggestions">
					<button type="button" class="chat-suggest" data-prompt="Explique o arquivo aberto e sugira melhorias.">Explicar código</button>
					<button type="button" class="chat-suggest" data-prompt="Corrija erros e bugs no projeto atual.">Corrigir bugs</button>
					<button type="button" class="chat-suggest" data-prompt="Refatore para código mais limpo e tipado.">Refatorar</button>
					<button type="button" class="chat-suggest" data-prompt="Crie testes para o módulo selecionado.">Gerar testes</button>
				</div>
			</div>
			<div class="chat-turn-list" id="messages"></div>
			<div class="task-cards" id="taskCards" style="display:none"></div>
			<div class="chat-thinking" id="thinking"></div>
		</div>
		<div class="chat-composer">
			<div class="chat-context-chips" id="contextBar"></div>
			<div class="chat-followups cursor-collapsed" id="contextShortcuts">
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
				<textarea id="princy-chat-input" rows="1" placeholder="Plan, @ for context, / for commands"></textarea>
				<div class="chat-input-toolbar">
					<div class="chat-toolbar-left">
						<div class="cursor-composer-modes" role="tablist" aria-label="Modo">
							<button type="button" class="cursor-mode-pill active" data-mode="agent" role="tab" aria-selected="true">Agent</button>
							<button type="button" class="cursor-mode-pill" data-mode="plan" role="tab">Plan</button>
							<button type="button" class="cursor-mode-pill" data-mode="swarm" role="tab">Swarm</button>
							<button type="button" class="cursor-mode-pill" data-mode="chat" role="tab">Chat</button>
							<button type="button" class="cursor-mode-pill" data-mode="composer" role="tab">Composer</button>
							<select id="toolsModeSelect" class="cursor-tools-select" title="Ferramentas">
								<option value="">Tools</option>
								<option value="buildCenter">Build</option>
								<option value="apiStudio">API</option>
								<option value="automationStudio">Auto</option>
								<option value="creator">Creator</option>
							</select>
						</div>
						<span class="chat-backend-dot" id="backendDot" title="Agent backend"></span>
						<label class="chat-sr-only" for="princy-agent-select">Modelo</label>
						<select id="princy-agent-select" class="chat-model-select" title="Modelo">
							<option value="princy" selected>Princy IA</option>
							<option value="auto">Auto</option>
							<option value="deepseek">DeepSeek</option>
							<option value="qwen">Qwen</option>
							<option value="codellama">CodeLlama</option>
						</select>
						<select id="segment" style="display:none" aria-hidden="true"><option value="">Auto</option></select>
						<span class="chat-status" id="status">A ligar…</span>
					</div>
					<div class="chat-toolbar-right">
						<button type="button" class="chat-toolbar-btn" id="toggleContext" title="Atalhos @ e /">@</button>
						<button type="button" class="chat-toolbar-btn" id="index" title="Indexar workspace">↻</button>
						<button type="button" class="chat-send-btn" id="send" title="Enviar (Enter)">↑</button>
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
		let backendOnline = false;
		if (sendBtn) {
			sendBtn.disabled = true;
			sendBtn.title = 'A ligar ao backend…';
		}
		const historyList = document.getElementById('historyList');
		let streamingNode = null;
		let streamingBody = null;
		let streamTargetText = '';
		let streamDisplayed = 0;
		let streamRaf = 0;
		const taskCards = document.getElementById('taskCards');
		let currentMode = 'agent';
		let activeSessionId = null;

		const MODE_PLACEHOLDERS = {
			chat: 'Ask a question…',
			plan: 'Describe what to build — roadmap only, no apply…',
			swarm: 'Delegate to parallel agents (frontend, backend, QA)…',
			composer: 'Describe multi-file edits…',
			agent: 'Plan, search, build anything…',
			builder: 'Optional build note…',
			buildCenter: 'Optional build note…',
			apiStudio: 'API project — use panel actions',
			automationStudio: 'Automation project — use panel actions',
			creator: 'Project name above, pick a template'
		};
		const TOOL_MODES = ['buildCenter', 'apiStudio', 'automationStudio', 'creator'];
		const creatorPanel = document.getElementById('creatorPanel');
		const creatorGrid = document.getElementById('creatorGrid');
		const creatorRoot = document.getElementById('creatorRoot');
		const projectNameInput = document.getElementById('projectName');
		const runInstallCheck = document.getElementById('runInstall');
		const creatorResult = document.getElementById('creatorResult');
		let projectTemplates = [];
		let lastCreatedProject = null;
		const actionRunPanel = document.getElementById('actionRunPanel');
		const actionRunTitle = document.getElementById('actionRunTitle');
		const actionRunSteps = document.getElementById('actionRunSteps');
		const actionRunResult = document.getElementById('actionRunResult');
		const swarmDashboard = document.getElementById('swarmDashboard');
		const swarmOrbs = document.getElementById('swarmOrbs');
		const swarmKanban = document.getElementById('swarmKanban');
		const swarmStatus = document.getElementById('swarmStatus');
		const liveCursor = document.getElementById('liveCursor');
		const buildCenterPanel = document.getElementById('buildCenterPanel');
		const apiStudioPanel = document.getElementById('apiStudioPanel');
		const asProject = document.getElementById('asProject');
		const asMethod = document.getElementById('asMethod');
		const asRoutePath = document.getElementById('asRoutePath');
		const asRouteBtn = document.getElementById('asRouteBtn');
		const asMigrateBtn = document.getElementById('asMigrateBtn');
		const asTestBtn = document.getElementById('asTestBtn');
		const asDocsBtn = document.getElementById('asDocsBtn');
		const apiStudioLog = document.getElementById('apiStudioLog');
		const apiStudioUrls = document.getElementById('apiStudioUrls');
		const apiStudioStatusBadge = document.getElementById('apiStudioStatusBadge');
		let apiStudioProjects = [];
		const automationStudioPanel = document.getElementById('automationStudioPanel');
		const autoProject = document.getElementById('autoProject');
		const autoJobName = document.getElementById('autoJobName');
		const autoSchedule = document.getElementById('autoSchedule');
		const autoScaffoldBtn = document.getElementById('autoScaffoldBtn');
		const autoScheduleBtn = document.getElementById('autoScheduleBtn');
		const autoRunBtn = document.getElementById('autoRunBtn');
		const autoTestBtn = document.getElementById('autoTestBtn');
		const autoPipelineBtn = document.getElementById('autoPipelineBtn');
		const autoRunLocalBtn = document.getElementById('autoRunLocalBtn');
		const automationStudioLog = document.getElementById('automationStudioLog');
		const automationStudioUrls = document.getElementById('automationStudioUrls');
		const automationStudioStatusBadge = document.getElementById('automationStudioStatusBadge');
		let automationStudioProjects = [];
		const bcBuildType = document.getElementById('bcBuildType');
		const bcProject = document.getElementById('bcProject');
		const bcStartBtn = document.getElementById('bcStartBtn');
		const bcDownloadBtn = document.getElementById('bcDownloadBtn');
		const webPublisherPanel = document.getElementById('webPublisherPanel');
		const webPublisherUrls = document.getElementById('webPublisherUrls');
		const webPublisherStepper = document.getElementById('webPublisherStepper');
		const bcGoCreatorBtn = document.getElementById('bcGoCreatorBtn');
		const bcPreviewBtn = document.getElementById('bcPreviewBtn');
		const bcPublishBtn = document.getElementById('bcPublishBtn');
		const buildCenterLog = document.getElementById('buildCenterLog');
		const buildCenterStatusBadge = document.getElementById('buildCenterStatusBadge');
		let buildCenterProjects = [];
		let activeBuildId = null;
		let buildLogSource = null;
		let currentSiteInfo = null;
		const ACTION_STEP_LABELS = ['Entender', 'Plano', 'Arquivos', 'Diff', 'Aprovar', 'Build', 'Test', 'Resultado'];

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
		setChatMode('agent', true);
		renderActionRunPanel('idle', null, 'Pronto — descreva a tarefa.');

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
			setStatus(backendOnline ? 'Pronto' : 'Offline');
			scrollBottom();
		}

		function setChatMode(mode, fromHost) {
			currentMode = mode;
			for (const pill of document.querySelectorAll('.cursor-mode-pill, .chat-mode-pill')) {
				const on = pill.getAttribute('data-mode') === mode;
				pill.classList.toggle('active', on);
				pill.setAttribute('aria-selected', on ? 'true' : 'false');
			}
			const toolsSelect = document.getElementById('toolsModeSelect');
			if (toolsSelect) {
				toolsSelect.value = TOOL_MODES.includes(mode) ? mode : '';
			}
			input.placeholder = MODE_PLACEHOLDERS[mode] || MODE_PLACEHOLDERS.agent;
			const composerBtn = document.getElementById('composer');
			const followups = document.querySelector('.chat-followups');
			if (followups) followups.style.display = mode === 'composer' ? 'none' : '';
			if (composerBtn) composerBtn.style.display = mode === 'composer' ? 'none' : '';
			if (buildCenterPanel) buildCenterPanel.style.display = mode === 'buildCenter' ? 'flex' : 'none';
			if (apiStudioPanel) apiStudioPanel.style.display = mode === 'apiStudio' ? 'flex' : 'none';
			if (automationStudioPanel) automationStudioPanel.style.display = mode === 'automationStudio' ? 'flex' : 'none';
			if (mode === 'buildCenter') updateWebPublisherVisibility();
			if (mode === 'apiStudio') {
				renderApiStudioProjects(apiStudioProjects.length ? apiStudioProjects : buildCenterProjects);
			}
			if (mode === 'automationStudio') {
				renderAutomationStudioProjects(automationStudioProjects.length ? automationStudioProjects : buildCenterProjects);
			}
			if (creatorPanel) creatorPanel.style.display = mode === 'creator' ? 'flex' : 'none';
			if (input && mode === 'creator') input.placeholder = MODE_PLACEHOLDERS.creator;
			if (actionRunPanel) {
				if (mode === 'agent' || mode === 'composer' || mode === 'plan') {
					actionRunPanel.style.display = 'flex';
					actionRunPanel.classList.add('cursor-agent-track');
					if (actionRunTitle) actionRunTitle.textContent = mode === 'plan' ? 'Plan (readonly)' : 'Agent';
				} else {
					actionRunPanel.style.display = 'none';
				}
			}
			if (swarmDashboard) {
				swarmDashboard.classList.toggle('visible', mode === 'swarm');
			}
			if (!fromHost) {
				vscode.postMessage({ type: 'setChatMode', mode });
			}
		}

		function setBuildCenterStatus(status) {
			if (!buildCenterStatusBadge) return;
			const labels = { waiting: 'aguardando', compiling: 'compilando', error: 'erro', success: 'sucesso' };
			buildCenterStatusBadge.textContent = labels[status] || status;
			buildCenterStatusBadge.className = 'build-center-status-badge ' + (status || 'waiting');
		}

		function renderBuildCenterProjects(projects) {
			if (!bcProject) return;
			const current = bcProject.value;
			bcProject.innerHTML = '<option value="">Workspace aberto</option>';
			for (const p of projects || []) {
				const opt = document.createElement('option');
				opt.value = p.slug;
				opt.textContent = p.slug;
				bcProject.appendChild(opt);
			}
			if (current && Array.from(bcProject.options).some(o => o.value === current)) {
				bcProject.value = current;
			}
			const slug = bcProject.value;
			if (slug && bcBuildType?.value === 'web') {
				vscode.postMessage({ type: 'loadSiteInfo', slug });
			}
			apiStudioProjects = projects || [];
			if (currentMode === 'apiStudio') renderApiStudioProjects(apiStudioProjects);
			automationStudioProjects = projects || [];
			if (currentMode === 'automationStudio') renderAutomationStudioProjects(automationStudioProjects);
		}

		function renderApiStudioProjects(projects) {
			if (!asProject) return;
			const current = asProject.value;
			asProject.innerHTML = '<option value="">Selecione o projeto</option>';
			for (const p of projects || []) {
				const opt = document.createElement('option');
				opt.value = p.slug;
				opt.textContent = p.slug;
				asProject.appendChild(opt);
			}
			if (current && Array.from(asProject.options).some(o => o.value === current)) {
				asProject.value = current;
			}
			if (asProject.value) {
				vscode.postMessage({ type: 'loadApiStudioInfo', slug: asProject.value });
			}
		}

		function appendApiStudioLog(text) {
			if (!apiStudioLog || !text) return;
			apiStudioLog.textContent += text;
			apiStudioLog.scrollTop = apiStudioLog.scrollHeight;
		}

		function setApiStudioStatus(status) {
			if (!apiStudioStatusBadge) return;
			apiStudioStatusBadge.textContent = status;
			apiStudioStatusBadge.className = 'build-center-status-badge ' + (status || 'waiting');
		}

		function renderApiStudioInfo(info) {
			if (!apiStudioUrls || !info) return;
			apiStudioUrls.innerHTML = '';
			const p = document.createElement('p');
			p.textContent = (info.stack || 'api') + ' :' + (info.port || 4000) + (info.hasPrisma ? ' + Prisma' : '');
			apiStudioUrls.appendChild(p);
			if (info.docsUrl) {
				const a = document.createElement('a');
				a.href = '#';
				a.textContent = info.docsUrl;
				a.addEventListener('click', e => {
					e.preventDefault();
					vscode.postMessage({ type: 'openExternalUrl', url: info.docsUrl });
				});
				apiStudioUrls.appendChild(a);
			}
		}

		asProject?.addEventListener('change', () => {
			if (asProject.value) vscode.postMessage({ type: 'loadApiStudioInfo', slug: asProject.value });
		});

		asRouteBtn?.addEventListener('click', () => {
			const slug = asProject?.value;
			if (!slug) { setStatus('Selecione um projeto'); return; }
			const path = (asRoutePath?.value || '').trim();
			if (!path) { setStatus('Informe o path da rota'); return; }
			vscode.postMessage({
				type: 'apiStudioScaffoldRoute',
				slug,
				method: asMethod?.value || 'GET',
				path
			});
		});

		asMigrateBtn?.addEventListener('click', () => {
			const slug = asProject?.value;
			if (!slug) { setStatus('Selecione um projeto'); return; }
			vscode.postMessage({ type: 'apiStudioMigrate', slug });
		});

		asTestBtn?.addEventListener('click', () => {
			const slug = asProject?.value;
			if (!slug) { setStatus('Selecione um projeto'); return; }
			vscode.postMessage({ type: 'apiStudioTest', slug });
		});

		asDocsBtn?.addEventListener('click', () => {
			const slug = asProject?.value;
			if (!slug) { setStatus('Selecione um projeto'); return; }
			vscode.postMessage({ type: 'apiStudioOpenDocs', slug });
		});

		function renderAutomationStudioProjects(projects) {
			if (!autoProject) return;
			const current = autoProject.value;
			autoProject.innerHTML = '<option value="">Selecione o projeto</option>';
			for (const p of projects || []) {
				const opt = document.createElement('option');
				opt.value = p.slug;
				opt.textContent = p.slug;
				autoProject.appendChild(opt);
			}
			if (current && Array.from(autoProject.options).some(o => o.value === current)) {
				autoProject.value = current;
			}
			if (autoProject.value) {
				vscode.postMessage({ type: 'loadAutomationStudioInfo', slug: autoProject.value });
			}
		}

		function appendAutomationStudioLog(text) {
			if (!automationStudioLog || !text) return;
			automationStudioLog.textContent += text;
			automationStudioLog.scrollTop = automationStudioLog.scrollHeight;
		}

		function setAutomationStudioStatus(status) {
			if (!automationStudioStatusBadge) return;
			automationStudioStatusBadge.textContent = status;
			automationStudioStatusBadge.className = 'build-center-status-badge ' + (status || 'waiting');
		}

		function renderAutomationStudioInfo(info) {
			if (!automationStudioUrls) return;
			automationStudioUrls.innerHTML = '';
			if (!info) return;
			const p = document.createElement('p');
			p.textContent = (info.type || 'automation') + (info.schedule ? ' cron=' + info.schedule : '');
			automationStudioUrls.appendChild(p);
			if (info.lastRunStatus) {
				const r = document.createElement('p');
				r.textContent = 'Ultima execucao: ' + info.lastRunStatus;
				automationStudioUrls.appendChild(r);
			}
		}

		autoProject?.addEventListener('change', () => {
			if (autoProject.value) vscode.postMessage({ type: 'loadAutomationStudioInfo', slug: autoProject.value });
		});

		autoScaffoldBtn?.addEventListener('click', () => {
			const slug = autoProject?.value;
			const name = (autoJobName?.value || '').trim();
			if (!slug || !name) { setStatus('Selecione projeto e nome do job'); return; }
			vscode.postMessage({
				type: 'automationScaffold',
				slug,
				name,
				schedule: (autoSchedule?.value || '').trim() || undefined
			});
		});

		autoScheduleBtn?.addEventListener('click', () => {
			const slug = autoProject?.value;
			const schedule = (autoSchedule?.value || '').trim();
			if (!slug || !schedule) { setStatus('Selecione projeto e cron'); return; }
			vscode.postMessage({ type: 'automationSchedule', slug, schedule });
		});

		autoRunBtn?.addEventListener('click', () => {
			const slug = autoProject?.value;
			if (!slug) { setStatus('Selecione um projeto'); return; }
			vscode.postMessage({ type: 'automationRun', slug });
		});

		autoTestBtn?.addEventListener('click', () => {
			const slug = autoProject?.value;
			if (!slug) { setStatus('Selecione um projeto'); return; }
			vscode.postMessage({ type: 'automationTest', slug });
		});

		autoPipelineBtn?.addEventListener('click', () => {
			const slug = autoProject?.value;
			if (!slug) { setStatus('Selecione um projeto'); return; }
			vscode.postMessage({ type: 'automationPipeline', slug, recipe: 'daily-script' });
		});

		autoRunLocalBtn?.addEventListener('click', () => {
			const slug = autoProject?.value;
			if (!slug) { setStatus('Selecione um projeto'); return; }
			vscode.postMessage({ type: 'automationRunLocal', slug });
		});

		function updateWebPublisherVisibility() {
			const isWeb = bcBuildType?.value === 'web';
			if (webPublisherPanel) webPublisherPanel.style.display = isWeb ? 'flex' : 'none';
			if (!isWeb) return;
			const slug = bcProject?.value;
			if (slug) vscode.postMessage({ type: 'loadSiteInfo', slug });
			else renderWebPublisherUrls(null);
		}

		function setWebStepState(step, state) {
			if (!webPublisherStepper) return;
			const el = webPublisherStepper.querySelector('[data-step="' + step + '"]');
			if (!el) return;
			el.classList.remove('active', 'done');
			if (state === 'active') el.classList.add('active');
			if (state === 'done') el.classList.add('done');
		}

		function renderWebPublisherUrls(site) {
			currentSiteInfo = site;
			if (!webPublisherUrls) return;
			webPublisherUrls.innerHTML = '';
			if (!site) {
				if (bcPreviewBtn) bcPreviewBtn.disabled = true;
				if (bcPublishBtn) bcPublishBtn.disabled = true;
				return;
			}
			if (site.hasPreview) {
				const p = document.createElement('p');
				p.innerHTML = 'Preview: <a href="#" data-url="' + site.previewUrl + '">' + site.previewUrl + '</a>';
				webPublisherUrls.appendChild(p);
				if (bcPreviewBtn) bcPreviewBtn.disabled = false;
				setWebStepState('preview', 'done');
			} else {
				if (bcPreviewBtn) bcPreviewBtn.disabled = true;
				setWebStepState('preview', 'active');
			}
			if (site.hasPublished) {
				const pub = document.createElement('p');
				pub.innerHTML = 'Publicado: <a href="#" data-url="' + site.publishedUrl + '">' + site.publishedUrl + '</a>';
				webPublisherUrls.appendChild(pub);
				setWebStepState('publish', 'done');
			} else {
				setWebStepState('publish', site.hasPreview ? 'active' : '');
				if (bcPublishBtn) bcPublishBtn.disabled = !site.hasPreview;
			}
			for (const a of webPublisherUrls.querySelectorAll('a[data-url]')) {
				a.addEventListener('click', ev => {
					ev.preventDefault();
					const url = a.getAttribute('data-url');
					if (url) vscode.postMessage({ type: 'openSitePreview', url });
				});
			}
		}

		bcBuildType?.addEventListener('change', () => {
			updateWebPublisherVisibility();
			if (bcBuildType?.value === 'web' && bcProject?.value) {
				vscode.postMessage({ type: 'loadSiteInfo', slug: bcProject.value });
			}
		});

		bcProject?.addEventListener('change', () => {
			if (bcBuildType?.value === 'web' && bcProject?.value) {
				vscode.postMessage({ type: 'loadSiteInfo', slug: bcProject.value });
			} else {
				renderWebPublisherUrls(null);
			}
		});

		bcGoCreatorBtn?.addEventListener('click', () => setChatMode('creator', true));

		bcPreviewBtn?.addEventListener('click', () => {
			const slug = bcProject?.value;
			if (!slug) {
				setStatus('Selecione um projeto');
				return;
			}
			if (currentSiteInfo?.previewUrl) {
				vscode.postMessage({ type: 'openSitePreview', url: currentSiteInfo.previewUrl });
				return;
			}
			vscode.postMessage({ type: 'syncSitePreview', slug, projectSlug: slug });
		});

		bcPublishBtn?.addEventListener('click', () => {
			const slug = bcProject?.value;
			if (!slug) {
				setStatus('Selecione um projeto');
				return;
			}
			vscode.postMessage({
				type: 'publishSite',
				slug,
				projectSlug: slug,
				buildId: activeBuildId || undefined
			});
		});

		function appendBuildCenterLog(text) {
			if (!buildCenterLog || !text) return;
			buildCenterLog.textContent += text;
			buildCenterLog.scrollTop = buildCenterLog.scrollHeight;
		}

		function closeBuildLogStream() {
			if (buildLogSource) {
				buildLogSource.close();
				buildLogSource = null;
			}
		}

		function openBuildLogStream(url) {
			closeBuildLogStream();
			if (!url || typeof EventSource === 'undefined') return;
			buildLogSource = new EventSource(url);
			buildLogSource.addEventListener('log', ev => {
				try {
					const data = JSON.parse(ev.data);
					appendBuildCenterLog(data.text || '');
				} catch { /* ignore */ }
			});
			buildLogSource.addEventListener('done', () => closeBuildLogStream());
			buildLogSource.addEventListener('error', () => closeBuildLogStream());
		}

		bcStartBtn?.addEventListener('click', () => {
			const type = bcBuildType?.value || 'web';
			const slug = bcProject?.value || '';
			const note = input?.value?.trim() || '';
			vscode.postMessage({
				type: 'startBuildCenter',
				target: type,
				projectSlug: slug || undefined,
				note: note || undefined
			});
		});

		bcDownloadBtn?.addEventListener('click', () => {
			if (!activeBuildId) return;
			vscode.postMessage({ type: 'downloadBuildCenter', buildId: activeBuildId });
		});

		function renderCreatorGrid() {
			if (!creatorGrid) return;
			creatorGrid.innerHTML = '';
			for (const t of projectTemplates) {
				const card = document.createElement('div');
				card.className = 'creator-card';
				const title = document.createElement('div');
				title.className = 'creator-card-title';
				title.textContent = t.name;
				const desc = document.createElement('div');
				desc.className = 'creator-card-desc';
				desc.textContent = t.description || '';
				const stacks = document.createElement('div');
				stacks.className = 'creator-card-stacks';
				for (const s of (t.stack || []).slice(0, 4)) {
					const chip = document.createElement('span');
					chip.className = 'creator-chip';
					chip.textContent = s;
					stacks.appendChild(chip);
				}
				const btn = document.createElement('button');
				btn.type = 'button';
				btn.className = 'creator-create-btn';
				btn.textContent = 'Criar';
				btn.addEventListener('click', () => {
					const name = (projectNameInput?.value || '').trim();
					if (!name) {
						setStatus('Informe o nome do projeto');
						projectNameInput?.focus();
						return;
					}
					vscode.postMessage({
						type: 'createProject',
						templateId: t.id,
						projectName: name,
						runInstall: Boolean(runInstallCheck?.checked)
					});
				});
				card.append(title, desc, stacks, btn);
				creatorGrid.appendChild(card);
			}
		}

		function showProjectCreated(msg) {
			if (!creatorResult) return;
			lastCreatedProject = msg;
			creatorResult.style.display = 'block';
			creatorResult.innerHTML = '';
			const p = document.createElement('p');
			p.textContent = msg.projectPath;
			const openBtn = document.createElement('button');
			openBtn.type = 'button';
			openBtn.className = 'chat-toolbar-btn';
			openBtn.textContent = 'Abrir pasta';
			openBtn.addEventListener('click', () => vscode.postMessage({ type: 'openCreatedProject', projectPath: msg.projectPath }));
			const buildBtn = document.createElement('button');
			buildBtn.type = 'button';
			buildBtn.className = 'chat-toolbar-btn';
			buildBtn.textContent = 'Build Center';
			buildBtn.addEventListener('click', () => {
				setChatMode('buildCenter', true);
				if (msg.slug && bcProject) {
					renderBuildCenterProjects(buildCenterProjects);
					bcProject.value = msg.slug;
				}
				if (msg.buildTarget && bcBuildType) bcBuildType.value = msg.buildTarget;
				vscode.postMessage({ type: 'setChatMode', mode: 'buildCenter' });
			});
			creatorResult.append(p, openBtn, buildBtn);
			if (msg.installLog) {
				const pre = document.createElement('pre');
				pre.className = 'build-log';
				pre.textContent = msg.installLog;
				creatorResult.appendChild(pre);
			}
		}

		function setLiveCursorPhase(phase) {
			document.body.classList.remove('princy-phase-planning', 'princy-phase-editing', 'princy-phase-testing');
			if (phase === 'planning' || phase === 'understanding') document.body.classList.add('princy-phase-planning');
			else if (phase === 'applying' || phase === 'generating') document.body.classList.add('princy-phase-editing');
			else if (phase === 'testing' || phase === 'compiling') document.body.classList.add('princy-phase-testing');
			if (liveCursor) {
				liveCursor.classList.toggle('visible', phase && phase !== 'idle' && phase !== 'completed' && phase !== 'done');
				if (liveCursor.classList.contains('visible')) {
					liveCursor.style.left = (12 + Math.random() * 40) + 'px';
					liveCursor.style.top = (80 + Math.random() * 120) + 'px';
				}
			}
		}

		function renderSwarmGraph(graph) {
			if (!graph || !swarmDashboard) return;
			swarmDashboard.classList.add('visible');
			if (swarmStatus) swarmStatus.textContent = graph.status || 'IN_PROGRESS';
			if (swarmOrbs) {
				swarmOrbs.innerHTML = '';
				for (const node of graph.nodes || []) {
					const orb = document.createElement('div');
					const state = node.state || 'pending';
					orb.className = 'swarm-agent-orb ' + state;
					orb.title = node.label || node.role;
					orb.textContent = (node.role || '?').slice(0, 2);
					swarmOrbs.appendChild(orb);
				}
			}
			if (swarmKanban) {
				swarmKanban.innerHTML = '';
				const cols = { pending: [], active: [], done: [] };
				for (const node of graph.nodes || []) {
					const bucket = node.state === 'done' ? 'done' : node.state === 'active' ? 'active' : 'pending';
					cols[bucket].push(node);
				}
				for (const [key, label] of [['pending', 'Fila'], ['active', 'Ativo'], ['done', 'Feito']]) {
					const col = document.createElement('div');
					col.className = 'swarm-kanban-col';
					const h = document.createElement('h4');
					h.textContent = label;
					col.appendChild(h);
					for (const node of cols[key]) {
						const card = document.createElement('div');
						card.className = 'swarm-kanban-card';
						card.textContent = node.label || node.role;
						col.appendChild(card);
					}
					swarmKanban.appendChild(col);
				}
			}
		}

		function renderPlanDag(planDag, jobId) {
			if (!planDag) return;
			hideEmpty();
			const wrapper = document.createElement('div');
			wrapper.className = 'plan plan-readonly';
			const title = document.createElement('strong');
			title.textContent = planDag.summary || 'Roadmap';
			wrapper.appendChild(title);
			const dag = document.createElement('div');
			dag.className = 'plan-dag';
			for (const node of planDag.nodes || []) {
				const row = document.createElement('div');
				row.className = 'plan-dag-node ' + (node.state || 'pending');
				row.textContent = '[' + (node.role || 'task') + '] ' + node.label;
				dag.appendChild(row);
			}
			wrapper.appendChild(dag);
			const actions = document.createElement('div');
			actions.className = 'plan-actions';
			const execBtn = document.createElement('button');
			execBtn.className = 'primary';
			execBtn.textContent = 'Executar plano';
			execBtn.onclick = () => vscode.postMessage({ type: 'executePlan', jobId });
			actions.appendChild(execBtn);
			wrapper.appendChild(actions);
			messages.appendChild(wrapper);
			scrollBottom();
		}

		function renderReviewerReport(report) {
			if (!report) return;
			const box = document.createElement('div');
			box.className = 'reviewer-report';
			box.textContent = (report.approved ? '✓ Reviewer: ' : '⚠ Reviewer: ') + (report.summary || '');
			messages.appendChild(box);
			scrollBottom();
		}

		function renderActionRunPanel(phase, actionRun, resultSummary) {
			setLiveCursorPhase(phase);
			if (!actionRunPanel || !actionRunSteps) return;
			actionRunPanel.style.display = (currentMode === 'agent' || currentMode === 'composer' || currentMode === 'plan') ? 'flex' : 'none';
			actionRunSteps.innerHTML = '';
			let tasks = (actionRun && actionRun.tasks) || [];
			if (!tasks.length && phase && phase !== 'idle') {
				const idx = {
					planning: 0, reading: 1, generating: 2, applying: 3,
					awaiting_approval: 4, building: 5, verifying: 6, testing: 6,
					done: 7, completed: 7, success: 7, failed: 7, cancelled: -1
				};
				const activeAt = idx[phase] ?? 0;
				tasks = ACTION_STEP_LABELS.map((label, i) => ({
					id: 's' + i,
					label,
					state: i < activeAt ? 'done' : i === activeAt ? 'active' : 'pending'
				}));
			}
			if (!tasks.length) {
				tasks = ACTION_STEP_LABELS.map((label, i) => ({
					id: 's' + i,
					label,
					state: phase === 'idle' ? 'pending' : (i === 0 ? 'active' : 'pending')
				}));
			}
			for (const task of tasks) {
				const step = document.createElement('div');
				step.className = 'action-step ' + (task.state || 'pending');
				step.textContent = task.label;
				actionRunSteps.appendChild(step);
			}
			if (actionRunResult) {
				const defaults = {
					idle: 'Pronto — descreva a tarefa no campo abaixo.',
					planning: 'Planejando...',
					generating: 'A gerar resposta...',
					applying: 'A aplicar alteracoes...',
					awaiting_approval: 'Revise o diff e aprove para aplicar.',
					building: 'Compilando...',
					verifying: 'A testar...',
					done: 'Concluido.',
					completed: 'Concluido.',
					success: 'Concluido.',
					failed: 'Falhou — veja a mensagem abaixo.',
					cancelled: 'Cancelado.'
				};
				actionRunResult.textContent = resultSummary || defaults[phase] || '';
			}
		}

		for (const pill of document.querySelectorAll('.chat-mode-pill, .cursor-mode-pill')) {
			pill.addEventListener('click', () => {
				const mode = pill.getAttribute('data-mode');
				if (mode) setChatMode(mode, false);
			});
		}

		document.getElementById('toolsModeSelect')?.addEventListener('change', (e) => {
			const v = e.target && e.target.value;
			if (v) setChatMode(v, false);
		});

		document.getElementById('toggleHistory')?.addEventListener('click', () => {
			const hp = document.getElementById('historyPanel');
			if (hp) {
				if (typeof hp.open === 'boolean') hp.open = !hp.open;
				else hp.toggleAttribute('open');
			}
		});

		document.getElementById('toggleContext')?.addEventListener('click', () => {
			const el = document.getElementById('contextShortcuts');
			if (el) {
				el.classList.toggle('cursor-collapsed');
				el.classList.toggle('cursor-show');
			}
		});

		document.getElementById('openSettings')?.addEventListener('click', () => {
			vscode.postMessage({ type: 'openSettings' });
		});

		document.getElementById('reconnectBackend')?.addEventListener('click', () => {
			vscode.postMessage({ type: 'reconnectBackend' });
		});

		document.getElementById('newChat')?.addEventListener('click', () => {
			vscode.postMessage({ type: 'newSession' });
		});

		function restoreMessages(turns) {
			resetConversation();
			if (!turns || !turns.length) return;
			hideEmpty();
			for (const turn of turns) {
				if (turn.role === 'user') appendUser(turn.text);
				else appendAssistant(turn.text);
			}
			scrollBottom();
		}

		function renderHistoryList(sessions, activeId) {
			if (!historyList) return;
			historyList.innerHTML = '';
			activeSessionId = activeId;
			for (const session of sessions || []) {
				const wrap = document.createElement('div');
				wrap.className = 'history-item' + (session.id === activeId ? ' active' : '');
				const main = document.createElement('button');
				main.type = 'button';
				main.className = 'history-main';
				main.style.cssText = 'flex:1;border:none;background:transparent;color:inherit;text-align:left;cursor:pointer;padding:0';
				const title = document.createElement('div');
				title.textContent = session.title || 'Nova conversa';
				title.style.fontWeight = '500';
				const meta = document.createElement('div');
				meta.className = 'history-meta';
				meta.textContent = (session.mode || 'chat') + (session.updatedAt ? ' · ' + formatTs(session.updatedAt) : '');
				main.append(title, meta);
				main.addEventListener('click', () => vscode.postMessage({ type: 'switchSession', sessionId: session.id }));
				const del = document.createElement('button');
				del.type = 'button';
				del.className = 'chat-history-del';
				del.title = 'Excluir';
				del.textContent = '×';
				del.style.cssText = 'border:none;background:transparent;color:var(--princy-muted);cursor:pointer';
				del.addEventListener('click', event => {
					event.stopPropagation();
					vscode.postMessage({ type: 'deleteSession', sessionId: session.id });
				});
				wrap.append(main, del);
				historyList.appendChild(wrap);
			}
		}

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
			if (!status) return;
			const t = text || '';
			if (!backendOnline && (t === 'Pronto' || t.startsWith('A ligar'))) {
				status.textContent = 'Offline';
				return;
			}
			status.textContent = t || (backendOnline ? 'Pronto' : 'Offline');
		}

		function scheduleStreamReveal() {
			if (!streamingBody) return;
			if (streamDisplayed >= streamTargetText.length) return;
			const tick = () => {
				if (!streamingBody) {
					streamRaf = 0;
					return;
				}
				if (streamDisplayed < streamTargetText.length) {
					streamDisplayed = Math.min(streamDisplayed + 14, streamTargetText.length);
					streamingBody.textContent = streamTargetText.slice(0, streamDisplayed);
					streamingBody.classList.add('cursor-blink');
					scrollBottom();
					streamRaf = requestAnimationFrame(tick);
				} else {
					streamRaf = 0;
				}
			};
			if (!streamRaf) streamRaf = requestAnimationFrame(tick);
		}

		function renderTaskCards(cards) {
			if (!taskCards) return;
			taskCards.innerHTML = '';
			if (!cards || !cards.length) {
				taskCards.style.display = 'none';
				return;
			}
			taskCards.style.display = 'flex';
			for (const card of cards) {
				const el = document.createElement('div');
				el.className = 'task-card ' + (card.state || 'pending');
				const title = document.createElement('div');
				title.className = 'task-card-title';
				title.textContent = card.title || card.label || 'Task';
				const meta = document.createElement('div');
				meta.className = 'task-card-meta';
				meta.textContent = card.detail || '';
				el.append(title, meta);
				taskCards.appendChild(el);
			}
		}

		function formatTs(ts) {
			if (!ts) return '';
			try {
				const d = new Date(ts);
				return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
			} catch { return ''; }
		}

		function postChatMessage(priority) {
			const text = input.value.trim();
			if (!text) return;
			hideEmpty();
			if (currentMode === 'agent' || currentMode === 'composer') {
				renderActionRunPanel('planning', null, 'A iniciar tarefa...');
			}
			if (currentMode === 'composer') {
				const picked = !agent || agent.value === 'auto' ? 'princy' : agent.value;
				vscode.postMessage({ type: 'requestComposer', text, agent: picked });
			} else {
				vscode.postMessage({
					type: 'sendMessage',
					text,
					agent: agent?.value || 'auto',
					segmentMode: segment?.value || undefined,
					priority: priority || 'normal',
					chatMode: currentMode
				});
			}
			input.value = '';
			autoResizeInput();
		}

		function autoResizeInput() {
			input.style.height = 'auto';
			input.style.height = Math.min(input.scrollHeight, 200) + 'px';
		}

		sendBtn?.addEventListener('click', () => postChatMessage('normal'));
		document.getElementById('composer')?.addEventListener('click', () => {
			setChatMode('composer', false);
			const text = input.value.trim();
			if (text) postChatMessage('normal');
			else input.focus();
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
				setChatMode('composer', true);
				input.focus();
			}
			if (message.type === 'chatMode' && message.mode) {
				setChatMode(message.mode, true);
			}
			if (message.type === 'sessionsState') {
				renderHistoryList(message.sessions, message.activeId);
				if (message.activeMode) setChatMode(message.activeMode, true);
				restoreMessages(message.messages);
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
			if (message.type === 'workspaceInfo') {
				const sub = document.getElementById('chatHeaderSub');
				if (sub && message.name) {
					sub.textContent = message.name + ' · Princy IA';
				}
			}
			if (message.type === 'taskCards') {
				renderTaskCards(message.cards || []);
			}
			if (message.type === 'diffFileContent') {
				const el = document.getElementById('diff-' + message.operationId);
				if (el && message.lines) {
					el.innerHTML = '';
					for (const line of message.lines) {
						const row = document.createElement('div');
						row.className = 'diff-line ' + (line.kind || 'ctx');
						row.textContent = line.text;
						el.appendChild(row);
					}
				}
			}
			if (message.type === 'backendStatus') {
				backendOnline = Boolean(message.online);
				if (sendBtn) {
					sendBtn.disabled = !backendOnline;
					sendBtn.title = backendOnline ? '' : 'Backend offline — use Reconectar ou aguarde';
				}
				if (backendDot) {
					backendDot.classList.toggle('online', backendOnline);
					backendDot.title = (message.online ? 'Backend online' : 'Backend offline') + (message.endpoint ? ' — ' + message.endpoint : '');
				}
				const sub = document.getElementById('chatHeaderSub');
				const banner = document.getElementById('offlineBanner');
				const bannerText = document.getElementById('offlineBannerText');
				const bannerEndpoint = document.getElementById('offlineBannerEndpoint');
				if (sub) {
					sub.textContent = message.online ? 'Online' : 'Offline';
				}
				if (banner) {
					banner.style.display = message.online ? 'none' : 'flex';
				}
				if (!message.online) {
					const ep = (message.endpoint || '/princy-api').trim();
					if (bannerText) {
						bannerText.textContent = message.message || 'Backend offline';
					}
					if (bannerEndpoint) {
						bannerEndpoint.hidden = false;
						bannerEndpoint.textContent = 'Endpoint: ' + ep + ' — agent no servidor: porta 3210';
					}
				} else if (bannerEndpoint) {
					bannerEndpoint.hidden = true;
					bannerEndpoint.textContent = '';
				}
				if (status) {
					status.textContent = message.online ? 'Pronto' : 'Offline';
				}
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
			if (message.type === 'actionRun') {
				renderActionRunPanel(message.phase, message.actionRun, message.resultSummary);
			}
			if (message.type === 'projectTemplates') {
				projectTemplates = message.templates || [];
				if (creatorRoot && message.projectsRoot) creatorRoot.textContent = message.projectsRoot;
				renderCreatorGrid();
			}
			if (message.type === 'buildCenterProjects') {
				buildCenterProjects = message.projects || [];
				renderBuildCenterProjects(buildCenterProjects);
			}
			if (message.type === 'apiStudioInfo') {
				renderApiStudioInfo(message.info || null);
			}
			if (message.type === 'apiStudioLog') {
				appendApiStudioLog(message.text || '');
			}
			if (message.type === 'apiStudioStatus') {
				setApiStudioStatus(message.status || 'pronto');
			}
			if (message.type === 'automationStudioInfo') {
				renderAutomationStudioInfo(message.info || null);
			}
			if (message.type === 'automationStudioLog') {
				appendAutomationStudioLog(message.text || '');
			}
			if (message.type === 'automationStudioStatus') {
				setAutomationStudioStatus(message.status || 'pronto');
			}
			if (message.type === 'buildCenterStarted') {
				activeBuildId = message.buildId;
				if (buildCenterLog) buildCenterLog.textContent = '';
				setBuildCenterStatus(message.status || 'waiting');
				if (bcDownloadBtn) bcDownloadBtn.disabled = true;
				appendBuildCenterLog('[build] ' + (message.buildId || '') + '\\n');
				if (message.logStreamUrl) openBuildLogStream(message.logStreamUrl);
			}
			if (message.type === 'buildCenterStatus') {
				setBuildCenterStatus(message.status);
				if (message.status === 'success' && bcDownloadBtn) bcDownloadBtn.disabled = false;
				if (message.status === 'error' || message.status === 'success') closeBuildLogStream();
				if (message.status === 'success' && bcBuildType?.value === 'web') {
					setWebStepState('build', 'done');
					setWebStepState('preview', 'active');
					if (message.previewUrl) {
						renderWebPublisherUrls({
							slug: bcProject?.value || '',
							previewUrl: message.previewUrl,
							publishedUrl: '',
							hasPreview: true,
							hasPublished: false
						});
					}
					if (bcProject?.value) {
						vscode.postMessage({ type: 'loadSiteInfo', slug: bcProject.value });
					}
				}
			}
			if (message.type === 'siteInfo') {
				renderWebPublisherUrls(message.site || null);
			}
			if (message.type === 'sitePublished') {
				renderWebPublisherUrls(message.site || null);
				setWebStepState('publish', 'done');
				setStatus('Site publicado');
			}
			if (message.type === 'buildCenterLog') {
				appendBuildCenterLog(message.text || '');
			}
			if (message.type === 'openBuildCenter') {
				setChatMode('buildCenter', true);
				if (message.target && bcBuildType) bcBuildType.value = message.target;
				if (message.projectSlug && bcProject) bcProject.value = message.projectSlug;
			}
			if (message.type === 'projectCreated') {
				showProjectCreated(message);
				hideEmpty();
			}
			if (message.type === 'buildLog') {
				hideEmpty();
				renderActionRunPanel('building', { tasks: [] }, message.text || '');
				const log = document.createElement('pre');
				log.className = 'build-log';
				log.textContent = message.text || '';
				messages.appendChild(log);
				scrollBottom();
			}
			if (message.type === 'composerPlan') {
				hideEmpty();
				renderComposerPlan(message.instruction, message.agent, message.plan, message.jobId, message.showApproval);
				scrollBottom();
			}
			if (message.type === 'planDag') {
				renderPlanDag(message.planDag, message.jobId);
			}
			if (message.type === 'reviewerReport') {
				renderReviewerReport(message.reviewerReport);
			}
			if (message.type === 'swarmGraph') {
				renderSwarmGraph(message.graph);
			}
			if (message.type === 'context') renderContext(message);
			if (message.type === 'mentionSuggestions') renderMentionMenu(message.items || []);
			if (message.type === 'streamStart') {
				hideEmpty();
				renderActionRunPanel('generating', null, 'A gerar resposta...');
				streamTargetText = '';
				streamDisplayed = 0;
				if (streamRaf) cancelAnimationFrame(streamRaf);
				streamingNode = createTurn('assistant', 'Princy IA', true);
				streamingBody = streamingNode.querySelector('.chat-turn-body');
				if (streamingBody) {
					streamingBody.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span>';
					streamingBody.classList.add('cursor-blink');
				}
				messages.appendChild(streamingNode);
				scrollBottom();
			}
			if (message.type === 'streamDelta' && streamingBody) {
				streamTargetText = message.text || '';
				scheduleStreamReveal();
			}
			if (message.type === 'streamEnd') {
				if (currentMode === 'agent' || currentMode === 'composer') {
					renderActionRunPanel('done', null, 'Concluido.');
				}
				if (streamRaf) {
					cancelAnimationFrame(streamRaf);
					streamRaf = 0;
				}
				if (streamingNode && streamingBody) {
					const text = message.text || streamTargetText || '';
					streamTargetText = text;
					streamDisplayed = text.length;
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
			if (message.type === 'response') {
				const content = message.content || message.text || '';
				if (content) {
					appendAssistant(content, message.suggestedCommands);
				}
				if (sendBtn) sendBtn.disabled = !backendOnline;
				if (backendOnline) setStatus('Pronto');
			}
			if (message.type === 'error') {
				appendAssistant('Erro: ' + (message.message || 'falha desconhecida'));
				if (sendBtn) sendBtn.disabled = !backendOnline;
				setStatus('Erro');
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

		function addOpButton(container, label, className, onClick, disabled) {
			const b = document.createElement('button');
			b.textContent = label;
			if (className) b.className = className;
			b.disabled = Boolean(disabled);
			b.addEventListener('click', onClick);
			container.appendChild(b);
			return b;
		}

		function renderComposerPlan(instruction, agentName, plan, jobId, showApproval) {
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
			if (jobId && showApproval) {
				addOpButton(topActions, 'Aprovar tudo', 'primary', () => {
					vscode.postMessage({ type: 'approveActionRun', jobId, instruction, agent: agentName, plan });
					wrapper.classList.add('applied');
				});
				addOpButton(topActions, 'Rejeitar', '', () => {
					vscode.postMessage({ type: 'rejectActionRun', jobId });
					wrapper.remove();
				});
			} else {
				addOpButton(topActions, 'Apply All', 'primary', () => {
					vscode.postMessage({ type: 'applyComposerPlan', instruction, agent: agentName, plan, operationIds: (plan.operations || []).map(o => o.id) });
					wrapper.classList.add('applied');
				});
				addOpButton(topActions, 'Reject All', '', () => wrapper.remove());
			}
			if (jobId && !showApproval) {
				addOpButton(topActions, 'Verificar', '', () => {
					vscode.postMessage({ type: 'verifyComposer', jobId, instruction, agent: agentName, plan });
				});
			}
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
				const diffHost = document.createElement('div');
				diffHost.className = 'diff-rich';
				diffHost.id = 'diff-' + operation.id;
				const preview = renderOperationPreview(operation);
				if (preview) diffHost.appendChild(preview);
				block.appendChild(diffHost);
				if (operation.filePath && operation.type === 'modify') {
					vscode.postMessage({ type: 'readFileForDiff', operationId: operation.id, filePath: operation.filePath, operation });
				}
				const opActions = document.createElement('div');
				opActions.className = 'operation-actions';
				addOpButton(opActions, 'Preview', '', () => {
					vscode.postMessage({ type: 'previewComposerOperation', operation });
				});
				addOpButton(opActions, 'Apply', 'primary', () => {
					vscode.postMessage({ type: 'applyComposerPlan', instruction, agent: agentName, plan, operationIds: [operation.id] });
					block.classList.add('applied');
				});
				addOpButton(opActions, 'Reject', '', () => block.remove());
				if (operation.type === 'runCommand') {
					const cmd = operation.command || '';
					addOpButton(opActions, 'Run', '', () => vscode.postMessage({ type: 'runCommand', command: cmd }));
					if (/build|compile/i.test(cmd)) {
						addOpButton(opActions, 'Build', '', () => vscode.postMessage({ type: 'runCommand', command: cmd }));
					}
				}
				block.appendChild(opActions);
				wrapper.appendChild(block);
			}
			const actions = document.createElement('div');
			actions.className = 'plan-actions';
			addOpButton(actions, 'Apply', 'primary', () => {
				vscode.postMessage({ type: 'applyComposerPlan', instruction, agent: agentName, plan, operationIds: Array.from(wrapper.querySelectorAll('input:checked')).map(i => i.value) });
				wrapper.classList.add('applied');
			});
			addOpButton(actions, 'Reject', '', () => wrapper.remove());
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
			thinking.style.display = 'flex';
			for (const step of steps) {
				const item = document.createElement('div');
				item.className = 'step ' + (step.state || 'pending');
				item.textContent = step.label;
				thinking.appendChild(item);
			}
			renderTaskCards(steps.map(s => ({
				title: s.label,
				state: s.state === 'active' ? 'active' : s.state === 'done' ? 'done' : 'pending',
				detail: s.state === 'active' ? 'Em progresso' : ''
			})));
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

		vscode.postMessage({ type: 'panelReady' });
	})();
	`;
}
