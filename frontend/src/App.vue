<script setup>
import SvgIcon from './components/common/SvgIcon.vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useConfigStore } from './stores/config';
import { useSessionStore } from './stores/session';
import { initTelemetry } from './lib/telemetry';
import { buildPermissionRequestKey, getAutoConfirmOptionId, normalizeAuthorizationMode } from './lib/authorization';
import { loadStore, saveStore, windowClose, windowMinimise, windowToggleMaximise } from './lib/wails';
import { useI18n } from './lib/i18n';
import ChatTabsView from './views/chat/ChatTabsView.vue';
import { useChatTabs } from './views/chat/useChatTabs';
import PermissionDialog from './views/auth/PermissionDialog.vue';
import SettingsView from './views/settings/SettingsView.vue';
import WorkspacesView from './views/workspace/WorkspacesView.vue';
import AuthMethodDialog from './views/auth/AuthMethodDialog.vue';
import TrafficMonitor from './views/traffic/TrafficMonitor.vue';
import ProcessManagerDialog from './views/processes/ProcessManagerDialog.vue';
import AppFloatingPanel from './components/AppFloatingPanel.vue';
import AppDialogShell from './components/AppDialogShell.vue';
import AppHeaderBar from './components/AppHeaderBar.vue';
import AppSidebar from './components/AppSidebar.vue';
import ChatSessionPanel from './views/chat/ChatSessionPanel.vue';
import GitCommitPanel from './views/chat/GitCommitPanel.vue';
import WorkspaceSessionDialog from './views/workspace/WorkspaceSessionDialog.vue';
import AppToastStack from './components/AppToastStack.vue';
import AppFooter from './components/AppFooter.vue';

const configStore = useConfigStore();
const sessionStore = useSessionStore();
const { locale, t, toggleLocale } = useI18n();

const showSidebar = ref(true);
const showWorkspaceDialog = ref(false);
const showTrafficMonitor = ref(false);
const showProcessManager = ref(false);
const showGitDialog = ref(false);
const showStartupDetails = ref(false);
const openSettingsInAddMode = ref(false);
const proxyEnabled = ref(false);
const httpProxy = ref('');
const httpsProxy = ref('');
const allProxy = ref('');
const noProxy = ref('');
const toastItems = ref([]);
const isSelectingFolder = ref(false);
const activeRoute = ref(normalizeRoute(window.location.hash));
const previewSessionId = ref('');
const selectedAgent = ref('');
const selectedCwd = ref('');
const gitDialogCwd = ref('');
const activeWorkspaceId = ref('');

let prefsStoreData = {};
const prefsStoreName = 'preferences.json';
let preferencesLoaded = false;
const autoConfirmedPermissionKeys = new Set();
let autoConfirmTimer = null;

const chatSessionPanelRef = ref(null);

const {
  activeChatTabId,
  activeTabSession,
  tabItems,
  openSessionTab,
  setActiveTab,
  closeChatTab,
} = useChatTabs({
  sessionStore,
  previewSessionId,
});

const isConnecting = computed(() => sessionStore.isConnecting);
const isConnected = computed(() => sessionStore.isConnected);
const error = computed(() => sessionStore.error || configStore.error);
const hasAgents = computed(() => configStore.hasAgents);
const savedSessionCount = computed(() => chatSessionPanelRef.value?.savedSessionCount ?? 0);
const currentSessionTitle = computed(() => {
  if (activeRoute.value !== 'chat') {
    return t('chat.titleFallback');
  }
  return activeTabSession.value?.title || sessionStore.currentSession?.title || t('chat.titleFallback');
});
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
  if (activeRoute.value === 'agents') return t('settings.agents');
  if (activeRoute.value === 'workspaces') return t('workspace.title');
  if (activeRoute.value === 'settings') return t('app.settings');
  if (isConnecting.value) return t('app.statusConnecting');
  if (isConnected.value) return t('app.statusConnected');
  return t('app.statusIdle');
});

function normalizeRoute(hash) {
  const route = String(hash || '').replace(/^#\/?/, '').split('?')[0] || 'chat';
  return ['chat', 'agents', 'workspaces', 'settings'].includes(route) ? route : 'chat';
}

function navigateRoute(route) {
  const nextRoute = normalizeRoute(route);
  activeRoute.value = nextRoute;
  const nextHash = `#/${nextRoute}`;
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  }
  if (nextRoute !== 'agents') {
    openSettingsInAddMode.value = false;
  }
}

function handleHashChange() {
  activeRoute.value = normalizeRoute(window.location.hash);
}

function readStoredString(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

function readStoredBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value == null) return fallback;
  return Boolean(value);
}

function clearAutoConfirmTimer() {
  if (autoConfirmTimer !== null) {
    window.clearTimeout(autoConfirmTimer);
    autoConfirmTimer = null;
  }
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

function handleSidebarNotify(event) {
  pushToast(event.message, event.tone);
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
  navigateRoute(startInAddMode ? 'agents' : 'settings');
}

function closeSettings() {
  navigateRoute('chat');
  openSettingsInAddMode.value = false;
}

function handleOpenAddAgent() {
  showWorkspaceDialog.value = false;
  openSettings(true);
}

function handleOpenGitDialog(cwd = '') {
  gitDialogCwd.value = cwd || sessionStore.currentSession?.cwd || selectedCwd.value || '';
  showGitDialog.value = true;
}

async function handleGitCommitted(result) {
  const currentSession = sessionStore.currentSession;
  if (!currentSession?.id || currentSession.external || currentSession.cwd !== gitDialogCwd.value) {
    return;
  }
  await sessionStore.recordSessionGitCommit(currentSession.id, result);
}

function handleHeaderDoubleClick() {
  windowToggleMaximise();
}

function handleGlobalKeydown(event) {
  if (event.key !== 'Escape') return;
  if (showWorkspaceDialog.value && !isConnecting.value) {
    showWorkspaceDialog.value = false;
    showStartupDetails.value = false;
    return;
  }
  if (activeRoute.value !== 'chat') {
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

onMounted(async () => {
  prefsStoreData = await loadStore(prefsStoreName);
  proxyEnabled.value = readStoredBoolean(prefsStoreData.proxyEnabled, false);
  httpProxy.value = readStoredString(prefsStoreData.httpProxy);
  httpsProxy.value = readStoredString(prefsStoreData.httpsProxy);
  allProxy.value = readStoredString(prefsStoreData.allProxy);
  noProxy.value = readStoredString(prefsStoreData.noProxy);
  sessionStore.setAuthorizationMode(normalizeAuthorizationMode(prefsStoreData.authorizationMode));

  const telemetryEnabled = readStoredBoolean(prefsStoreData.telemetryEnabled, true);
  await initTelemetry(telemetryEnabled);

  await configStore.loadConfig();
  await configStore.setupHotReload();
  await sessionStore.initStore();

  preferencesLoaded = true;
  if (!window.location.hash) {
    window.history.replaceState(null, '', '#/chat');
  }
  window.addEventListener('hashchange', handleHashChange);
  window.addEventListener('keydown', handleGlobalKeydown);
});

watch(
  () => sessionStore.authorizationMode,
  async (mode) => {
    if (!preferencesLoaded) return;
    prefsStoreData.authorizationMode = normalizeAuthorizationMode(mode);
    await persistPreferences();
  }
);

watch(
  [pendingPermission, () => sessionStore.authorizationMode],
  async ([request, mode]) => {
    clearAutoConfirmTimer();
    const optionId = getAutoConfirmOptionId(request, mode);
    if (!optionId) return;

    const requestKey = buildPermissionRequestKey(request);
    if (!requestKey || autoConfirmedPermissionKeys.has(requestKey)) return;

    autoConfirmedPermissionKeys.add(requestKey);
    await nextTick();
    autoConfirmTimer = window.setTimeout(() => {
      autoConfirmTimer = null;
      const currentRequest = sessionStore.pendingPermission;
      if (!currentRequest || buildPermissionRequestKey(currentRequest) !== requestKey) return;
      handlePermissionSelect(optionId);
    }, 180);
  }
);

onBeforeUnmount(() => {
  clearAutoConfirmTimer();
  window.removeEventListener('hashchange', handleHashChange);
  window.removeEventListener('keydown', handleGlobalKeydown);
});
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
        @open-settings="navigateRoute('settings')"
        @minimise="windowMinimise"
        @close="windowClose"
        @header-dblclick="handleHeaderDoubleClick"
      />

      <div class="window-body">
        <AppSidebar
          :active-route="activeRoute"
          @navigate-route="navigateRoute"
        />

        <div class="content-stage">
          <ChatSessionPanel
            v-if="activeRoute === 'chat'"
            ref="chatSessionPanelRef"
            v-model:selected-agent="selectedAgent"
            v-model:selected-cwd="selectedCwd"
            v-model:active-workspace-id="activeWorkspaceId"
            v-model:proxy-enabled="proxyEnabled"
            v-model:http-proxy="httpProxy"
            v-model:https-proxy="httpsProxy"
            v-model:all-proxy="allProxy"
            v-model:no-proxy="noProxy"
            v-model:is-selecting-folder="isSelectingFolder"
            v-model:show-workspace-dialog="showWorkspaceDialog"
            v-model:preview-session-id="previewSessionId"
            :show="showSidebar"
            @notify="handleSidebarNotify"
            @open-git="handleOpenGitDialog"
            @open-session-tab="openSessionTab"
          />

          <main class="main-content">
            <div v-if="error" class="error-banner">
              <span class="error-icon">!</span>
              <span class="error-text">{{ error }}</span>
              <button class="error-close ued-icon-btn ued-icon-btn--ghost ued-icon-btn--danger" @click="clearError">×</button>
            </div>

            <section v-show="activeRoute === 'chat'" class="route-page route-page--chat">
              <ChatTabsView
                :active-tab-id="activeChatTabId"
                :active-session="activeTabSession"
                :tab-items="tabItems"
                :connected-session-ids="sessionStore.connectedSessionIds"
                :loading-session-ids="sessionStore.loadingSessionIds"
                :has-agents="hasAgents"
                :selected-agent-label="hasAgents ? selectedAgent || configStore.agentNames[0] : '0'"
                :workspace-label="selectedCwd ? selectedCwdLabel : '.'"
                :saved-session-count="savedSessionCount"
                :is-connecting="isConnecting"
                @activate-tab="setActiveTab"
                @close-tab="closeChatTab"
                @resume-session="chatSessionPanelRef?.handleResumeSession($event)"
                @open-workspace="chatSessionPanelRef?.openWorkspaceDialog()"
                @open-add-agent="openSettings(true)"
                @notify="pushToast($event.message, $event.tone)"
                @open-git="handleOpenGitDialog"
              />
            </section>

            <section v-if="activeRoute === 'agents'" class="route-page">
              <SettingsView
                embedded
                :title="t('settings.agents')"
                :eyebrow="t('app.desktopClient')"
                :start-in-add-mode="openSettingsInAddMode"
                @notify="pushToast($event.message, $event.tone)"
                @close="closeSettings"
              />
            </section>

            <section v-if="activeRoute === 'workspaces'" class="route-page">
              <WorkspacesView
                @notify="pushToast($event.message, $event.tone)"
              />
            </section>

            <section v-if="activeRoute === 'settings'" class="route-page">
              <SettingsView
                embedded
                :title="t('app.settings')"
                :eyebrow="t('app.desktopClient')"
                :start-in-add-mode="false"
                @notify="pushToast($event.message, $event.tone)"
                @close="closeSettings"
              />
            </section>
          </main>
        </div>

        <button
          v-if="activeRoute === 'chat'"
          class="floating-sidebar-toggle no-drag"
          :class="{ 'is-open': showSidebar }"
          :style="{
            left: showSidebar ? '365px' : '48px',
            transform: showSidebar ? 'translate(-50%, -50%)' : 'translateY(-50%)',
          }"
          :title="showSidebar ? t('app.collapseSidebar') : t('app.expandSidebar')"
          :aria-label="showSidebar ? t('app.collapseSidebar') : t('app.expandSidebar')"
          @click="toggleSidebar"
        >
          <SvgIcon
            :name="showSidebar ? 'app-sidebar-collapse' : 'app-sidebar-expand'"
            class="floating-sidebar-toggle__icon"
          />
          <span v-if="!showSidebar && savedSessionCount > 0" class="floating-sidebar-toggle__badge">
            {{ savedSessionCount }}
          </span>
        </button>
      </div>

      <AppFooter
        :active-route="activeRoute"
        :selected-agent="selectedAgent"
        :selected-cwd="selectedCwd"
      />
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
      @update:selectedAgent="selectedAgent = $event"
      @update:proxyEnabled="proxyEnabled = $event"
      @update:httpProxy="httpProxy = $event"
      @update:httpsProxy="httpsProxy = $event"
      @update:allProxy="allProxy = $event"
      @update:noProxy="noProxy = $event"
      @update:showStartupDetails="showStartupDetails = $event"
      @select-folder="chatSessionPanelRef?.handleSelectFolder()"
      @create-session="chatSessionPanelRef?.handleCreateSession()"
      @open-add-agent="handleOpenAddAgent"
      @cancel-connection="sessionStore.cancelConnection()"
    />

    <AppDialogShell
      v-model="showGitDialog"
      :title="t('git.title')"
      :eyebrow="t('git.eyebrow')"
      max-width="760px"
      max-height="min(760px, calc(100dvh - 56px))"
    >
      <GitCommitPanel
        :cwd="gitDialogCwd"
        @notify="pushToast($event.message, $event.tone)"
        @committed="handleGitCommitted"
      />
    </AppDialogShell>

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
.window-body { position: relative; flex: 1; min-height: 0; display: flex; gap: 0; padding: 0; background: var(--ued-bg-window); overflow: hidden; }
.content-stage { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: row; gap: 0; background: var(--ued-bg-panel); }
.main-content { position: relative; flex: 1; min-width: 0; min-height: 0; overflow: hidden; background: linear-gradient(180deg, var(--ued-bg-panel) 0%, var(--ued-bg-window) 100%); }
.route-page { height: 100%; min-height: 0; overflow: hidden; }
.route-page--chat { display: flex; flex-direction: column; }
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
