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
 * Desbloqueia layout Princy: nunca manter auxiliary bar maximizada nem editor escondido
 * quando forceMaximized=false (settings de producao do webeditor).
 */
class PrincyLayoutUnlockContribution implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.princyLayoutUnlock';

	constructor(
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) {
		// Apos restore de state.vscdb (workspace antigo)
		setTimeout(() => this.applyUnlock(), 0);
		setTimeout(() => this.applyUnlock(), 1500);
	}

	private applyUnlock(): void {
		if (this.configurationService.getValue(AUXILIARYBAR_FORCE_MAXIMIZED) !== false) {
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
	}
}

registerWorkbenchContribution2(PrincyLayoutUnlockContribution.ID, PrincyLayoutUnlockContribution, WorkbenchPhase.AfterRestored);
