import { appState } from '../infrastructure/app-state/appState';

export function setAppStateForAzureQueue() {
	appState.azureQueue_queueAccountUri = `https://test123.queue.core.windows.net`;
	appState.azureQueue_saskAccountName = 'sask-account-name';
	appState.azureQueue_saskAccountKey = 'sask-account-key';
	appState.azureQueue_arcsTenantId = 'arcs-tenant-id';
	appState.azureQueue_arcsClientId = 'arcs-client-id';
	appState.azureQueue_arcsClientSecret = 'arcs-client-secret';
}

export function useSask() {
	appState.azureQueue_authMethod = 'SASK';
}

export function useArcs() {
	appState.azureQueue_authMethod = 'ARCS';
}
