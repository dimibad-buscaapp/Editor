/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Browser / webview globals (not node:util — extension runs in Code Web). */
declare const TextDecoder: {
	new(): { decode(input: Uint8Array): string };
};

declare const TextEncoder: {
	new(): { encode(input: string): Uint8Array };
};
