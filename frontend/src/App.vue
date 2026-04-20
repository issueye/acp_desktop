<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useConfigStore } from './stores/config';
import { useSessionStore } from './stores/session';
import { initTelemetry } from './lib/telemetry';
import { loadStore, saveStore, selectDirectory, windowClose, windowMinimise, windowToggleMaximise } from './lib/wails';
import { useI18n } from './lib/i18n';
import ChatView from './components/ChatView.vue';
import PermissionDialog from './components/PermissionDialog.vue';
import SettingsView from './components/SettingsView.vue';
import AuthMethodDialog from './components/AuthMethodDialog.vue';
import TrafficMonitor from './components/TrafficMonitor.vue';
import ProcessManagerDialog from './components/ProcessManagerDialog.vue';
import AppFloatingPanel from './components/AppFloatingPanel.vue';
import AppHeaderBar from './components/AppHeaderBar.vue';
import AppSidebar from './components/AppSidebar.vue';
import WelcomePanel from './components/WelcomePanel.vue';
import WorkspaceSessionDialog from './components/WorkspaceSessionDialog.vue';
import AppToastStack from './components/AppToastStack.vue';

const configStore = useConfigStore();
const sessionStore = useSessionStore();
const { locale, t, toggleLocale } = useI18n();

const selectedAgent = ref('');
const selectedCwd = ref('');
const showSidebar = ref(true);
const showSettings = ref(false);
const showWorkspaceDialog = ref(false);
const showTrafficMonitor = ref(false);
const showProcessManager = ref(false);
const showStartupDetails = ref(false);
const sessionSearchQuery = ref('');
const pinnedSessionIds = ref([]);
const openSettingsInAddMode = ref(false);
const proxyEnabled = ref(false);
const httpProxy = ref('');
const httpsProxy = ref('');
const allProxy = ref('');
const noProxy = ref('');
const toastItems = ref([]);
const pendingResumeSessionIds = ref([]);
const pendingDisconnectSessionIds = ref([]);
const pendingDeleteSessionIds = ref([]);
const isSelectingFolder = ref(false);

let prefsStoreData = {};
const prefsStoreName = 'preferences.json';

const isConnected = computed(() => sessionStore.isConnected);
const isConnecting = computed(() => sessionStore.isConnecting);
const error = computed(() => sessionStore.error || configStore.error);
const hasAgents = computed(() => configStore.hasAgents);
const savedSessionCount = computed(() => sessionStore.resumableSessions.length);
const connectedSessionIds = computed(() => sessionStore.connectedSessionIds);
const pendingSessionIds = computed(() => [
  ...new Set([
    ...pendingResumeSessionIds.value,
    ...pendingDisconnectSessionIds.value,
    ...pendingDeleteSessionIds.value,
  ]),
]);
const currentSessionId = computed(() => sessionStore.currentSession?.id ?? '');
const currentSessionTitle = computed(
  () => sessionStore.currentSession?.title || t('chat.titleFallback')
);
const pendingPermission = computed(() => sessionStore.pendingPermission);
const pendingAuthMethods = computed(() => sessionStore.pendingAuthMethods);
const pendingAuthAgentName = computed(() => sessionStore.pendingAuthAgentName);
const selectedCwdCompact = computed(() =>
  selectedCwd.value ? formatCompactPath(selectedCwd.value) : '.'
);
const selectedCwdLabel = computed(() => {
  if (!selectedCwd.value) return '.';
  const normalized = selectedCwd.value.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : '.';
});
const activeStatusLabel = computed(() => {
  if (isConnecting.value) return t('app.statusConnecting');
  if (isConnected.value) return t('app.statusConnected');
  return t('app.statusIdle');
});

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

function pushToast(message, tone = 'success') {
  const id = crypto.randomUUID();
  toastItems.value = [...toastItems.value, { id, message, tone }];
  window.setTimeout(() => {
    dismissToast(id);
  }, tone === 'danger' ? 4200 : 2600);
}

function dismissToast(id) {
  toastItems.value = toastItems.value.filter((item) => item.id !== id);
}

function getErrorMessage(errorLike) {
  return errorLike instanceof Error ? errorLike.message : String(errorLike);
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
  applyProxyConfig(current.proxy);
}

onMounted(async () => {
  prefsStoreData = await loadStore(prefsStoreName);
  pinnedSessionIds.value = Array.isArray(prefsStoreData.pinnedSessionIds)
    ? (prefsStoreData.pinnedSessionIds)
    : [];
  proxyEnabled.value = readStoredBoolean(prefsStoreData.proxyEnabled, false);
  httpProxy.value = readStoredString(prefsStoreData.httpProxy);
  httpsProxy.value = readStoredString(prefsStoreData.httpsProxy);
  allProxy.value = readStoredString(prefsStoreData.allProxy);
  noProxy.value = readStoredString(prefsStoreData.noProxy);

  const telemetryEnabled = readStoredBoolean(prefsStoreData.telemetryEnabled, true);
  await initTelemetry(telemetryEnabled);

  await configStore.loadConfig();
  await configStore.setupHotReload();
  await sessionStore.initStore();

  const savedCwd = readStoredString(prefsStoreData.lastCwd);
  if (savedCwd) selectedCwd.value = savedCwd;

  window.addEventListener('keydown', handleGlobalKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});

async function handleAgentSelect(agentName) {
  selectedAgent.value = agentName;
}

async function handleSelectFolder() {
  if (isSelectingFolder.value) {
    return;
  }
  isSelectingFolder.value = true;
  try {
    const folder = await selectDirectory();
    if (!folder) return;
    selectedCwd.value = folder;
    prefsStoreData.lastCwd = folder;
    await persistPreferences();
  } finally {
    isSelectingFolder.value = false;
  }
}

function openWorkspaceDialog() {
  showWorkspaceDialog.value = true;
}

function closeWorkspaceDialog() {
  if (isConnecting.value) return;
  showWorkspaceDialog.value = false;
  showStartupDetails.value = false;
}

function buildSessionProxyConfig() {
  return {
    enabled: proxyEnabled.value,
    httpProxy: httpProxy.value.trim() || undefined,
    httpsProxy: httpsProxy.value.trim() || undefined,
    allProxy: allProxy.value.trim() || undefined,
    noProxy: noProxy.value.trim() || undefined,
  };
}

function applyProxyConfig(proxy) {
  proxyEnabled.value = !!proxy?.enabled;
  httpProxy.value = readStoredString(proxy?.httpProxy);
  httpsProxy.value = readStoredString(proxy?.httpsProxy);
  allProxy.value = readStoredString(proxy?.allProxy);
  noProxy.value = readStoredString(proxy?.noProxy);
}

async function persistProxyPreferences() {
  prefsStoreData.proxyEnabled = proxyEnabled.value;
  prefsStoreData.httpProxy = httpProxy.value;
  prefsStoreData.httpsProxy = httpsProxy.value;
  prefsStoreData.allProxy = allProxy.value;
  prefsStoreData.noProxy = noProxy.value;
  await persistPreferences();
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
    showWorkspaceDialog.value = false;
    showStartupDetails.value = false;
    pushToast(`${t('app.newSession')}: ${selectedAgent.value}`);
  } catch (e) {
    console.error('Failed to create session:', e);
    pushToast(getErrorMessage(e), 'danger');
  }
}

async function handleResumeSession(session) {
  if (
    pendingResumeSessionIds.value.includes(session.id) ||
    pendingDisconnectSessionIds.value.includes(session.id) ||
    pendingDeleteSessionIds.value.includes(session.id)
  ) {
    return;
  }
  selectedAgent.value = session.agentName;
  selectedCwd.value = session.cwd;
  applyProxyConfig(session.proxy);
  prefsStoreData.lastCwd = session.cwd;
  await persistProxyPreferences();
  addPending(pendingResumeSessionIds, session.id);
  try {
    await sessionStore.resumeSession(session);
    pushToast(`${t('session.connect')}: ${session.title}`);
  } catch (e) {
    console.error('Failed to resume session:', e);
    pushToast(getErrorMessage(e), 'danger');
  } finally {
    removePending(pendingResumeSessionIds, session.id);
  }
}

function handleActivateSession(sessionId) {
  const session = sessionStore.savedSessions.find((item) => item.id === sessionId);
  sessionStore.setActiveSession(sessionId);
  if (!session) {
    return;
  }
  selectedAgent.value = session.agentName;
  selectedCwd.value = session.cwd;
  applyProxyConfig(session.proxy);
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
      pushToast(`${t('session.delete')}: ${deletedSession.title}`);
    }
  } catch (e) {
    pushToast(getErrorMessage(e), 'danger');
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
      pushToast(`${t('session.disconnect')}: ${disconnectingSession.title}`, 'info');
    }
  } catch (e) {
    pushToast(getErrorMessage(e), 'danger');
  } finally {
    removePending(pendingDisconnectSessionIds, targetSessionId);
  }
}

async function handleCancelConnection() {
  await sessionStore.cancelConnection();
}

function handlePermissionSelect(optionId) {
  sessionStore.resolvePermission(optionId);
}

function handlePermissionCancel() {
  sessionStore.cancelPermission();
}

function handleAuthMethodSelect(methodId) {
  sessionStore.selectAuthMethod(methodId);
}

function handleAuthMethodCancel() {
  sessionStore.cancelAuthSelection();
}

function toggleSidebar() {
  showSidebar.value = !showSidebar.value;
}

async function handleToggleSessionPin(sessionId) {
  if (pinnedSessionIds.value.includes(sessionId)) {
    pinnedSessionIds.value = pinnedSessionIds.value.filter((id) => id !== sessionId);
  } else {
    pinnedSessionIds.value = [...pinnedSessionIds.value, sessionId];
  }
  prefsStoreData.pinnedSessionIds = pinnedSessionIds.value;
  await persistPreferences();
}

function clearError() {
  sessionStore.clearError();
  configStore.clearError();
}

function formatCompactPath(path) {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return '.';
  if (parts.length === 1) return parts[0];
  return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
}

function openSettings(startInAddMode = false) {
  openSettingsInAddMode.value = startInAddMode;
  showSettings.value = true;
}

function closeSettings() {
  showSettings.value = false;
  openSettingsInAddMode.value = false;
}

function handleOpenAddAgent() {
  showWorkspaceDialog.value = false;
  openSettings(true);
}

function handleHeaderDoubleClick() {
  windowToggleMaximise();
}

function handleGlobalKeydown(event) {
  if (event.key !== 'Escape') return;
  if (showWorkspaceDialog.value && !isConnecting.value) {
    closeWorkspaceDialog();
    return;
  }
  if (showSettings.value) {
    closeSettings();
    return;
  }
  if (showProcessManager.value) {
    showProcessManager.value = false;
    return;
  }
  if (showTrafficMonitor.value) {
    showTrafficMonitor.value = false;
  }
}
</script>

<template>
  <div class="app-shell">
    <div class="window-frame">
      <AppHeaderBar
        :locale="locale"
        :current-session-title="currentSessionTitle"
        :active-status-label="activeStatusLabel"
        :cwd-label="selectedCwd ? selectedCwdCompact : ''"
        :traffic-monitor-open="showTrafficMonitor"
        :process-manager-open="showProcessManager"
        :is-live="isConnected || isConnecting"
        @toggle-traffic="showTrafficMonitor = !showTrafficMonitor"
        @toggle-process-manager="showProcessManager = !showProcessManager"
        @toggle-locale="toggleLocale"
        @open-settings="openSettings()"
        @minimise="windowMinimise"
        @close="windowClose"
        @header-dblclick="handleHeaderDoubleClick"
      />

      <div class="window-body">
        <AppSidebar
          v-if="showSidebar"
          :is-connecting="isConnecting"
          :is-connected="isConnected"
          :is-disconnecting-current="pendingDisconnectSessionIds.includes(currentSessionId)"
          :saved-session-count="savedSessionCount"
          :selected-agent="selectedAgent"
          :selected-cwd-display="selectedCwdCompact"
          :session-search-query="sessionSearchQuery"
          :pinned-session-ids="pinnedSessionIds"
          :active-session-id="currentSessionId"
          :connected-session-ids="connectedSessionIds"
          :pending-session-ids="pendingSessionIds"
          :deleting-session-ids="pendingDeleteSessionIds"
          @open-workspace="openWorkspaceDialog"
          @update:query="sessionSearchQuery = $event"
          @resume="handleResumeSession"
          @activate="handleActivateSession"
          @disconnect="handleDisconnect"
          @delete="handleDeleteSession"
          @toggle-pin="handleToggleSessionPin"
          @open-settings="openSettings()"
        />

        <div class="content-stage">
          <main class="main-content">
            <div v-if="error" class="error-banner">
              <span class="error-icon">!</span>
              <span class="error-text">{{ error }}</span>
              <button class="error-close ued-icon-btn ued-icon-btn--ghost ued-icon-btn--danger" @click="clearError">×</button>
            </div>

            <ChatView v-if="isConnected" />

            <WelcomePanel
              v-else
              :has-agents="hasAgents"
              :selected-agent-label="hasAgents ? selectedAgent || configStore.agentNames[0] : '0'"
              :workspace-label="selectedCwd ? selectedCwdLabel : '.'"
              :saved-session-count="savedSessionCount"
              :is-connecting="isConnecting"
              @open-workspace="openWorkspaceDialog"
              @open-add-agent="openSettings(true)"
            />
          </main>
        </div>

        <button
          class="floating-sidebar-toggle no-drag"
          :class="{ 'is-open': showSidebar }"
          :style="{
            left: showSidebar ? 'var(--app-sidebar-width)' : '12px',
            transform: showSidebar ? 'translate(-50%, -50%)' : 'translateY(-50%)',
          }"
          :title="showSidebar ? t('app.collapseSidebar') : t('app.expandSidebar')"
          :aria-label="showSidebar ? t('app.collapseSidebar') : t('app.expandSidebar')"
          @click="toggleSidebar"
        >
          <svg
            class="floating-sidebar-toggle__icon"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              v-if="showSidebar"
              d="M14.5 6.5L9 12L14.5 17.5"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              v-else
              d="M9.5 6.5L15 12L9.5 17.5"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span v-if="!showSidebar && savedSessionCount > 0" class="floating-sidebar-toggle__badge">
            {{ savedSessionCount }}
          </span>
        </button>
      </div>
    </div>

    <AppFloatingPanel
      :model-value="showTrafficMonitor"
      width="min(960px, calc(100vw - 332px))"
      max-width="calc(100vw - 20px)"
      bottom="16px"
      right="16px"
    >
      <TrafficMonitor @close="showTrafficMonitor = false" />
    </AppFloatingPanel>

    <ProcessManagerDialog
      v-model="showProcessManager"
      @notify="pushToast($event.message, $event.tone)"
    />

    <WorkspaceSessionDialog
      v-model="showWorkspaceDialog"
      :has-agents="hasAgents"
      :is-connecting="isConnecting"
      :selected-agent="selectedAgent"
      :selected-cwd="selectedCwd"
      :selected-cwd-label="selectedCwdLabel"
      :proxy-enabled="proxyEnabled"
      :http-proxy="httpProxy"
      :https-proxy="httpsProxy"
      :all-proxy="allProxy"
      :no-proxy="noProxy"
      :startup-phase="sessionStore.startupPhase"
      :startup-logs="sessionStore.startupLogs"
      :startup-elapsed="sessionStore.startupElapsed"
      :show-startup-details="showStartupDetails"
      :is-selecting-folder="isSelectingFolder"
      @update:selectedAgent="handleAgentSelect"
      @update:proxyEnabled="proxyEnabled = $event"
      @update:httpProxy="httpProxy = $event"
      @update:httpsProxy="httpsProxy = $event"
      @update:allProxy="allProxy = $event"
      @update:noProxy="noProxy = $event"
      @update:showStartupDetails="showStartupDetails = $event"
      @select-folder="handleSelectFolder"
      @create-session="handleCreateSession"
      @open-add-agent="handleOpenAddAgent"
      @cancel-connection="handleCancelConnection"
    />

    <PermissionDialog
      v-if="pendingPermission"
      :request="pendingPermission"
      @select="handlePermissionSelect"
      @cancel="handlePermissionCancel"
    />

    <AuthMethodDialog
      v-if="pendingAuthMethods.length > 0"
      :auth-methods="pendingAuthMethods"
      :agent-name="pendingAuthAgentName"
      @select="handleAuthMethodSelect"
      @cancel="handleAuthMethodCancel"
    />

    <SettingsView
      v-if="showSettings"
      :start-in-add-mode="openSettingsInAddMode"
      @notify="pushToast($event.message, $event.tone)"
      @close="closeSettings"
    />

    <AppToastStack :items="toastItems" @dismiss="dismissToast" />
  </div>
</template>

<style>
:root {
  --app-sidebar-width: 280px;
  --bg-primary: var(--ued-accent);
  --bg-primary-hover: var(--ued-accent-hover);
  --bg-danger: var(--ued-danger);
  --bg-warning: var(--ued-warning-soft);
  --bg-main: var(--ued-bg-canvas);
  --bg-sidebar: linear-gradient(180deg, #f7f9fb 0%, #edf1f5 100%);
  --bg-header: color-mix(in srgb, var(--ued-bg-window) 94%, white);
  --bg-hover: var(--ued-accent-soft);
  --bg-user: color-mix(in srgb, var(--ued-accent) 8%, white);
  --bg-assistant: var(--ued-bg-panel);
  --bg-card: var(--ued-bg-panel);
  --bg-code: var(--ued-bg-panel-muted);
  --text-primary: var(--ued-text-primary);
  --text-secondary: var(--ued-text-secondary);
  --text-muted: var(--ued-text-muted);
  --text-accent: var(--ued-accent);
  --text-code: var(--ued-text-primary);
  --border-color: var(--ued-border-default);
  --shadow-sm: var(--ued-shadow-rest);
  --shadow-md: var(--ued-shadow-panel);
  --shadow-lg: var(--ued-shadow-dialog);
  --surface-blur: none;
  font-family: var(--ued-font-ui);
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #app { height: 100%; overflow: hidden; }
body {
  background: var(--bg-main);
  color: var(--text-primary);
  font-family: var(--ued-font-ui);
  font-size: var(--ued-text-body);
  line-height: var(--ued-line-body);
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-kerning: normal;
}
input, textarea, select, button { font: inherit; }
input, textarea, select { user-select: text; }
.drag-region { --wails-draggable: drag; }
.no-drag { --wails-draggable: no-drag; }
</style>

<style scoped>
.app-shell { height: 100vh; padding: 0; }
.window-frame { height: 100%; display: flex; flex-direction: column; overflow: hidden; border-radius: 0; background: var(--ued-bg-window); border: none; box-shadow: none; }
.window-body { position: relative; flex: 1; min-height: 0; display: flex; gap: 0; padding: 0; background: var(--ued-bg-window); }
.content-stage { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 0; background: var(--ued-bg-panel); }
.main-content { flex: 1; min-height: 0; overflow: hidden; background: linear-gradient(180deg, var(--ued-bg-panel) 0%, var(--ued-bg-window) 100%); }
.floating-sidebar-toggle {
  position: absolute;
  top: 50%;
  z-index: 9;
  width: 30px;
  height: 60px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--ued-border-default) 82%, white);
  border-radius: 999px;
  background: color-mix(in srgb, var(--ued-bg-panel) 88%, white);
  color: var(--ued-text-muted);
  box-shadow: 0 8px 24px rgba(19, 31, 52, 0.08);
  backdrop-filter: blur(10px);
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    color 0.16s ease,
    left 0.2s ease;
}

.floating-sidebar-toggle:hover {
  color: var(--ued-accent);
  border-color: color-mix(in srgb, var(--ued-accent) 26%, var(--ued-border-default));
  background: color-mix(in srgb, var(--ued-bg-panel) 94%, white);
  box-shadow: 0 10px 28px rgba(19, 31, 52, 0.12);
}

.floating-sidebar-toggle.is-open {
  background: color-mix(in srgb, var(--ued-bg-panel) 92%, white);
}

.floating-sidebar-toggle__icon {
  width: 16px;
  height: 16px;
  display: block;
}

.floating-sidebar-toggle__badge {
  position: absolute;
  right: -4px;
  bottom: -3px;
  min-width: 16px;
  height: 16px;
  padding: 0 0.24rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--ued-accent);
  color: var(--ued-text-on-accent);
  font-size: 0.64rem;
  font-weight: 700;
  box-shadow: 0 0 0 2px var(--ued-bg-window);
}

.error-banner {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .9rem 1rem;
  background: var(--ued-danger-soft);
  color: var(--ued-danger);
  border-bottom: 1px solid color-mix(in srgb, var(--ued-danger) 18%, var(--ued-border-default));
}
.error-icon { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; background: color-mix(in srgb, var(--ued-danger) 10%, transparent); font-weight: 700; }
.error-text { flex: 1; }
.error-close { color: inherit; font-size: 1.1rem; }
@media (max-width: 900px) {
  .app-shell { padding: 0; }
  .window-body { padding: 0; }
  .floating-sidebar-toggle {
    width: 28px;
    height: 54px;
  }
}
</style>
