import { computed, onMounted, ref, watch } from 'vue';
import { useConfigStore } from '../../stores/config';
import { useSessionStore } from '../../stores/session';
import { useI18n } from '../../lib/i18n';
import { loadStore, saveStore, selectDirectory } from '../../lib/wails';
import { useChatSessionWorkspaceState } from './useChatSessionWorkspaceState';

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
  const pendingResumeSessionIds = ref([]);
  const pendingDisconnectSessionIds = ref([]);
  const pendingDeleteSessionIds = ref([]);
  const refreshingWorkspaceIds = ref([]);
  const showDeleteConfirm = ref(false);
  const pendingDeleteSessionId = ref('');
  const showWorkspaceDeleteConfirm = ref(false);
  const pendingDeleteWorkspaceId = ref('');

  let prefsStoreData = {};
  const prefsStoreName = 'preferences.json';
  let preferencesLoaded = false;

  const isConnected = computed(() => sessionStore.isConnected);
  const isConnecting = computed(() => sessionStore.isConnecting);
  const savedSessionCount = computed(() => sessionStore.visibleSessions.length);
  const workspaces = computed(() => sessionStore.workspacesWithCounts);
  const connectedSessionIds = computed(() => sessionStore.connectedSessionIds);
  const pendingSessionIds = computed(() => [
    ...new Set([
      ...pendingResumeSessionIds.value,
      ...pendingDisconnectSessionIds.value,
      ...pendingDeleteSessionIds.value,
    ]),
  ]);
  const currentSessionId = computed(() => sessionStore.currentSession?.id ?? '');
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

  function isPendingSession(sessionId) {
    return pendingSessionIds.value.includes(sessionId);
  }

  function isDeletingSession(sessionId) {
    return pendingDeleteSessionIds.value.includes(sessionId);
  }

  function getConnectActionLabel(session) {
    if (session.external) return t('session.externalScanned');
    if (isDeletingSession(session.id)) return t('session.deleting');
    if (isConnectedSession(session.id)) {
      return isPendingSession(session.id) ? t('session.disconnecting') : t('session.disconnect');
    }
    return isPendingSession(session.id) ? t('session.connecting') : t('session.connect');
  }

  function isConnectedSession(sessionId) {
    return connectedSessionIds.value.includes(sessionId);
  }

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

  function addPending(target, sessionId) {
    if (!sessionId || target.value.includes(sessionId)) return false;
    target.value = [...target.value, sessionId];
    return true;
  }

  function removePending(target, sessionId) {
    target.value = target.value.filter((id) => id !== sessionId);
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

  async function handleSelectWorkspace(workspaceId) {
    const workspace = workspaces.value.find((item) => item.id === workspaceId);
    if (!workspace) return;
    activeWorkspaceId.value = workspace.id;
    selectedCwd.value = workspace.cwd;
    const connectedSessionInWorkspace = sessionStore.savedSessions.find((session) =>
      session.workspaceId === workspace.id && connectedSessionIds.value.includes(session.id)
    );
    if (connectedSessionInWorkspace) {
      sessionStore.setActiveSession(connectedSessionInWorkspace.id);
    }
    await persistPreferences({
      activeWorkspaceId: workspace.id,
      lastCwd: workspace.cwd,
    });
    expandWorkspace(workspace.id);
  }

  function syncActiveWorkspaceFallback() {
    if (activeWorkspaceId.value && workspaces.value.some((workspace) => workspace.id === activeWorkspaceId.value)) {
      return;
    }
    const preferred = selectedCwd.value
      ? workspaces.value.find((workspace) => workspace.cwd === selectedCwd.value)
      : null;
    activeWorkspaceId.value = preferred?.id || workspaces.value[0]?.id || '';
    if (activeWorkspaceId.value) {
      handleSelectWorkspace(activeWorkspaceId.value);
    }
  }

  async function refreshScannedSessions() {
    try {
      await sessionStore.scanConfiguredAgentSessions(configStore.agentNames);
      if (preferencesLoaded) syncActiveWorkspaceFallback();
    } catch (e) {
      console.warn('Failed to scan agent sessions:', e);
    }
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

  async function handleSelectFolder() {
    if (props.isSelectingFolder) return;
    emit('update:isSelectingFolder', true);
    try {
      const folder = await selectDirectory();
      if (!folder) return;
      selectedCwd.value = folder;
      const workspace = await sessionStore.addWorkspace(folder);
      activeWorkspaceId.value = workspace.id;
      await persistPreferences({
        lastCwd: folder,
        activeWorkspaceId: workspace.id,
      });
    } finally {
      emit('update:isSelectingFolder', false);
    }
  }

  function openWorkspaceDialog() {
    if (!selectedCwd.value && activeWorkspaceId.value) {
      const workspace = workspaces.value.find((item) => item.id === activeWorkspaceId.value);
      if (workspace) {
        selectedCwd.value = workspace.cwd;
      }
    }
    emit('update:showWorkspaceDialog', true);
  }

  function handleNewSessionFromWorkspace(workspaceId, event) {
    event.stopPropagation();
    const workspace = workspaces.value.find((item) => item.id === workspaceId);
    if (!workspace) return;
    activeWorkspaceId.value = workspace.id;
    selectedCwd.value = workspace.cwd;
    emit('update:showWorkspaceDialog', true);
  }

  async function handleAddWorkspace() {
    if (props.isSelectingFolder || isConnecting.value) return;
    emit('update:isSelectingFolder', true);
    try {
      const folder = await selectDirectory();
      if (!folder) return;
      const workspace = await sessionStore.addWorkspace(folder);
      handleSelectWorkspace(workspace.id);
      emit('notify', { message: `${t('workspace.added')}: ${workspace.name}`, tone: 'success' });
    } catch (e) {
      emit('notify', { message: String(e), tone: 'danger' });
    } finally {
      emit('update:isSelectingFolder', false);
    }
  }

  function handleViewSession(sessionId) {
    previewSessionId.value = sessionId;
  }

  function handleRemoveWorkspaceClick(workspaceId, event) {
    event.stopPropagation();
    pendingDeleteWorkspaceId.value = workspaceId;
    showWorkspaceDeleteConfirm.value = true;
  }

  async function handleDeleteWorkspace(workspaceId) {
    const workspace = workspaces.value.find((item) => item.id === workspaceId);
    try {
      await sessionStore.deleteWorkspace(workspaceId);
      if (activeWorkspaceId.value === workspaceId) {
        activeWorkspaceId.value = '';
        syncActiveWorkspaceFallback();
      }
      syncSelectionFromCurrentSession();
      emit('notify', { message: `${t('workspace.removed')}: ${workspace?.name || ''}`, tone: 'success' });
    } catch (e) {
      emit('notify', { message: String(e), tone: 'danger' });
    }
  }

  async function confirmDeleteWorkspace() {
    const workspaceId = pendingDeleteWorkspaceId.value;
    if (!workspaceId) return;
    const sessionsToDelete = sessionStore.visibleSessions.filter((session) => session.workspaceId === workspaceId);

    for (const session of sessionsToDelete) {
      if (
        !pendingDeleteSessionIds.value.includes(session.id) &&
        !pendingResumeSessionIds.value.includes(session.id) &&
        !pendingDisconnectSessionIds.value.includes(session.id)
      ) {
        try {
          await sessionStore.deleteSession(session.id);
        } catch (e) {
          console.warn('Failed to delete session:', session.id, e);
        }
      }
    }

    await handleDeleteWorkspace(workspaceId);

    pendingDeleteWorkspaceId.value = '';
    showWorkspaceDeleteConfirm.value = false;
  }

  function cancelDeleteWorkspace() {
    pendingDeleteWorkspaceId.value = '';
    showWorkspaceDeleteConfirm.value = false;
  }

  async function handleRefreshWorkspace(workspaceId, agentName = selectedAgent.value) {
    const workspace = workspaceId ? workspaces.value.find((item) => item.id === workspaceId) : null;
    const refreshKey = workspace?.id || (agentName ? `agent:${agentName}` : 'agent:all');
    if (refreshingWorkspaceIds.value.includes(refreshKey)) return;

    const names = agentName ? [agentName] : configStore.agentNames;
    if (names.length === 0) {
      emit('notify', { message: t('agent.noneConfigured'), tone: 'info' });
      return;
    }

    addPending(refreshingWorkspaceIds, refreshKey);
    try {
      let sessions = [];
      if (workspace && typeof sessionStore.scanWorkspaceAgentSessions === 'function') {
        sessions = await sessionStore.scanWorkspaceAgentSessions(names, workspace);
      } else {
        await sessionStore.scanConfiguredAgentSessions(names);
        const agentNameSet = new Set(names);
        sessions = sessionStore.scannedSessions.filter((session) => agentNameSet.has(session.agentName));
      }
      emit('notify', { message: t('workspace.refreshDone', { count: sessions.length }), tone: 'success' });
    } catch (e) {
      emit('notify', { message: String(e), tone: 'danger' });
    } finally {
      removePending(refreshingWorkspaceIds, refreshKey);
    }
  }

  async function handleCreateSession() {
    if (!selectedAgent.value || isConnecting.value) return;
    try {
      await persistProxyPreferences();
      await sessionStore.createSession(
        selectedAgent.value,
        selectedCwd.value || '.',
        buildSessionProxyConfig()
      );
      syncSelectionFromCurrentSession();
      previewSessionId.value = currentSessionId.value;
      await persistPreferences({
        activeWorkspaceId: activeWorkspaceId.value,
        lastCwd: selectedCwd.value,
      });
      emit('update:showWorkspaceDialog', false);
      emit('notify', { message: `${t('app.newSession')}: ${selectedAgent.value}`, tone: 'success' });
    } catch (e) {
      console.error('Failed to create session:', e);
      emit('notify', { message: String(e), tone: 'danger' });
    }
  }

  async function handleResumeSession(session) {
    if (session?.external) {
      emit('notify', { message: t('session.externalReadOnly'), tone: 'info' });
      return;
    }
    if (
      pendingResumeSessionIds.value.includes(session.id) ||
      pendingDisconnectSessionIds.value.includes(session.id) ||
      pendingDeleteSessionIds.value.includes(session.id)
    ) {
      return;
    }
    selectedAgent.value = session.agentName;
    selectedCwd.value = session.cwd;
    activeWorkspaceId.value = session.workspaceId || sessionStore.ensureWorkspaceForCwd(session.cwd).id;
    applyProxyConfig(session.proxy);
    await persistPreferences({
      lastCwd: session.cwd,
      activeWorkspaceId: activeWorkspaceId.value,
    });
    await persistProxyPreferences();
    addPending(pendingResumeSessionIds, session.id);
    try {
      await sessionStore.resumeSession(session);
      previewSessionId.value = session.id;
      emit('notify', { message: `${t('session.connect')}: ${session.title}`, tone: 'success' });
    } catch (e) {
      console.error('Failed to resume session:', e);
      emit('notify', { message: String(e), tone: 'danger' });
    } finally {
      removePending(pendingResumeSessionIds, session.id);
    }
  }

  function handleActivateSession(sessionId) {
    const session = sessionStore.savedSessions.find((item) => item.id === sessionId);
    sessionStore.setActiveSession(sessionId);
    previewSessionId.value = sessionId;
    if (!session) return;
    selectedAgent.value = session.agentName;
    selectedCwd.value = session.cwd;
    activeWorkspaceId.value = session.workspaceId || sessionStore.ensureWorkspaceForCwd(session.cwd).id;
    applyProxyConfig(session.proxy);
  }

  function handleSessionClick(session) {
    handleViewSession(session.id);
    if (session.external) return;
    if (isConnectedSession(session.id)) {
      handleActivateSession(session.id);
    }
  }

  function handleConnectAction(session, event) {
    event.stopPropagation();
    if (session.external || isPendingSession(session.id) || isDeletingSession(session.id)) return;
    if (isConnectedSession(session.id)) {
      handleDisconnect(session.id);
      return;
    }
    handleResumeSession(session);
  }

  function handleDelete(sessionId, event) {
    event.stopPropagation();
    if (isPendingSession(sessionId) || isDeletingSession(sessionId)) return;
    pendingDeleteSessionId.value = sessionId;
    showDeleteConfirm.value = true;
  }

  async function handleToggleSessionPin(sessionId, event) {
    event?.stopPropagation?.();
    const session = sessionStore.visibleSessions.find((item) => item.id === sessionId);
    if (session?.external || isPendingSession(sessionId) || isDeletingSession(sessionId)) return;
    await toggleSessionPin(sessionId);
  }

  async function handleDeleteSession(sessionId) {
    if (
      pendingDeleteSessionIds.value.includes(sessionId) ||
      pendingResumeSessionIds.value.includes(sessionId) ||
      pendingDisconnectSessionIds.value.includes(sessionId)
    ) {
      return;
    }
    const deletedSession = sessionStore.visibleSessions.find((session) => session.id === sessionId);
    if (!deletedSession) return;
    addPending(pendingDeleteSessionIds, sessionId);
    try {
      await sessionStore.deleteSession(sessionId);
      await removeSessionPin(sessionId, persistPreferences);
      syncSelectionFromCurrentSession();
      emit('notify', { message: `${t('session.delete')}: ${deletedSession.title}`, tone: 'success' });
    } catch (e) {
      emit('notify', { message: String(e), tone: 'danger' });
    } finally {
      removePending(pendingDeleteSessionIds, sessionId);
    }
  }

  async function handleDisconnect(sessionId) {
    const targetSessionId = sessionId || sessionStore.currentSession?.id || '';
    if (
      !targetSessionId ||
      pendingDisconnectSessionIds.value.includes(targetSessionId) ||
      pendingResumeSessionIds.value.includes(targetSessionId) ||
      pendingDeleteSessionIds.value.includes(targetSessionId)
    ) {
      return;
    }
    const disconnectingSession = sessionStore.savedSessions.find((session) => session.id === targetSessionId)
      || sessionStore.currentSession;
    addPending(pendingDisconnectSessionIds, targetSessionId);
    try {
      await sessionStore.disconnect(sessionId);
      syncSelectionFromCurrentSession();
      if (disconnectingSession) {
        emit('notify', { message: `${t('session.disconnect')}: ${disconnectingSession.title}`, tone: 'info' });
      }
    } catch (e) {
      emit('notify', { message: String(e), tone: 'danger' });
    } finally {
      removePending(pendingDisconnectSessionIds, targetSessionId);
    }
  }

  function confirmDelete() {
    if (!pendingDeleteSessionId.value) return;
    handleDeleteSession(pendingDeleteSessionId.value);
    pendingDeleteSessionId.value = '';
    showDeleteConfirm.value = false;
  }

  function cancelDelete() {
    pendingDeleteSessionId.value = '';
    showDeleteConfirm.value = false;
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
