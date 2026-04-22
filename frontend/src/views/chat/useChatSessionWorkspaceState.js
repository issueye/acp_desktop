import { computed, ref } from 'vue';

export function useChatSessionWorkspaceState({
  sessionStore,
  workspaces,
  currentSessionId,
  previewSessionId,
}) {
  const sessionSearchQuery = ref('');
  const pinnedSessionIds = ref([]);
  const expandedWorkspaces = ref(new Set());

  const normalizedQuery = computed(() => sessionSearchQuery.value.trim().toLowerCase());

  function sessionsForWorkspace(workspaceId) {
    const pinned = new Set(pinnedSessionIds.value);
    return sessionStore.savedSessions
      .filter((session) => session.workspaceId === workspaceId)
      .sort((a, b) => {
        const aPinned = pinned.has(a.id);
        const bPinned = pinned.has(b.id);
        if (aPinned !== bPinned) return aPinned ? -1 : 1;
        return b.lastUpdated - a.lastUpdated;
      });
  }

  const workspaceList = computed(() => {
    const query = normalizedQuery.value;
    return workspaces.value
      .map((workspace) => {
        let sessions = sessionsForWorkspace(workspace.id);
        if (query) {
          sessions = sessions.filter((session) => {
            const haystack = `${session.title} ${session.agentName} ${workspace.name} ${workspace.cwd}`.toLowerCase();
            return haystack.includes(query);
          });
        }
        return { ...workspace, sessions };
      })
      .filter((workspace) => workspace.sessions.length > 0 || (!query && workspace.sessionCount === 0));
  });

  function setPinnedSessionIds(sessionIds) {
    pinnedSessionIds.value = Array.isArray(sessionIds) ? [...sessionIds] : [];
  }

  function expandWorkspace(workspaceId) {
    if (!workspaceId) return;
    expandedWorkspaces.value = new Set([...expandedWorkspaces.value, workspaceId]);
  }

  function expandFilteredWorkspaces() {
    expandedWorkspaces.value = new Set(workspaceList.value.map((workspace) => workspace.id));
  }

  function isWorkspaceOpen(workspaceId) {
    return expandedWorkspaces.value.has(workspaceId) || normalizedQuery.value !== '';
  }

  function toggleWorkspace(workspaceId) {
    const next = new Set(expandedWorkspaces.value);
    if (next.has(workspaceId)) next.delete(workspaceId);
    else next.add(workspaceId);
    expandedWorkspaces.value = next;
  }

  function isPinned(sessionId) {
    return pinnedSessionIds.value.includes(sessionId);
  }

  function isSelectedSession(sessionId) {
    return previewSessionId.value === sessionId || currentSessionId.value === sessionId;
  }

  function getSessionSummary(session) {
    return [session.agentName, session.cwd, new Date(session.lastUpdated).toLocaleString()]
      .filter(Boolean)
      .join(' · ');
  }

  async function persistPinnedSessionIds(sessionIds, persistPreferences) {
    await persistPreferences({ pinnedSessionIds: sessionIds });
  }

  async function handleToggleSessionPin(sessionId, persistPreferences) {
    if (!sessionStore.savedSessions.some((session) => session.id === sessionId)) return;
    if (pinnedSessionIds.value.includes(sessionId)) {
      pinnedSessionIds.value = pinnedSessionIds.value.filter((id) => id !== sessionId);
    } else {
      pinnedSessionIds.value = [...pinnedSessionIds.value, sessionId];
    }
    await persistPinnedSessionIds(pinnedSessionIds.value, persistPreferences);
  }

  async function removeSessionPin(sessionId, persistPreferences) {
    if (!pinnedSessionIds.value.includes(sessionId)) return false;
    pinnedSessionIds.value = pinnedSessionIds.value.filter((id) => id !== sessionId);
    await persistPinnedSessionIds(pinnedSessionIds.value, persistPreferences);
    return true;
  }

  return {
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
    handleToggleSessionPin,
    removeSessionPin,
  };
}
