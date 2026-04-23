import { computed, ref, watch } from 'vue';

function createTabFromSession(session) {
  return {
    id: session.id,
    sessionId: session.id,
    title: session.title,
    agentName: session.agentName,
    cwd: session.cwd,
    workspaceId: session.workspaceId,
    external: session.external === true,
    openedAt: Date.now(),
    lastActivatedAt: Date.now(),
  };
}

function syncTab(tab, session) {
  return {
    ...tab,
    title: session.title,
    agentName: session.agentName,
    cwd: session.cwd,
    workspaceId: session.workspaceId,
    external: session.external === true,
  };
}

export function useChatTabs({ sessionStore, previewSessionId }) {
  const chatTabs = ref([]);
  const activeChatTabId = ref('');

  const activeTabSession = computed(() => {
    const activeTab = chatTabs.value.find((tab) => tab.sessionId === activeChatTabId.value);
    if (!activeTab) return null;
    return sessionStore.visibleSessions.find((session) => session.id === activeTab.sessionId)
      || (sessionStore.currentSession?.id === activeTab.sessionId ? sessionStore.currentSession : null)
      || activeTab;
  });

  const tabItems = computed(() =>
    chatTabs.value.map((tab) => {
      const session = sessionStore.visibleSessions.find((item) => item.id === tab.sessionId)
        || (sessionStore.currentSession?.id === tab.sessionId ? sessionStore.currentSession : null)
        || tab;
      return {
        id: tab.sessionId,
        label: session.title || tab.title || session.agentName || tab.agentName || 'Chat',
        title: [session.title || tab.title, session.agentName || tab.agentName, session.cwd || tab.cwd]
          .filter(Boolean)
          .join(' · '),
        badge: session.external ? 'ext' : undefined,
        session,
      };
    })
  );

  function isConnectedSession(sessionId) {
    return sessionStore.connectedSessionIds.includes(sessionId);
  }

  function setActiveTab(sessionId) {
    if (!sessionId || !chatTabs.value.some((tab) => tab.sessionId === sessionId)) {
      return;
    }

    activeChatTabId.value = sessionId;
    previewSessionId.value = sessionId;
    chatTabs.value = chatTabs.value.map((tab) =>
      tab.sessionId === sessionId ? { ...tab, lastActivatedAt: Date.now() } : tab
    );

    if (isConnectedSession(sessionId)) {
      sessionStore.setActiveSession(sessionId);
    }
  }

  function openSessionTab(session) {
    if (!session?.id) return;

    const existing = chatTabs.value.find((tab) => tab.sessionId === session.id);
    if (existing) {
      chatTabs.value = chatTabs.value.map((tab) =>
        tab.sessionId === session.id ? syncTab(tab, session) : tab
      );
    } else {
      chatTabs.value = [...chatTabs.value, createTabFromSession(session)];
    }
    setActiveTab(session.id);
  }

  function closeChatTab(sessionId) {
    const closingIndex = chatTabs.value.findIndex((tab) => tab.sessionId === sessionId);
    if (closingIndex < 0) return;

    const wasActive = activeChatTabId.value === sessionId;
    const nextTabs = chatTabs.value.filter((tab) => tab.sessionId !== sessionId);
    chatTabs.value = nextTabs;

    if (!wasActive) return;

    const nextTab = nextTabs[Math.min(closingIndex, nextTabs.length - 1)] || nextTabs[closingIndex - 1] || null;
    if (nextTab) {
      setActiveTab(nextTab.sessionId);
      return;
    }

    activeChatTabId.value = '';
    previewSessionId.value = '';
  }

  function openCurrentSessionTab() {
    if (sessionStore.currentSession) {
      openSessionTab(sessionStore.currentSession);
    }
  }

  watch(
    () => sessionStore.currentSession?.id,
    () => {
      openCurrentSessionTab();
    }
  );

  watch(
    () => sessionStore.visibleSessions.map((session) => `${session.id}:${session.title}:${session.lastUpdated}`).join('\n'),
    () => {
      const visibleIds = new Set(sessionStore.visibleSessions.map((session) => session.id));
      const connectedIds = new Set(sessionStore.connectedSessionIds);
      chatTabs.value = chatTabs.value
        .filter((tab) => visibleIds.has(tab.sessionId) || connectedIds.has(tab.sessionId))
        .map((tab) => {
          const session = sessionStore.visibleSessions.find((item) => item.id === tab.sessionId)
            || (sessionStore.currentSession?.id === tab.sessionId ? sessionStore.currentSession : null);
          return session ? syncTab(tab, session) : tab;
        });

      if (activeChatTabId.value && !chatTabs.value.some((tab) => tab.sessionId === activeChatTabId.value)) {
        const nextTab = chatTabs.value[0] || null;
        if (nextTab) {
          setActiveTab(nextTab.sessionId);
        } else {
          activeChatTabId.value = '';
          previewSessionId.value = '';
        }
      }
    }
  );

  return {
    chatTabs,
    activeChatTabId,
    activeTabSession,
    tabItems,
    openSessionTab,
    setActiveTab,
    closeChatTab,
  };
}
