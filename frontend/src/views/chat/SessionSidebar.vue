<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useConfigStore } from '../../stores/config';
import { useSessionStore } from '../../stores/session';
import { useI18n } from '../../lib/i18n';
import { loadStore, saveStore, selectDirectory } from '../../lib/wails';
import AppSidebar from '../../components/AppSidebar.vue';

const configStore = useConfigStore();
const sessionStore = useSessionStore();
const { t } = useI18n();

const props = defineProps({
  showSidebar: { type: Boolean, required: true },
  activeRoute: { type: String, required: true },
  isSelectingFolder: { type: Boolean, required: true },
  proxyEnabled: { type: Boolean, required: true },
  httpProxy: { type: String, required: true },
  httpsProxy: { type: String, required: true },
  allProxy: { type: String, required: true },
  noProxy: { type: String, required: true },
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
  'syncSelectionFromCurrentSession',
  'navigateRoute',
]);

const selectedAgent = ref('');
const selectedCwd = ref('');
const activeWorkspaceId = ref('');
const sessionSearchQuery = ref('');
const previewSessionId = ref('');
const pinnedSessionIds = ref([]);
const pendingResumeSessionIds = ref([]);
const pendingDisconnectSessionIds = ref([]);
const pendingDeleteSessionIds = ref([]);
const refreshingWorkspaceIds = ref([]);

let prefsStoreData = {};
const prefsStoreName = 'preferences.json';
let preferencesLoaded = false;

const isConnected = computed(() => sessionStore.isConnected);
const isConnecting = computed(() => sessionStore.isConnecting);
const hasAgents = computed(() => configStore.hasAgents);
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
  if (!sessionStore.currentSession) {
    return false;
  }
  if (!activeWorkspaceId.value) {
    return true;
  }
  return sessionStore.currentSession.workspaceId === activeWorkspaceId.value;
});

const agentNames = computed(() => configStore.agentNames);

function readStoredString(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (value == null) {
    return '';
  }
  return String(value);
}

function readStoredBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value == null) {
    return fallback;
  }
  return Boolean(value);
}

async function persistPreferences() {
  await saveStore(prefsStoreName, prefsStoreData);
}

function addPending(target, sessionId) {
  if (!sessionId || target.value.includes(sessionId)) {
    return false;
  }
  target.value = [...target.value, sessionId];
  return true;
}

function removePending(target, sessionId) {
  target.value = target.value.filter((id) => id !== sessionId);
}

function syncSelectionFromCurrentSession() {
  const current = sessionStore.currentSession;
  if (!current) {
    return;
  }
  selectedAgent.value = current.agentName;
  selectedCwd.value = current.cwd;
  activeWorkspaceId.value = current.workspaceId || sessionStore.ensureWorkspaceForCwd(current.cwd).id;
  applyProxyConfig(current.proxy);
  emit('update:selectedAgent', selectedAgent.value);
  emit('update:selectedCwd', selectedCwd.value);
  emit('update:activeWorkspaceId', activeWorkspaceId.value);
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
    if (preferencesLoaded) {
      syncActiveWorkspaceFallback();
    }
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
  emit('update:selectedAgent', agentName);
}

async function handleSelectFolder() {
  if (props.isSelectingFolder) {
    return;
  }
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
    emit('update:selectedCwd', folder);
    emit('update:activeWorkspaceId', workspace.id);
  } finally {
    emit('update:isSelectingFolder', false);
  }
}

function openWorkspaceDialog() {
  if (!selectedCwd.value && activeWorkspaceId.value) {
    const workspace = workspaces.value.find((item) => item.id === activeWorkspaceId.value);
    if (workspace) {
      selectedCwd.value = workspace.cwd;
      emit('update:selectedCwd', workspace.cwd);
    }
  }
  emit('update:showWorkspaceDialog', true);
}

async function handleAddWorkspace() {
  if (props.isSelectingFolder || isConnecting.value) {
    return;
  }
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
  if (!workspace) {
    return;
  }
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
  emit('update:activeWorkspaceId', workspace.id);
  emit('update:selectedCwd', workspace.cwd);
}

function handleViewSession(sessionId) {
  previewSessionId.value = sessionId;
  emit('update:previewSessionId', sessionId);
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

async function handleRefreshWorkspace(workspaceId, agentName = selectedAgent.value) {
  const workspace = workspaceId ? workspaces.value.find((item) => item.id === workspaceId) : null;
  const refreshKey = workspace?.id || (agentName ? `agent:${agentName}` : 'agent:all');
  if (refreshingWorkspaceIds.value.includes(refreshKey)) {
    return;
  }

  const agentNames = agentName ? [agentName] : configStore.agentNames;
  if (agentNames.length === 0) {
    emit('notify', { message: t('agent.noneConfigured'), tone: 'info' });
    return;
  }

  addPending(refreshingWorkspaceIds, refreshKey);
  try {
    let sessions = [];
    if (workspace && typeof sessionStore.scanWorkspaceAgentSessions === 'function') {
      sessions = await sessionStore.scanWorkspaceAgentSessions(agentNames, workspace);
    } else {
      await sessionStore.scanConfiguredAgentSessions(agentNames);
      const agentNameSet = new Set(agentNames);
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
    emit('update:previewSessionId', currentSessionId.value);
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
    emit('update:previewSessionId', session.id);
    emit('update:selectedAgent', session.agentName);
    emit('update:selectedCwd', session.cwd);
    emit('update:activeWorkspaceId', activeWorkspaceId.value);
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
  emit('update:previewSessionId', sessionId);
  if (!session) {
    return;
  }
  selectedAgent.value = session.agentName;
  selectedCwd.value = session.cwd;
  activeWorkspaceId.value = session.workspaceId || sessionStore.ensureWorkspaceForCwd(session.cwd).id;
  applyProxyConfig(session.proxy);
  emit('update:selectedAgent', session.agentName);
  emit('update:selectedCwd', session.cwd);
  emit('update:activeWorkspaceId', activeWorkspaceId.value);
}

async function handleDeleteSession(sessionId) {
  if (
    pendingDeleteSessionIds.value.includes(sessionId) ||
    pendingResumeSessionIds.value.includes(sessionId) ||
    pendingDisconnectSessionIds.value.includes(sessionId)
  ) {
    return;
  }
  const deletedSession = sessionStore.savedSessions.find((session) => session.id === sessionId);
  if (!deletedSession) {
    return;
  }
  addPending(pendingDeleteSessionIds, sessionId);
  try {
    await sessionStore.deleteSession(sessionId);
    if (pinnedSessionIds.value.includes(sessionId)) {
      pinnedSessionIds.value = pinnedSessionIds.value.filter((id) => id !== sessionId);
      prefsStoreData.pinnedSessionIds = pinnedSessionIds.value;
      await persistPreferences();
    }
    syncSelectionFromCurrentSession();
    if (deletedSession) {
      emit('notify', { message: `${t('session.delete')}: ${deletedSession.title}`, tone: 'success' });
    }
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
  if (!sessionStore.savedSessions.some((session) => session.id === sessionId)) {
    return;
  }
  if (pinnedSessionIds.value.includes(sessionId)) {
    pinnedSessionIds.value = pinnedSessionIds.value.filter((id) => id !== sessionId);
  } else {
    pinnedSessionIds.value = [...pinnedSessionIds.value, sessionId];
  }
  prefsStoreData.pinnedSessionIds = pinnedSessionIds.value;
  await persistPreferences();
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
    emit('update:selectedCwd', savedCwd);
  }
  activeWorkspaceId.value = readStoredString(prefsStoreData.activeWorkspaceId);
  emit('update:activeWorkspaceId', activeWorkspaceId.value);
  syncActiveWorkspaceFallback();

  preferencesLoaded = true;
});

watch(
  () => configStore.agentNames.join('\n'),
  async () => {
    if (!preferencesLoaded) {
      return;
    }
    await refreshScannedSessions();
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
  <AppSidebar
    :content-visible="showSidebar"
    :is-connecting="isConnecting"
    :is-connected="isConnected && currentSessionInActiveWorkspace"
    :saved-session-count="savedSessionCount"
    :selected-agent="selectedAgent"
    :selected-cwd-display="selectedCwd ? `${selectedCwd.split(/[\\/]/).slice(-2).join('/')}` : '.'"
    :active-route="activeRoute"
    :agent-names="agentNames"
    :workspaces="workspaces"
    :active-workspace-id="activeWorkspaceId"
    :session-search-query="sessionSearchQuery"
    :pinned-session-ids="pinnedSessionIds"
    :active-session-id="currentSessionId"
    :preview-session-id="previewSessionId"
    :connected-session-ids="connectedSessionIds"
    :pending-session-ids="pendingSessionIds"
    :deleting-session-ids="pendingDeleteSessionIds"
    :refreshing-workspace-ids="refreshingWorkspaceIds"
    @open-workspace="openWorkspaceDialog"
    @add-workspace="handleAddWorkspace"
    @select-agent="handleAgentSelect"
    @refresh-workspace="handleRefreshWorkspace"
    @select-workspace="handleSelectWorkspace"
    @delete-workspace="handleDeleteWorkspace"
    @update:query="sessionSearchQuery = $event"
    @resume="handleResumeSession"
    @activate="handleActivateSession"
    @disconnect="handleDisconnect"
    @delete="handleDeleteSession"
    @toggle-pin="handleToggleSessionPin"
    @view-session="handleViewSession"
    @navigate-route="(route) => emit('navigateRoute', route)"
    @open-settings="emit('navigateRoute', 'settings')"
    @open-add-agent="emit('navigateRoute', 'agents')"
  />
</template>
