/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Incrementar ao mudar HTML/CSS do chat (invalida cache do webview). */
export const PRINCY_CHAT_UI_REVISION = 'cursor-agent-2026.05.25-r8';

/** Tokens estilo Cursor Editor window (painel lateral direito). */
export const PRINCY_DESIGN_TOKENS_CSS = `
		--princy-bg: #1e1e1e;
		--princy-panel: #1e1e1e;
		--princy-panel-soft: #252526;
		--princy-surface: #252526;
		--princy-elevated: #2d2d2d;
		--princy-border: rgba(255, 255, 255, 0.08);
		--princy-border-strong: rgba(255, 255, 255, 0.12);
		--princy-muted: #969696;
		--princy-text: #cccccc;
		--princy-text-strong: #e4e4e4;
		--princy-accent: #e4e4e4;
		--princy-accent-2: #cccccc;
		--princy-accent-fg: #1e1e1e;
		--princy-glow: #cccccc;
		--princy-glow-soft: rgba(255, 255, 255, 0.06);
		--princy-violet: #cccccc;
		--princy-danger: #f48771;
		--princy-success: #89d185;
		--princy-transition-fast: 120ms ease;
		--princy-transition-panel: 160ms ease-out;
		--princy-chat-width-target: 400px;
		--princy-radius-sm: 6px;
		--princy-radius-md: 8px;
		--princy-radius-lg: 10px;
		--princy-composer-radius: 10px;
`;
