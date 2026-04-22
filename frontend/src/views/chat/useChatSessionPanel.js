import { computed, onMounted, watch } from 'vue';
import { useConfigStore } from '../../stores/config';
import { useSessionStore } from '../../stores/session';
import { useI18n } from '../../lib/i18n';
import { loadStore, saveStore } from '../../lib/wails';
import { useChatSessionWorkspaceState } from './useChatSessionWorkspaceState';
import { useChatSessionActions } from './useChatSessionActions';
import { useChatSessionWorkspaceManagement } from './useChatSessionWorkspaceManagement';

export function useChatSessionPanel(props, emit) {
  const configStore = useConfigStore();
  const sessionStore = useSessionStore();
  const { t } = useI18n();

  const selectedAgent = computed({
    get: () => props.selectedAgent,
    set: (value) => emit('update:selectedAgent', value),
  });
  const selectedCwd = computed({
    get: () => props.selectedCwd,
    set: (value) => emit('update:selectedCwd', value),
  });
  const activeWorkspaceId = computed({
    get: () => props.activeWorkspaceId,
    set: (value) => emit('update:activeWorkspaceId', value),
  });
  const previewSessionId = computed({
    get: () => props.previewSessionId,
    set: (value) => emit('update:previewSessionId', value),
  });

  let prefsStoreData = {};
  const prefsStoreName = 'preferences.json';
  let preferencesLoaded = false;

  const isConnected = computed(() => sessionStore.isConnected);
  const isConnecting = computed(() => sessionStore.isConnecting);
  const savedSessionCount = computed(() => sessionStore.visibleSessions.length);
  const workspaces = computed(() => sessionStore.workspacesWithCounts);
  const connectedSessionIds = computed(() => sessionStore.connectedSessionIds);
  const currentSessionId = computed(() => sessionStore.currentSession?.id ?? '');
  const isCurrentSessionLoading = computed(() => sessionStore.isLoading && !!sessionStore.currentSession);
  const currentSessionInActiveWorkspace = computed(() => {
    if (!sessionStore.currentSession) return false;
    if (!activeWorkspaceId.value) return true;
    return sessionStore.currentSession.workspaceId === activeWorkspaceId.value;
  });
  const {
    normalizedQuery,
    sessionSearchQuery,
    workspaceList,
    isWorkspaceOpen,
    toggleWorkspace,
    isPinned,
    isSelectedSession,
    getSessionSummary,
    setPinnedSessionIds,
    expandWorkspace,
    expandFilteredWorkspaces,
    handleToggleSessionPin: toggleSessionPin,
    removeSessionPin,
  } = useChatSessionWorkspaceState({
    sessionStore,
    workspaces,
    currentSessionId,
    previewSessionId,
  });

  function isConnectedSession(sessionId) {
    return connectedSessionIds.value.includes(sessionId);
  }

  function isChatLoadingSession(sessionId) {
    return isCurrentSessionLoading.value && currentSessionId.value === sessionId;
  }

  const {
    pendingResumeSessionIds,
    pendingDisconnectSessionIds,
    pendingDeleteSessionIds,
    showDeleteConfirm,
    isPendingSession,
    isDeletingSession,
    getConnectActionLabel,
    handleCreateSession,
    handleResumeSession,
    handleSessionClick,
    handleConnectAction,
    handleDelete,
    handleDeleteSession,
    handleDisconnect,
    handleToggleSessionPin,
    confirmDelete,
    cancelDelete,
  } = useChatSessionActions({
    sessionStore,
    emit,
    t,
    selectedAgent,
    selectedCwd,
    activeWorkspaceId,
    previewSessionId,
    persistPreferences,
    persistProxyPreferences,
    buildSessionProxyConfig,
    applyProxyConfig,
    syncSelectionFromCurrentSession,
    isConnecting,
    isConnectedSession,
    toggleSessionPin,
    removeSessionPin,
  });

  const {
    showWorkspaceDeleteConfirm,
    pendingDeleteWorkspaceId,
    handleSelectWorkspace,
    syncActiveWorkspaceFallback,
    refreshScannedSessions,
    handleSelectFolder,
    openWorkspaceDialog,
    handleNewSessionFromWorkspace,
    handleAddWorkspace,
    handleRemoveWorkspaceClick,
    handleDeleteWorkspace,
    confirmDeleteWorkspace,
    cancelDeleteWorkspace,
    handleRefreshWorkspace,
  } = useChatSessionWorkspaceManagement({
    configStore,
    sessionStore,
    emit,
    t,
    workspaces,
    connectedSessionIds,
    selectedAgent,
    selectedCwd,
    activeWorkspaceId,
    isConnecting,
    isSelectingFolder: () => props.isSelectingFolder,
    expandWorkspace,
    persistPreferences,
    syncSelectionFromCurrentSession,
    pendingResumeSessionIds,
    pendingDisconnectSessionIds,
    pendingDeleteSessionIds,
    isPreferencesLoaded: () => preferencesLoaded,
  });

  function readStoredString(value) {
    if (typeof value === 'string') return value;
    if (value == null) return '';
    return String(value);
  }

  async function persistPreferences(updates = {}) {
    prefsStoreData = {
      ...prefsStoreData,
      ...updates,
    };
    await saveStore(prefsStoreName, prefsStoreData);
  }

  function applyProxyConfig(proxy) {
    emit('update:proxyEnabled', !!proxy?.enabled);
    emit('update:httpProxy', readStoredString(proxy?.httpProxy));
    emit('update:httpsProxy', readStoredString(proxy?.httpsProxy));
    emit('update:allProxy', readStoredString(proxy?.allProxy));
    emit('update:noProxy', readStoredString(proxy?.noProxy));
  }

  function syncSelectionFromCurrentSession() {
    const current = sessionStore.currentSession;
    if (!current) return;
    selectedAgent.value = current.agentName;
    selectedCwd.value = current.cwd;
    activeWorkspaceId.value = current.workspaceId || sessionStore.ensureWorkspaceForCwd(current.cwd).id;
    applyProxyConfig(current.proxy);
  }

  async function persistProxyPreferences() {
    await saveStore(prefsStoreName, {
      ...prefsStoreData,
      proxyEnabled: props.proxyEnabled,
      httpProxy: props.httpProxy,
      httpsProxy: props.httpsProxy,
      allProxy: props.allProxy,
      noProxy: props.noProxy,
    });
  }

  function buildSessionProxyConfig() {
    return {
      enabled: props.proxyEnabled,
      httpProxy: props.httpProxy.trim() || undefined,
      httpsProxy: props.httpsProxy.trim() || undefined,
      allProxy: props.allProxy.trim() || undefined,
      noProxy: props.noProxy.trim() || undefined,
    };
  }

  onMounted(async () => {
    prefsStoreData = await loadStore(prefsStoreName);
    setPinnedSessionIds(Array.isArray(prefsStoreData.pinnedSessionIds)
      ? prefsStoreData.pinnedSessionIds
      : []);

    await configStore.loadConfig();
    await configStore.setupHotReload();
    await sessionStore.initStore();
    await refreshScannedSessions();

    const savedCwd = readStoredString(prefsStoreData.lastCwd);
    if (savedCwd) {
      selectedCwd.value = savedCwd;
    }
    activeWorkspaceId.value = readStoredString(prefsStoreData.activeWorkspaceId);
    syncActiveWorkspaceFallback();

    preferencesLoaded = true;
  });

  watch(
    () => configStore.agentNames.join('\n'),
    async () => {
      if (!preferencesLoaded) return;
      await refreshScannedSessions();
    }
  );

  watch(
    () => activeWorkspaceId.value,
    (id) => {
      if (id) {
        expandWorkspace(id);
      }
    },
    { immediate: true }
  );

  watch(
    () => normalizedQuery.value,
    (query) => {
      if (query) {
        expandFilteredWorkspaces();
      }
    }
  );

  return {
    activeWorkspaceId,
    currentSessionId,
    currentSessionInActiveWorkspace,
    handleAddWorkspace,
    handleConnectAction,
    handleCreateSession,
    handleDelete,
    handleDeleteSession,
    handleDeleteWorkspace,
    handleDisconnect,
    handleNewSessionFromWorkspace,
    handleRefreshWorkspace,
    handleRemoveWorkspaceClick,
    handleResumeSession,
    handleSelectFolder,
    handleSelectWorkspace,
    handleSessionClick,
    handleToggleSessionPin,
    isConnected,
    isConnectedSession,
    isChatLoadingSession,
    isConnecting,
    isDeletingSession,
    isPendingSession,
    isPinned,
    isSelectedSession,
    isWorkspaceOpen,
    openWorkspaceDialog,
    pendingDeleteWorkspaceId,
    previewSessionId,
    savedSessionCount,
    selectedAgent,
    selectedCwd,
    sessionSearchQuery,
    showDeleteConfirm,
    showWorkspaceDeleteConfirm,
    syncSelectionFromCurrentSession,
    t,
    toggleWorkspace,
    workspaces,
    workspaceList,
    getConnectActionLabel,
    getSessionSummary,
    cancelDelete,
    confirmDelete,
    cancelDeleteWorkspace,
    confirmDeleteWorkspace,
  };
}
