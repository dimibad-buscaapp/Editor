/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/princyTitleBarStatus.css';
import { $, append } from '../../../../base/browser/dom.js';
import { Action } from '../../../../base/common/actions.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2, SubmenuItemAction } from '../../../../platform/actions/common/actions.js';
import { IActionViewItemService } from '../../../../platform/actions/browser/actionViewItemService.js';
import { BaseActionViewItem, IBaseActionViewItemOptions } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { PrincyAiStatusKindContext, PrincyAiStatusLabelContext } from './princyAiStatusContext.js';

const PrincyAiTitleBarStatusMenu = MenuId.for('princyAi.titleBarStatusMenu');

class PrincyAiStatusPillAction extends Action {
	constructor() {
		super('princyai.titleBarStatusPill', localize('princyAiStatusPill', "Princy IA"), Codicon.sparkle.classNames, true);
	}
}

class PrincyAiStatusPillViewItem extends BaseActionViewItem {
	private labelEl: HTMLElement | undefined;
	private rootEl: HTMLElement | undefined;

	constructor(action: Action, options: IBaseActionViewItemOptions, @IContextKeyService private readonly contextKeyService: IContextKeyService) {
		super(undefined, action, options);
	}

	override render(container: HTMLElement): void {
		this.rootEl = append(container, $('.princy-titlebar-status'));
		const dot = append(this.rootEl, $('.princy-titlebar-status-dot'));
		dot.setAttribute('aria-hidden', 'true');
		this.labelEl = append(this.rootEl, $('span.princy-titlebar-status-label'));
		this.updateLabel();
		this._register(this.contextKeyService.onDidChangeContext(e => {
			if (e.affectsSome(new Set([PrincyAiStatusLabelContext.key, PrincyAiStatusKindContext.key]))) {
				this.updateLabel();
				this.updateDot();
			}
		}));
		this.updateDot();
	}

	private updateLabel(): void {
		if (this.labelEl) {
			this.labelEl.textContent = PrincyAiStatusLabelContext.bindTo(this.contextKeyService).get() ?? 'IA: Pronto';
		}
	}

	private updateDot(): void {
		if (!this.rootEl) {
			return;
		}
		const kind = PrincyAiStatusKindContext.bindTo(this.contextKeyService).get() ?? 'ready';
		this.rootEl.classList.toggle('princy-offline', kind === 'offline');
		this.rootEl.classList.toggle('princy-busy', kind === 'thinking' || kind === 'planning' || kind === 'editing' || kind === 'testing' || kind === 'fixing');
		this.rootEl.classList.toggle('princy-error', kind === 'error');
	}
}

CommandsRegistry.registerCommand('princyai.updateTitleBarStatus', (accessor: ServicesAccessor, label?: string, kind?: string) => {
	const contextKeyService = accessor.get(IContextKeyService);
	if (typeof label === 'string' && label.length > 0) {
		PrincyAiStatusLabelContext.bindTo(contextKeyService).set(label);
	}
	if (typeof kind === 'string' && kind.length > 0) {
		PrincyAiStatusKindContext.bindTo(contextKeyService).set(kind);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'princyai.openFromTitleBar',
			title: localize2('princyAiOpenFromTitleBar', "Open Princy Chat"),
			f1: false
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(ICommandService).executeCommand('princyai.chat.focus');
	}
});

MenuRegistry.appendMenuItem(MenuId.CommandCenter, {
	submenu: MenuId.for('princyAi.titleBarStatusMenu'),
	title: localize('princyAiTitleBar', "Princy IA"),
	icon: Codicon.sparkle,
	order: 10003
});

MenuRegistry.appendMenuItem(MenuId.for('princyAi.titleBarStatusMenu'), {
	command: { id: 'princyai.openFromTitleBar', title: localize('openPrincyChat', "Open Chat") },
	group: 'navigation',
	order: 1
});

class PrincyTitleBarStatusRendering extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.princyTitleBarStatus';

	constructor(
		@IActionViewItemService actionViewItemService: IActionViewItemService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();
		this._register(actionViewItemService.register(MenuId.CommandCenter, PrincyAiTitleBarStatusMenu, (action, options) => {
			if (action instanceof SubmenuItemAction && action.item.submenu === PrincyAiTitleBarStatusMenu) {
				return instantiationService.createInstance(PrincyAiStatusPillViewItem, new PrincyAiStatusPillAction(), options);
			}
			return undefined;
		}));
	}
}

registerWorkbenchContribution2(PrincyTitleBarStatusRendering.ID, PrincyTitleBarStatusRendering, WorkbenchPhase.AfterRestored);
