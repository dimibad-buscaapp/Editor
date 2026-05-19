/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare function setTimeout(callback: (...args: any[]) => void, ms?: number, ...args: any[]): unknown;
declare function clearTimeout(handle: unknown): void;
