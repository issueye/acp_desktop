import { ref } from 'vue';
import { selectDirectory } from '../../lib/wails';

export function useChatSessionWorkspaceManagement({
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
  isSelectingFolder,
  expandWorkspace,
  persistPreferences,
  syncSelectionFromCurrentSession,
  pendingResumeSessionIds,
  pendingDisconnectSessionIds,
  pendingDeleteSessionIds,
  isPreferencesLoaded,
}) {
  const refreshingWorkspaceIds = ref([]);
  const showWorkspaceDeleteConfirm = ref(false);
  const pendingDeleteWorkspaceId = ref('');

  function addPending(target, key) {
    if (!key || target.value.includes(key)) return false;
    target.value = [...target.value, key];
    return true;
  }

  function removePending(target, key) {
    target.value = target.value.filter((id) => id !== key);
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
      if (isPreferencesLoaded()) syncActiveWorkspaceFallback();
    } catch (e) {
      console.warn('Failed to scan agent sessions:', e);
    }
  }

  async function handleSelectFolder() {
    if (isSelectingFolder() || isConnecting.value) return;
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
    if (isSelectingFolder() || isConnecting.value) return;
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

  return {
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
  };
}
