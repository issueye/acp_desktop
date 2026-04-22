<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useConfigStore } from '../../stores/config';
import { useSessionStore } from '../../stores/session';
import { useI18n } from '../../lib/i18n';
import { loadStore, saveStore, selectDirectory } from '../../lib/wails';
import AgentAvatar from '../../components/AgentAvatar.vue';
import AppConfirmDialog from '../../components/AppConfirmDialog.vue';

const configStore = useConfigStore();
const sessionStore = useSessionStore();
const { t } = useI18n();

const props = defineProps({
  show: { type: Boolean, default: true },
  isSelectingFolder: { type: Boolean, required: true },
  selectedAgent: { type: String, default: '' },
  selectedCwd: { type: String, default: '' },
  activeWorkspaceId: { type: String, default: '' },
  proxyEnabled: { type: Boolean, required: true },
  httpProxy: { type: String, required: true },
  httpsProxy: { type: String, required: true },
  allProxy: { type: String, required: true },
  noProxy: { type: String, required: true },
  previewSessionId: { type: String, default: '' },
});

const emit = defineEmits([
  'update:selectedAgent',
  'update:selectedCwd',
  'update:activeWorkspaceId',
  'update:proxyEnabled',
  'update:httpProxy',
  'update:httpsProxy',
  'update:allProxy',
  'update:noProxy',
  'update:isSelectingFolder',
  'update:showWorkspaceDialog',
  'update:previewSessionId',
  'notify',
]);

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
const sessionSearchQuery = ref('');
const previewSessionId = computed({
  get: () => props.previewSessionId,
  set: (value) => emit('update:previewSessionId', value),
});
const pinnedSessionIds = ref([]);
const pendingResumeSessionIds = ref([]);
const pendingDisconnectSessionIds = ref([]);
const pendingDeleteSessionIds = ref([]);
const refreshingWorkspaceIds = ref([]);
const expandedWorkspaces = ref(new Set());
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
const agentNames = computed(() => configStore.agentNames);

const normalizedQuery = computed(() => sessionSearchQuery.value.trim().toLowerCase());

function sessionsForWorkspace(workspaceId) {
  const pinned = new Set(pinnedSessionIds.value);
  return sessionStore.savedSessions
    .filter((s) => s.workspaceId === workspaceId)
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
    .map((ws) => {
      let sessions = sessionsForWorkspace(ws.id);
      if (query) {
        sessions = sessions.filter((s) => {
          const haystack = `${s.title} ${s.agentName} ${ws.name} ${ws.cwd}`.toLowerCase();
          return haystack.includes(query);
        });
      }
      return { ...ws, sessions };
    })
    .filter((ws) => ws.sessions.length > 0 || (!query && ws.sessionCount === 0));
});

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

function isConnectedSession(sessionId) {
  return connectedSessionIds.value.includes(sessionId);
}

function isSelectedSession(sessionId) {
  return previewSessionId.value === sessionId || currentSessionId.value === sessionId;
}

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

function getSessionSummary(session) {
  return [session.agentName, session.cwd, new Date(session.lastUpdated).toLocaleString()]
    .filter(Boolean)
    .join(' · ');
}

function readStoredString(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

async function persistPreferences() {
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

function syncSelectionFromCurrentSession() {
  const current = sessionStore.currentSession;
  if (!current) return;
  selectedAgent.value = current.agentName;
  selectedCwd.value = current.cwd;
  activeWorkspaceId.value = current.workspaceId || sessionStore.ensureWorkspaceForCwd(current.cwd).id;
  applyProxyConfig(current.proxy);
}

function syncActiveWorkspaceFallback() {
  if (activeWorkspaceId.value && workspaces.value.some((w) => w.id === activeWorkspaceId.value)) return;
  const preferred = selectedCwd.value
    ? workspaces.value.find((w) => w.cwd === selectedCwd.value)
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

function applyProxyConfig(proxy) {
  emit('update:proxyEnabled', !!proxy?.enabled);
  emit('update:httpProxy', readStoredString(proxy?.httpProxy));
  emit('update:httpsProxy', readStoredString(proxy?.httpsProxy));
  emit('update:allProxy', readStoredString(proxy?.allProxy));
  emit('update:noProxy', readStoredString(proxy?.noProxy));
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

async function handleAgentSelect(agentName) {
  selectedAgent.value = agentName;
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
    prefsStoreData.lastCwd = folder;
    prefsStoreData.activeWorkspaceId = workspace.id;
    await persistPreferences();
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
  prefsStoreData.activeWorkspaceId = workspace.id;
  prefsStoreData.lastCwd = workspace.cwd;
  await persistPreferences();
  // auto-expand selected workspace
  expandedWorkspaces.value = new Set([...expandedWorkspaces.value, workspace.id]);
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
  const workspace = workspaces.value.find((w) => w.id === workspaceId);
  const sessionsToDelete = sessionStore.visibleSessions.filter((s) => s.workspaceId === workspaceId);

  // Delete all sessions under this workspace first
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

  // Then delete the workspace
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
    prefsStoreData.activeWorkspaceId = activeWorkspaceId.value;
    prefsStoreData.lastCwd = selectedCwd.value;
    await persistPreferences();
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
  prefsStoreData.lastCwd = session.cwd;
  prefsStoreData.activeWorkspaceId = activeWorkspaceId.value;
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

function handleTogglePin(sessionId, event) {
  event.stopPropagation();
  const session = sessionStore.visibleSessions.find((item) => item.id === sessionId);
  if (session?.external || isPendingSession(sessionId) || isDeletingSession(sessionId)) return;
  handleToggleSessionPin(sessionId);
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
    if (pinnedSessionIds.value.includes(sessionId)) {
      pinnedSessionIds.value = pinnedSessionIds.value.filter((id) => id !== sessionId);
      prefsStoreData.pinnedSessionIds = pinnedSessionIds.value;
      await persistPreferences();
    }
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

async function handleToggleSessionPin(sessionId) {
  if (!sessionStore.savedSessions.some((session) => session.id === sessionId)) return;
  if (pinnedSessionIds.value.includes(sessionId)) {
    pinnedSessionIds.value = pinnedSessionIds.value.filter((id) => id !== sessionId);
  } else {
    pinnedSessionIds.value = [...pinnedSessionIds.value, sessionId];
  }
  prefsStoreData.pinnedSessionIds = pinnedSessionIds.value;
  await persistPreferences();
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
  pinnedSessionIds.value = Array.isArray(prefsStoreData.pinnedSessionIds)
    ? prefsStoreData.pinnedSessionIds
    : [];

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

// Auto-expand selected workspace
watch(
  () => activeWorkspaceId.value,
  (id) => {
    if (id) {
      expandedWorkspaces.value = new Set([...expandedWorkspaces.value, id]);
    }
  },
  { immediate: true }
);

// Auto-expand all when searching
watch(
  () => normalizedQuery.value,
  (query) => {
    if (query) {
      expandedWorkspaces.value = new Set(workspaceList.value.map((w) => w.id));
    }
  }
);

defineExpose({
  handleCreateSession,
  handleSelectWorkspace,
  handleAddWorkspace,
  openWorkspaceDialog,
  handleResumeSession,
  handleDeleteSession,
  handleDisconnect,
  handleToggleSessionPin,
  handleDeleteWorkspace,
  handleRefreshWorkspace,
  syncSelectionFromCurrentSession,
  savedSessionCount,
  currentSessionId,
  previewSessionId,
  activeWorkspaceId,
  selectedAgent,
  selectedCwd,
  isConnected,
  isConnecting,
  currentSessionInActiveWorkspace,
});
</script>

<template>
  <aside v-if="show" class="chat-session-panel">
    <div class="chat-session-panel__top">
      <button
        class="chat-session-panel__btn ued-icon-btn ued-icon-btn--ghost"
        :disabled="isConnecting"
        :title="t('workspace.add')"
        :aria-label="t('workspace.add')"
        @click="handleAddWorkspace"
      >
        <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M3 6.2a1.4 1.4 0 0 1 1.4-1.4h3l1.2 1.4h5a1.4 1.4 0 0 1 1.4 1.4v5a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 12.6V6.2Z" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round" />
          <path d="M9 8.1v3.8M7.1 10h3.8" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" />
        </svg>
      </button>
      <button
        class="chat-session-panel__btn ued-icon-btn ued-icon-btn--ghost"
        :disabled="isConnecting"
        :title="t('app.newSession')"
        :aria-label="t('app.newSession')"
        @click="openWorkspaceDialog"
      >
        +
      </button>
    </div>

    <div class="chat-session-panel__search">
      <input
        v-model="sessionSearchQuery"
        type="text"
        class="session-search"
        :placeholder="t('app.searchSessions')"
      />
    </div>

    <div class="chat-session-panel__tree">
      <div v-if="workspaceList.length === 0" class="csp-empty">
        <p>{{ sessionSearchQuery ? t('session.noMatching') : t('session.noneSaved') }}</p>
        <p class="csp-empty-hint">{{ sessionSearchQuery ? t('session.tryAnotherKeyword') : t('session.createHint') }}</p>
      </div>

      <div v-else class="csp-workspace-list">
        <section
          v-for="workspace in workspaceList"
          :key="workspace.id"
          class="csp-workspace"
        >
          <button
            class="csp-workspace-row"
            :class="{ active: activeWorkspaceId === workspace.id, open: isWorkspaceOpen(workspace.id) }"
            type="button"
            @click="toggleWorkspace(workspace.id)"
          >
            <span
              class="csp-chevron"
              :class="{ open: isWorkspaceOpen(workspace.id) }"
            />
            <span class="csp-workspace-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                <path d="M1.5 4a1 1 0 0 1 1-1h2.5l1 1h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1V4z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
              </svg>
            </span>
            <span class="csp-workspace-label">
              <strong>{{ workspace.name }}</strong>
              <small>{{ workspace.cwd }}</small>
            </span>
            <span class="csp-workspace-count">{{ workspace.sessions.length }}</span>
            <button
              class="csp-workspace-delete ued-icon-btn ued-icon-btn--ghost ued-icon-btn--danger"
              :title="t('workspace.remove')"
              @click.stop="(event) => handleRemoveWorkspaceClick(workspace.id, event)"
            >
              ×
            </button>
          </button>

          <div v-if="isWorkspaceOpen(workspace.id)" class="csp-workspace-sessions">
            <div
              v-for="session in workspace.sessions"
              :key="session.id"
              class="csp-session-row"
              :class="{
                active: isSelectedSession(session.id),
                external: session.external,
                busy: isPendingSession(session.id) || isDeletingSession(session.id)
              }"
              :title="getSessionSummary(session)"
              role="button"
              tabindex="0"
              @click="handleSessionClick(session)"
              @keydown.enter.prevent="handleSessionClick(session)"
            >
              <AgentAvatar :name="session.agentName" :size="14" class="csp-session-avatar" />
              <span
                v-if="currentSessionId === session.id || isConnectedSession(session.id)"
                class="csp-session-dot"
                :class="{ active: currentSessionId === session.id }"
              />
              <span class="csp-session-label">
                <strong>{{ session.title }}</strong>
                <small v-if="session.external">{{ t('session.externalScanned') }}</small>
              </span>

              <div class="csp-session-actions">
                <template v-if="!session.external">
                  <button
                    class="csp-action-btn ued-icon-btn ued-icon-btn--ghost connect-toggle"
                    :class="{ disconnect: isConnectedSession(session.id), busy: isPendingSession(session.id) }"
                    :disabled="isPendingSession(session.id) || isDeletingSession(session.id)"
                    :title="getConnectActionLabel(session)"
                    @click="(event) => handleConnectAction(session, event)"
                  >
                    <svg class="csp-connect-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M6 5L4.2 3.2a2.4 2.4 0 0 0-3.4 3.4L2.6 8.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M10 11l1.8 1.8a2.4 2.4 0 0 0 3.4-3.4L13.4 7.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M5 11l6-6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                    </svg>
                  </button>
                  <button
                    class="csp-action-btn ued-icon-btn ued-icon-btn--ghost"
                    :class="{ pinned: isPinned(session.id) }"
                    :disabled="isPendingSession(session.id) || isDeletingSession(session.id)"
                    :title="isPinned(session.id) ? t('session.unpin') : t('session.pin')"
                    @click="(event) => handleTogglePin(session.id, event)"
                  >
                    ★
                  </button>
                </template>
                <button
                  class="csp-action-btn ued-icon-btn ued-icon-btn--ghost ued-icon-btn--danger"
                  :disabled="isPendingSession(session.id) || isDeletingSession(session.id)"
                  :title="isDeletingSession(session.id) ? t('session.deleting') : t('session.delete')"
                  @click="(event) => handleDelete(session.id, event)"
                >
                  {{ isDeletingSession(session.id) ? '...' : '×' }}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <AppConfirmDialog
      :model-value="showDeleteConfirm"
      :title="t('session.delete')"
      :message="t('session.confirmDelete')"
      :confirm-label="t('session.delete')"
      :cancel-label="t('common.cancel')"
      tone="danger"
      @update:modelValue="(value) => { if (!value) cancelDelete(); }"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <AppConfirmDialog
      :model-value="showWorkspaceDeleteConfirm"
      :title="t('workspace.remove')"
      :message="t('workspace.confirmRemove', { name: workspaces.find((w) => w.id === pendingDeleteWorkspaceId)?.name || '' })"
      :confirm-label="t('workspace.remove')"
      :cancel-label="t('common.cancel')"
      tone="danger"
      @update:modelValue="(value) => { if (!value) cancelDeleteWorkspace(); }"
      @confirm="confirmDeleteWorkspace"
      @cancel="cancelDeleteWorkspace"
    />
  </aside>
</template>

<style scoped>
.chat-session-panel {
  width: 300px;
  min-width: 300px;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.65rem 0.55rem;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--ued-border-default);
}

.chat-session-panel__top {
  display: flex;
  gap: 0.35rem;
  align-items: center;
  justify-content: flex-end;
}

.chat-session-panel__btn {
  width: 28px;
  height: 28px;
  color: var(--ued-text-secondary);
  font-size: 1.05rem;
  font-weight: 500;
}

.chat-session-panel__btn svg {
  width: 17px;
  height: 17px;
}

.chat-session-panel__search {
  padding: 0.1rem 0.15rem 0;
}

.session-search {
  width: 100%;
  min-height: 30px;
  border-radius: 6px;
  border: 1px solid var(--ued-border-default);
  background: rgba(255, 255, 255, 0.42);
  color: var(--ued-text-primary);
  padding: 0 0.65rem;
  font-size: 0.8rem;
}

.session-search:focus {
  outline: none;
  border-color: var(--ued-accent);
  box-shadow: var(--ued-shadow-focus);
}

.chat-session-panel__tree {
  flex: 1;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.csp-empty {
  padding: 0.5rem;
  color: var(--ued-text-muted);
  font-size: 0.78rem;
  text-align: center;
}

.csp-empty-hint {
  margin-top: 0.3rem;
  font-size: 0.72rem;
}

.csp-workspace-list {
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
}

.csp-workspace {
  min-width: 0;
}

.csp-workspace-row {
  width: 100%;
  min-height: 32px;
  display: flex;
  align-items: center;
  gap: 0.38rem;
  padding: 0.2rem 0.34rem 0.2rem 0.28rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--ued-text-secondary);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  font-size: 0.82rem;
  font-weight: 600;
}

.csp-workspace-row:hover,
.csp-workspace-row.active,
.csp-workspace-row.open {
  background: rgba(255, 255, 255, 0.52);
  color: var(--ued-text-primary);
}

.csp-chevron {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  position: relative;
}

.csp-chevron::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 2px;
  width: 5px;
  height: 5px;
  border-right: 1.4px solid currentColor;
  border-bottom: 1.4px solid currentColor;
  transform: rotate(-45deg);
  transition: transform 0.14s ease;
}

.csp-chevron.open::before {
  transform: rotate(45deg);
}

.csp-workspace-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--ued-text-muted);
  display: grid;
  place-items: center;
}

.csp-workspace-label {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0;
}

.csp-workspace-label strong,
.csp-workspace-label small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csp-workspace-label strong {
  font-size: 0.8rem;
  font-weight: 600;
}

.csp-workspace-label small {
  color: var(--ued-text-muted);
  font-size: 0.66rem;
  font-weight: 400;
}

.csp-workspace-count {
  flex-shrink: 0;
  min-width: 1.1rem;
  color: var(--ued-text-muted);
  font-size: 0.7rem;
  text-align: right;
}

.csp-workspace-delete {
  width: 20px;
  height: 20px;
  font-size: 0.85rem;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.csp-workspace-row:hover .csp-workspace-delete,
.csp-workspace-row.active .csp-workspace-delete {
  opacity: 1;
  pointer-events: auto;
}

.csp-workspace-sessions {
  display: flex;
  flex-direction: column;
  gap: 0.02rem;
  padding-left: 0.3rem;
}

.csp-session-row {
  position: relative;
  width: 100%;
  min-height: 30px;
  display: flex;
  align-items: center;
  gap: 0.38rem;
  padding: 0.14rem 0.28rem 0.14rem 0.4rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--ued-text-secondary);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  margin: 0.2rem 0;
}

.csp-session-row:hover,
.csp-session-row.active {
  background: rgba(255, 255, 255, 0.52);
  color: var(--ued-text-primary);
}

.csp-session-row.external {
  cursor: default;
}

.csp-session-avatar {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.csp-session-dot {
  position: absolute;
  left: 1.4rem;
  bottom: 0.22rem;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--ued-success);
  box-shadow: 0 0 0 2px var(--bg-sidebar, #f2ede3);
}

.csp-session-dot.active {
  background: var(--ued-accent);
}

.csp-session-label {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0;
}

.csp-session-label strong,
.csp-session-label small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.78rem;
  font-weight: 500;
}

.csp-session-label small {
  color: var(--ued-text-muted);
  font-size: 0.66rem;
}

.csp-session-actions {
  display: flex;
  align-items: center;
  gap: 0.1rem;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.csp-session-row:hover .csp-session-actions,
.csp-session-row.active .csp-session-actions {
  opacity: 1;
  pointer-events: auto;
}

.csp-action-btn {
  width: 20px;
  height: 20px;
  font-size: 0.72rem;
  display: grid;
  place-items: center;
}

.csp-action-btn.pinned {
  color: var(--ued-warning);
}

.csp-action-btn.connect-toggle {
  color: var(--ued-accent);
}

.csp-action-btn.connect-toggle.disconnect {
  color: var(--ued-danger);
}

.csp-connect-icon {
  width: 13px;
  height: 13px;
}

@media (max-width: 900px) {
  .csp-session-actions {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
