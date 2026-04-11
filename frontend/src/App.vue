<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useConfigStore } from './stores/config';
import { useSessionStore } from './stores/session';
import { initTelemetry } from './lib/telemetry';
import {
  loadStore,
  saveStore,
  selectDirectory,
  windowClose,
  windowMinimise,
  windowToggleMaximise,
} from './lib/wails';
import { useI18n } from './lib/i18n';
import ChatView from './components/ChatView.vue';
import PermissionDialog from './components/PermissionDialog.vue';
import SettingsView from './components/SettingsView.vue';
import AuthMethodDialog from './components/AuthMethodDialog.vue';
import TrafficMonitor from './components/TrafficMonitor.vue';
import AppFloatingPanel from './components/AppFloatingPanel.vue';
import AppHeaderBar from './components/AppHeaderBar.vue';
import AppSidebar from './components/AppSidebar.vue';
import WelcomePanel from './components/WelcomePanel.vue';
import WorkspaceSessionDialog from './components/WorkspaceSessionDialog.vue';
import AppToastStack from './components/AppToastStack.vue';
import type { SavedSession, SessionProxyConfig } from './lib/types';
import type { AppToastItem } from './components/AppToastStack.vue';

const configStore = useConfigStore();
const sessionStore = useSessionStore();
const { locale, t, toggleLocale } = useI18n();

const selectedAgent = ref('');
const selectedCwd = ref('');
const showSidebar = ref(true);
const showSettings = ref(false);
const showWorkspaceDialog = ref(false);
const showTrafficMonitor = ref(false);
const showStartupDetails = ref(false);
const sessionSearchQuery = ref('');
const pinnedSessionIds = ref<string[]>([]);
const openSettingsInAddMode = ref(false);
const proxyEnabled = ref(false);
const httpProxy = ref('');
const httpsProxy = ref('');
const allProxy = ref('');
const noProxy = ref('');
const toastItems = ref<AppToastItem[]>([]);

let prefsStoreData: Record<string, unknown> = {};
const prefsStoreName = 'preferences.json';

const isConnected = computed(() => sessionStore.isConnected);
const isLoading = computed(() => sessionStore.isLoading);
const isConnecting = computed(() => sessionStore.isConnecting);
const error = computed(() => sessionStore.error || configStore.error);
const hasAgents = computed(() => configStore.hasAgents);
const savedSessionCount = computed(() => sessionStore.resumableSessions.length);
const connectedSessionIds = computed(() => sessionStore.connectedSessionIds);
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

async function persistPreferences() {
  await saveStore(prefsStoreName, prefsStoreData);
}

function pushToast(message: string, tone: AppToastItem['tone'] = 'success') {
  const id = crypto.randomUUID();
  toastItems.value = [...toastItems.value, { id, message, tone }];
  window.setTimeout(() => {
    dismissToast(id);
  }, tone === 'danger' ? 4200 : 2600);
}

function dismissToast(id: string) {
  toastItems.value = toastItems.value.filter((item) => item.id !== id);
}

function getErrorMessage(errorLike: unknown): string {
  return errorLike instanceof Error ? errorLike.message : String(errorLike);
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
    ? (prefsStoreData.pinnedSessionIds as string[])
    : [];
  proxyEnabled.value = (prefsStoreData.proxyEnabled as boolean | undefined) ?? false;
  httpProxy.value = (prefsStoreData.httpProxy as string | undefined) ?? '';
  httpsProxy.value = (prefsStoreData.httpsProxy as string | undefined) ?? '';
  allProxy.value = (prefsStoreData.allProxy as string | undefined) ?? '';
  noProxy.value = (prefsStoreData.noProxy as string | undefined) ?? '';

  const telemetryEnabled = (prefsStoreData.telemetryEnabled as boolean | undefined) ?? true;
  await initTelemetry(telemetryEnabled);

  await configStore.loadConfig();
  await configStore.setupHotReload();
  await sessionStore.initStore();

  const savedCwd = prefsStoreData.lastCwd as string | undefined;
  if (savedCwd) selectedCwd.value = savedCwd;

  window.addEventListener('keydown', handleGlobalKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});

async function handleAgentSelect(agentName: string) {
  selectedAgent.value = agentName;
}

async function handleSelectFolder() {
  const folder = await selectDirectory();
  if (!folder) return;
  selectedCwd.value = folder;
  prefsStoreData.lastCwd = folder;
  await persistPreferences();
}

function openWorkspaceDialog() {
  showWorkspaceDialog.value = true;
}

function closeWorkspaceDialog() {
  if (isConnecting.value) return;
  showWorkspaceDialog.value = false;
  showStartupDetails.value = false;
}

function buildSessionProxyConfig(): SessionProxyConfig {
  return {
    enabled: proxyEnabled.value,
    httpProxy: httpProxy.value.trim() || undefined,
    httpsProxy: httpsProxy.value.trim() || undefined,
    allProxy: allProxy.value.trim() || undefined,
    noProxy: noProxy.value.trim() || undefined,
  };
}

function applyProxyConfig(proxy?: SessionProxyConfig) {
  proxyEnabled.value = !!proxy?.enabled;
  httpProxy.value = proxy?.httpProxy ?? '';
  httpsProxy.value = proxy?.httpsProxy ?? '';
  allProxy.value = proxy?.allProxy ?? '';
  noProxy.value = proxy?.noProxy ?? '';
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

async function handleResumeSession(session: SavedSession) {
  selectedAgent.value = session.agentName;
  selectedCwd.value = session.cwd;
  applyProxyConfig(session.proxy);
  prefsStoreData.lastCwd = session.cwd;
  await persistProxyPreferences();
  try {
    await sessionStore.resumeSession(session);
    pushToast(`${t('session.connect')}: ${session.title}`);
  } catch (e) {
    console.error('Failed to resume session:', e);
    pushToast(getErrorMessage(e), 'danger');
  }
}

function handleActivateSession(sessionId: string) {
  const session = sessionStore.savedSessions.find((item) => item.id === sessionId);
  sessionStore.setActiveSession(sessionId);
  if (!session) {
    return;
  }
  selectedAgent.value = session.agentName;
  selectedCwd.value = session.cwd;
  applyProxyConfig(session.proxy);
}

async function handleDeleteSession(sessionId: string) {
  const deletedSession = sessionStore.savedSessions.find((session) => session.id === sessionId);
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
  }
}

async function handleDisconnect(sessionId?: string) {
  const disconnectingSession = sessionId
    ? sessionStore.savedSessions.find((session) => session.id === sessionId)
    : sessionStore.currentSession;
  try {
    await sessionStore.disconnect(sessionId);
    syncSelectionFromCurrentSession();
    if (disconnectingSession) {
      pushToast(`${t('session.disconnect')}: ${disconnectingSession.title}`, 'info');
    }
  } catch (e) {
    pushToast(getErrorMessage(e), 'danger');
  }
}

async function handleCancelConnection() {
  await sessionStore.cancelConnection();
}

function handlePermissionSelect(optionId: string) {
  sessionStore.resolvePermission(optionId);
}

function handlePermissionCancel() {
  sessionStore.cancelPermission();
}

function handleAuthMethodSelect(methodId: string) {
  sessionStore.selectAuthMethod(methodId);
}

function handleAuthMethodCancel() {
  sessionStore.cancelAuthSelection();
}

function toggleSidebar() {
  showSidebar.value = !showSidebar.value;
}

async function handleToggleSessionPin(sessionId: string) {
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

function formatCompactPath(path: string): string {
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

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  if (showWorkspaceDialog.value && !isConnecting.value) {
    closeWorkspaceDialog();
    return;
  }
  if (showSettings.value) {
    closeSettings();
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
        :show-sidebar="showSidebar"
        :locale="locale"
        :current-session-title="currentSessionTitle"
        :active-status-label="activeStatusLabel"
        :cwd-label="selectedCwd ? selectedCwdCompact : ''"
        :traffic-monitor-open="showTrafficMonitor"
        :is-live="isConnected || isConnecting"
        @toggle-sidebar="toggleSidebar"
        @toggle-traffic="showTrafficMonitor = !showTrafficMonitor"
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
          :saved-session-count="savedSessionCount"
          :selected-agent="selectedAgent"
          :selected-cwd-display="selectedCwdCompact"
          :session-search-query="sessionSearchQuery"
          :pinned-session-ids="pinnedSessionIds"
          :active-session-id="currentSessionId"
          :connected-session-ids="connectedSessionIds"
          @open-workspace="openWorkspaceDialog"
          @update:query="sessionSearchQuery = $event"
          @resume="handleResumeSession"
          @activate="handleActivateSession"
          @disconnect="handleDisconnect"
          @delete="handleDeleteSession"
          @toggle-pin="handleToggleSessionPin"
          @open-settings="openSettings()"
        />

        <button v-else class="sidebar-rail no-drag" :title="t('app.expandSidebar')" @click="toggleSidebar">
          <span>▶</span>
          <span>{{ savedSessionCount }}</span>
        </button>

        <div class="content-stage">
          <main class="main-content">
            <div v-if="error" class="error-banner">
              <span class="error-icon">!</span>
              <span class="error-text">{{ error }}</span>
              <button class="error-close" @click="clearError">×</button>
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

    <WorkspaceSessionDialog
      v-model="showWorkspaceDialog"
      :has-agents="hasAgents"
      :is-connecting="isConnecting"
      :is-loading="isLoading"
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
  --bg-primary: #2563eb;
  --bg-primary-hover: #1d4ed8;
  --bg-danger: #dc2626;
  --bg-warning: #fff4ce;
  --bg-main: #f6f4ef;
  --bg-sidebar: #f2ede3;
  --bg-header: rgba(248, 246, 240, 0.96);
  --bg-hover: rgba(37, 99, 235, 0.08);
  --bg-user: #eef4ff;
  --bg-assistant: #ffffff;
  --bg-card: #fffdfa;
  --bg-code: #f3f4f6;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #748091;
  --text-accent: #2563eb;
  --text-code: #1f2937;
  --border-color: rgba(15, 23, 42, 0.08);
  --shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.04);
  --shadow-md: 0 12px 30px rgba(15, 23, 42, 0.08);
  --shadow-lg: 0 20px 44px rgba(15, 23, 42, 0.12);
  --surface-blur: none;
  font-family: 'Segoe UI Variable Text', 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #app { height: 100%; overflow: hidden; }
body { background: var(--bg-main); color: var(--text-primary); }
input, textarea, select, button { font: inherit; }
input, textarea, select { user-select: text; }
.drag-region { --wails-draggable: drag; }
.no-drag { --wails-draggable: no-drag; }
</style>

<style scoped>
.app-shell { height: 100vh; padding: 0; }
.window-frame { height: 100%; display: flex; flex-direction: column; overflow: hidden; border-radius: 0; background: var(--bg-main); border: none; box-shadow: none; }
.window-body { flex: 1; min-height: 0; display: flex; gap: 0; padding: 0; background: var(--bg-main); }
.sidebar-rail { width: 54px; border-right: 1px solid rgba(15, 23, 42, 0.06); background: var(--bg-sidebar); color: var(--text-secondary); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .4rem; cursor: pointer; }
.content-stage { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 0; background: #ffffff; }
.main-content { flex: 1; min-height: 0; overflow: hidden; background: #ffffff; }
.error-banner { display: flex; align-items: center; gap: .75rem; padding: .9rem 1rem; background: rgba(220,38,38,.06); color: var(--bg-danger); border-bottom: 1px solid rgba(220,38,38,.12); }
.error-icon { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; background: rgba(220,38,38,.1); font-weight: 700; }
.error-text { flex: 1; }
.error-close { border: none; background: transparent; color: inherit; font-size: 1.1rem; cursor: pointer; }
@media (max-width: 900px) {
  .app-shell { padding: 0; }
  .window-body { padding: 0; }
}
</style>
