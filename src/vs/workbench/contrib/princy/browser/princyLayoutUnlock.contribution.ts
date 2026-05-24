/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mainWindow } from '../../../../base/browser/window.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';

const AUXILIARYBAR_FORCE_MAXIMIZED = 'workbench.secondarySideBar.forceMaximized';

/**
 * Desbloqueio global de layout Princy: editor + sidebars visiveis, chat nunca maximizado
 * quando forceMaximized nao e explicitamente true (producao Princy usa false).
 */
class PrincyLayoutUnlockContribution implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.princyLayoutUnlock';

	private readonly unlockDelaysMs = [0, 400, 1200, 2500, 5000, 10000, 20000, 45000];

	constructor(
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) {
		for (const ms of this.unlockDelaysMs) {
			setTimeout(() => this.applyUnlock(), ms);
		}
	}

	private applyUnlock(): void {
		if (this.configurationService.getValue(AUXILIARYBAR_FORCE_MAXIMIZED) === true) {
			return;
		}

		if (this.layoutService.isAuxiliaryBarMaximized()) {
			this.layoutService.setAuxiliaryBarMaximized(false);
		}

		if (!this.layoutService.isVisible(Parts.EDITOR_PART, mainWindow)) {
			this.layoutService.setPartHidden(false, Parts.EDITOR_PART);
		}
		if (!this.layoutService.isVisible(Parts.SIDEBAR_PART)) {
			this.layoutService.setPartHidden(false, Parts.SIDEBAR_PART);
		}
		if (!this.layoutService.isVisible(Parts.AUXILIARYBAR_PART)) {
			this.layoutService.setPartHidden(false, Parts.AUXILIARYBAR_PART);
		}
		if (!this.layoutService.isVisible(Parts.PANEL_PART)) {
			this.layoutService.setPartHidden(false, Parts.PANEL_PART);
		}
		if (!this.layoutService.isVisible(Parts.STATUSBAR_PART)) {
			this.layoutService.setPartHidden(false, Parts.STATUSBAR_PART);
		}
	}
}

registerWorkbenchContribution2(PrincyLayoutUnlockContribution.ID, PrincyLayoutUnlockContribution, WorkbenchPhase.BlockRestore);
