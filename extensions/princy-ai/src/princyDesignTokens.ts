/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Incrementar ao mudar HTML/CSS do chat (invalida cache do webview). */
export const PRINCY_CHAT_UI_REVISION = '2026.05.24';

/** Tokens partilhados Princy Black (webview chat + dashboard chat-panel). */
export const PRINCY_DESIGN_TOKENS_CSS = `
		--princy-bg: #0f1117;
		--princy-panel: #141821;
		--princy-panel-soft: #1a1f2b;
		--princy-surface: #141821;
		--princy-elevated: #1a1f2b;
		--princy-border: rgba(255, 255, 255, 0.08);
		--princy-muted: #8f98aa;
		--princy-text: #e6e8ef;
		--princy-text-strong: #f4f5f9;
		--princy-accent: #7c5cff;
		--princy-accent-2: #28d8ff;
		--princy-accent-fg: #ffffff;
		--princy-glow: #28d8ff;
		--princy-glow-soft: rgba(124, 92, 255, 0.14);
		--princy-violet: #7c5cff;
		--princy-danger: #ff5c7a;
		--princy-success: #2ee59d;
		--princy-transition-fast: 160ms ease;
		--princy-transition-panel: 180ms ease-out;
		--princy-chat-width-target: 360px;
		--princy-radius-sm: 8px;
		--princy-radius-md: 10px;
		--princy-radius-lg: 14px;
`;
