/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mainWindow } from '../../../../base/browser/window.js';
import { localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';

const AUXILIARYBAR_FORCE_MAXIMIZED = 'workbench.secondarySideBar.forceMaximized';

export function applyPrincyLayoutUnlock(
	layoutService: IWorkbenchLayoutService,
	configurationService: IConfigurationService
): void {
	if (configurationService.getValue(AUXILIARYBAR_FORCE_MAXIMIZED) === true) {
		return;
	}

	if (layoutService.isAuxiliaryBarMaximized()) {
		layoutService.setAuxiliaryBarMaximized(false);
	}

	if (!layoutService.isVisible(Parts.EDITOR_PART, mainWindow)) {
		layoutService.setPartHidden(false, Parts.EDITOR_PART);
	}
	if (!layoutService.isVisible(Parts.SIDEBAR_PART)) {
		layoutService.setPartHidden(false, Parts.SIDEBAR_PART);
	}
	if (!layoutService.isVisible(Parts.AUXILIARYBAR_PART)) {
		layoutService.setPartHidden(false, Parts.AUXILIARYBAR_PART);
	}
	if (!layoutService.isVisible(Parts.PANEL_PART)) {
		layoutService.setPartHidden(false, Parts.PANEL_PART);
	}
	if (!layoutService.isVisible(Parts.STATUSBAR_PART, mainWindow)) {
		layoutService.setPartHidden(false, Parts.STATUSBAR_PART);
	}
}

class PrincyLayoutUnlockContribution implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.princyLayoutUnlock';

	private readonly unlockDelaysMs = [0, 200, 600, 1500, 3000, 6000, 12000, 25000, 60000, 120000, 300000, 600000];
	private periodicUnlockTimer: ReturnType<typeof setInterval> | undefined;

	constructor(
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) {
		for (const ms of this.unlockDelaysMs) {
			setTimeout(() => this.applyUnlock(), ms);
		}
		this.periodicUnlockTimer = setInterval(() => this.applyUnlock(), 30_000);
		setTimeout(() => {
			if (this.periodicUnlockTimer) {
				clearInterval(this.periodicUnlockTimer);
				this.periodicUnlockTimer = undefined;
			}
		}, 900_000);
	}

	private applyUnlock(): void {
		applyPrincyLayoutUnlock(this.layoutService, this.configurationService);
	}
}

registerWorkbenchContribution2(PrincyLayoutUnlockContribution.ID, PrincyLayoutUnlockContribution, WorkbenchPhase.BlockRestore);

registerAction2(class PrincyUnlockEditorLayoutAction extends Action2 {
	constructor() {
		super({
			id: 'princy.unlockEditorLayout',
			title: localize2('princy.unlockEditorLayout', 'Unlock Princy Editor Layout (chat docked)'),
			f1: true,
			category: localize2('princy.category', 'Princy')
		});
	}

	override run(accessor: ServicesAccessor): void {
		applyPrincyLayoutUnlock(
			accessor.get(IWorkbenchLayoutService),
			accessor.get(IConfigurationService)
		);
	}
});
