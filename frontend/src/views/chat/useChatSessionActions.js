import { computed, ref } from 'vue';

export function useChatSessionActions({
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
}) {
  const pendingResumeSessionIds = ref([]);
  const pendingDisconnectSessionIds = ref([]);
  const pendingDeleteSessionIds = ref([]);
  const showDeleteConfirm = ref(false);
  const pendingDeleteSessionId = ref('');

  const pendingSessionIds = computed(() => [
    ...new Set([
      ...pendingResumeSessionIds.value,
      ...pendingDisconnectSessionIds.value,
      ...pendingDeleteSessionIds.value,
    ]),
  ]);

  function addPending(target, sessionId) {
    if (!sessionId || target.value.includes(sessionId)) return false;
    target.value = [...target.value, sessionId];
    return true;
  }

  function removePending(target, sessionId) {
    target.value = target.value.filter((id) => id !== sessionId);
  }

  function isActionPending(sessionId) {
    return pendingSessionIds.value.includes(sessionId);
  }

  function isActionDeleting(sessionId) {
    return pendingDeleteSessionIds.value.includes(sessionId);
  }

  function getConnectActionLabel(session) {
    if (session.external) return t('session.externalScanned');
    if (isActionDeleting(session.id)) return t('session.deleting');
    if (isConnectedSession(session.id)) {
      return isActionPending(session.id) ? t('session.disconnecting') : t('session.disconnect');
    }
    return isActionPending(session.id) ? t('session.connecting') : t('session.connect');
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
      previewSessionId.value = sessionStore.currentSession?.id ?? '';
      if (sessionStore.currentSession) {
        emit('open-session-tab', sessionStore.currentSession);
      }
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
      emit('open-session-tab', sessionStore.currentSession?.id === session.id ? sessionStore.currentSession : session);
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
    previewSessionId.value = session.id;
    emit('open-session-tab', session);
    if (session.external) return;
    if (isConnectedSession(session.id)) {
      handleActivateSession(session.id);
    }
  }

  function handleConnectAction(session, event) {
    event.stopPropagation();
    if (session.external || isActionPending(session.id) || isActionDeleting(session.id)) return;
    if (isConnectedSession(session.id)) {
      handleDisconnect(session.id);
      return;
    }
    handleResumeSession(session);
  }

  function handleDelete(sessionId, event) {
    event.stopPropagation();
    if (isActionPending(sessionId) || isActionDeleting(sessionId)) return;
    pendingDeleteSessionId.value = sessionId;
    showDeleteConfirm.value = true;
  }

  async function handleToggleSessionPin(sessionId, event) {
    event?.stopPropagation?.();
    const session = sessionStore.visibleSessions.find((item) => item.id === sessionId);
    if (session?.external || isActionPending(sessionId) || isActionDeleting(sessionId)) return;
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

  return {
    pendingResumeSessionIds,
    pendingDisconnectSessionIds,
    pendingDeleteSessionIds,
    pendingSessionIds,
    showDeleteConfirm,
    isPendingSession: isActionPending,
    isDeletingSession: isActionDeleting,
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
  };
}
