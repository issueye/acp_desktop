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
import AgentSelector from './components/AgentSelector.vue';
import SessionList from './components/SessionList.vue';
import ChatView from './components/ChatView.vue';
import PermissionDialog from './components/PermissionDialog.vue';
import SettingsView from './components/SettingsView.vue';
import AuthMethodDialog from './components/AuthMethodDialog.vue';
import TrafficMonitor from './components/TrafficMonitor.vue';
import StartupProgress from './components/StartupProgress.vue';
import type { SavedSession, SessionProxyConfig } from './lib/types';

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

let prefsStoreData: Record<string, unknown> = {};
const prefsStoreName = 'preferences.json';

const isConnected = computed(() => sessionStore.isConnected);
const isLoading = computed(() => sessionStore.isLoading);
const isConnecting = computed(() => sessionStore.isConnecting);
const error = computed(() => sessionStore.error || configStore.error);
const hasAgents = computed(() => configStore.hasAgents);
const savedSessionCount = computed(() => sessionStore.resumableSessions.length);
const currentSessionId = computed(() => sessionStore.currentSession?.id ?? '');
const currentSessionTitle = computed(
  () => sessionStore.currentSession?.title || t('chat.titleFallback')
);
const pendingPermission = computed(() => sessionStore.pendingPermission);
const pendingAuthMethods = computed(() => sessionStore.pendingAuthMethods);
const pendingAuthAgentName = computed(() => sessionStore.pendingAuthAgentName);
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
  if (isConnected.value) return;
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
  } catch (e) {
    console.error('Failed to create session:', e);
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
  } catch (e) {
    console.error('Failed to resume session:', e);
  }
}

async function handleDeleteSession(sessionId: string) {
  await sessionStore.deleteSession(sessionId);
}

async function handleDisconnect() {
  await sessionStore.disconnect();
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
      <header class="window-header drag-region" @dblclick="handleHeaderDoubleClick">
        <div class="window-brand">
          <button
            class="icon-button no-drag"
            :title="showSidebar ? t('app.collapseSidebar') : t('app.expandSidebar')"
            @click="toggleSidebar"
          >
            {{ showSidebar ? '◀' : '▶' }}
          </button>
          <div class="brand-mark" aria-hidden="true"></div>
          <div class="brand-copy">
            <strong>ACP UI</strong>
            <span>{{ t('app.desktopClient') }}</span>
          </div>
        </div>

        <div class="window-status">
          <span class="status-dot" :class="{ live: isConnected || isConnecting }"></span>
          <div class="status-copy">
            <strong>{{ currentSessionTitle }}</strong>
            <span>
              {{ activeStatusLabel }}
              <template v-if="selectedCwd">
                · {{ formatCompactPath(selectedCwd) }}
              </template>
            </span>
          </div>
        </div>

        <div class="window-actions no-drag">
          <button class="header-chip" :title="t('app.language')" @click="toggleLocale">
            {{ locale === 'zh-CN' ? t('app.langLabelZh') : t('app.langLabelEn') }}
          </button>
          <button class="icon-button" :title="t('app.settings')" @click="openSettings()">⚙</button>
          <button class="icon-button" :title="t('app.minimise')" @click="windowMinimise">_</button>
          <button class="icon-button close-button" :title="t('app.close')" @click="windowClose">×</button>
        </div>
      </header>

      <div class="window-body">
        <aside v-if="showSidebar" class="sidebar-panel">
          <div class="sidebar-top">
            <button
              class="sidebar-create"
              :disabled="isConnected || isConnecting"
              @click="openWorkspaceDialog"
            >
              <span class="create-icon">+</span>
              <span class="create-copy">
                <strong>{{ t('app.newSession') }}</strong>
                <span>{{ t('app.openWorkspace') }}</span>
              </span>
            </button>
          </div>

          <nav class="sidebar-nav">
            <div class="nav-row active">
              <span class="nav-icon">#</span>
              <span class="nav-label">{{ t('app.savedSessions') }}</span>
              <strong>{{ savedSessionCount }}</strong>
            </div>
            <button
              class="nav-row nav-button"
              :class="{ active: showTrafficMonitor }"
              @click="showTrafficMonitor = !showTrafficMonitor"
            >
              <span class="nav-icon">~</span>
              <span class="nav-label">{{ t('app.trafficMonitor') }}</span>
            </button>
          </nav>

          <div class="sidebar-context">
            <div class="context-row">
              <span>{{ t('agent.label') }}</span>
              <strong>{{ selectedAgent || t('agent.noneConfigured') }}</strong>
            </div>
            <div class="context-row">
              <span>{{ t('app.workingDirectory') }}</span>
              <strong :title="selectedCwd || t('app.currentDirectory')">
                {{ selectedCwd ? formatCompactPath(selectedCwd) : '.' }}
              </strong>
            </div>
          </div>

          <div class="sidebar-search">
            <input
              v-model="sessionSearchQuery"
              type="text"
              class="session-search"
              :placeholder="t('app.searchSessions')"
            />
          </div>

          <div class="session-list-wrap">
            <SessionList
              :query="sessionSearchQuery"
              :pinned-session-ids="pinnedSessionIds"
              :active-session-id="currentSessionId"
              @resume="handleResumeSession"
              @delete="handleDeleteSession"
              @toggle-pin="handleToggleSessionPin"
            />
          </div>

          <div class="sidebar-footer">
            <button class="footer-button" @click="openSettings()">
              {{ t('app.settings') }}
            </button>
            <button v-if="isConnected" class="footer-danger" @click="handleDisconnect">
              {{ t('app.disconnect') }}
            </button>
          </div>
        </aside>

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

            <div v-else class="welcome-screen">
              <div class="welcome-card">
                <p class="eyebrow">{{ t('app.welcomeEyebrow') }}</p>
                <h2>{{ t('app.welcomeTitle') }}</h2>
                <p class="welcome-text">{{ t('app.welcomeDesc') }}</p>

                <div class="welcome-actions">
                  <button class="primary-button" :disabled="isConnecting" @click="openWorkspaceDialog">
                    {{ t('app.newSession') }}
                  </button>
                  <button class="secondary-button" @click="openSettings(true)">
                    {{ t('settings.addAgent') }}
                  </button>
                </div>

                <div class="welcome-grid">
                  <div class="welcome-stat">
                    <span>{{ t('agent.label') }}</span>
                    <strong>{{ hasAgents ? selectedAgent || configStore.agentNames[0] : '0' }}</strong>
                  </div>
                  <div class="welcome-stat">
                    <span>{{ t('app.workspace') }}</span>
                    <strong>{{ selectedCwd ? selectedCwdLabel : '.' }}</strong>
                  </div>
                  <div class="welcome-stat">
                    <span>{{ t('app.savedSessions') }}</span>
                    <strong>{{ savedSessionCount }}</strong>
                  </div>
                </div>

                <p v-if="!hasAgents" class="hint-text">{{ t('app.configureAgentsHint') }}</p>
              </div>
            </div>
          </main>

          <div v-if="showTrafficMonitor" class="traffic-panel">
            <TrafficMonitor @close="showTrafficMonitor = false" />
          </div>
        </div>
      </div>
    </div>

    <div v-if="showWorkspaceDialog" class="modal-overlay" @click.self="closeWorkspaceDialog">
      <div class="workspace-dialog">
        <div class="dialog-header">
          <div>
            <p class="eyebrow">{{ t('app.workspace') }}</p>
            <h2>{{ t('app.sessionSetupTitle') }}</h2>
            <p class="dialog-subtitle">{{ t('app.sessionSetupDesc') }}</p>
          </div>
          <button class="icon-button" :disabled="isConnecting" @click="closeWorkspaceDialog">×</button>
        </div>

        <div v-if="!hasAgents" class="empty-workspace panel-card">
          <h3>{{ t('app.noAgentTitle') }}</h3>
          <p>{{ t('app.noAgentDesc') }}</p>
          <button class="primary-button" @click="handleOpenAddAgent">{{ t('settings.addAgent') }}</button>
        </div>

        <template v-else>
          <div class="dialog-grid">
            <div class="dialog-main">
              <section class="panel-card">
                <AgentSelector v-model:selected="selectedAgent" @select="handleAgentSelect" />
              </section>

              <section class="panel-card">
                <div class="section-headline">
                  <span>{{ t('app.workingDirectory') }}</span>
                  <button class="ghost-button" @click="handleSelectFolder">{{ t('app.selectFolder') }}</button>
                </div>
                <div class="cwd-card" :title="selectedCwd || t('app.currentDirectory')">
                  <strong>{{ selectedCwdLabel }}</strong>
                  <span>{{ selectedCwd || '.' }}</span>
                </div>
              </section>

              <section class="panel-card">
                <div class="section-headline">
                  <span>{{ t('app.proxy') }}</span>
                  <label class="proxy-switch">
                    <input v-model="proxyEnabled" type="checkbox" :disabled="isConnecting" />
                    <span>{{ t('app.proxyEnable') }}</span>
                  </label>
                </div>
                <div class="proxy-grid" :class="{ disabled: !proxyEnabled }">
                  <label class="proxy-field">
                    <span>{{ t('app.proxyHttp') }}</span>
                    <input v-model="httpProxy" type="text" :placeholder="t('app.proxySampleHost')" :disabled="!proxyEnabled || isConnecting" />
                  </label>
                  <label class="proxy-field">
                    <span>{{ t('app.proxyHttps') }}</span>
                    <input v-model="httpsProxy" type="text" :placeholder="t('app.proxySampleHost')" :disabled="!proxyEnabled || isConnecting" />
                  </label>
                  <label class="proxy-field">
                    <span>{{ t('app.proxyAll') }}</span>
                    <input v-model="allProxy" type="text" :placeholder="t('app.proxySampleHost')" :disabled="!proxyEnabled || isConnecting" />
                  </label>
                  <label class="proxy-field">
                    <span>{{ t('app.proxyNo') }}</span>
                    <input v-model="noProxy" type="text" :placeholder="t('app.proxySampleNo')" :disabled="!proxyEnabled || isConnecting" />
                  </label>
                </div>
              </section>
            </div>

            <aside class="dialog-side">
              <div class="panel-card summary-card">
                <p class="eyebrow">{{ t('app.workspaceSummary') }}</p>
                <div class="summary-line">
                  <span>{{ t('agent.label') }}</span>
                  <strong>{{ selectedAgent }}</strong>
                </div>
                <div class="summary-line">
                  <span>{{ t('app.workspace') }}</span>
                  <strong :title="selectedCwd || '.'">{{ selectedCwdLabel }}</strong>
                </div>
                <div class="summary-line">
                  <span>{{ t('app.proxy') }}</span>
                  <strong>{{ proxyEnabled ? t('app.proxyEnable') : t('app.proxyDisabled') }}</strong>
                </div>
              </div>

              <StartupProgress
                v-if="isConnecting"
                :agent-name="selectedAgent"
                :phase="sessionStore.startupPhase"
                :logs="sessionStore.startupLogs"
                :elapsed-seconds="sessionStore.startupElapsed"
                :show-details="showStartupDetails"
                @cancel="handleCancelConnection"
                @toggle-details="showStartupDetails = !showStartupDetails"
              />

              <div v-else class="dialog-actions">
                <button class="primary-button" :disabled="!selectedAgent || isLoading" @click="handleCreateSession">
                  {{ isLoading ? t('app.connecting') : t('app.newSession') }}
                </button>
                <button class="secondary-button" @click="closeWorkspaceDialog">{{ t('common.cancel') }}</button>
              </div>
            </aside>
          </div>
        </template>
      </div>
    </div>

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
      @close="closeSettings"
    />
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
.window-header { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: .75rem; align-items: center; min-height: 46px; padding: .38rem .72rem; background: rgba(248, 246, 240, 0.96); color: var(--text-primary); border-bottom: 1px solid rgba(15,23,42,.06); }
.window-brand, .window-actions, .window-status, .section-title-row, .section-headline, .summary-line, .dialog-header, .welcome-actions, .proxy-switch { display: flex; align-items: center; }
.window-brand { gap: .55rem; min-width: 0; }
.brand-mark { width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(180deg, #ffffff, #eef4ff); border: 1px solid rgba(37, 99, 235, 0.12); position: relative; }
.brand-mark::before { content: ''; position: absolute; inset: 8px; border-radius: 50%; background: var(--text-accent); opacity: .9; }
.brand-copy { display: flex; flex-direction: column; min-width: 0; }
.brand-copy strong { font-size: .88rem; font-weight: 600; line-height: 1.1; }
.brand-copy span { font-size: .62rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: .08em; line-height: 1.1; }
.window-status { gap: .55rem; min-width: 0; justify-content: center; }
.status-dot { width: 8px; height: 8px; border-radius: 999px; background: #cbd5e1; flex-shrink: 0; }
.status-dot.live { background: var(--text-accent); box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1); }
.status-copy { min-width: 0; display: flex; flex-direction: column; gap: .08rem; }
.status-copy strong,
.status-copy span { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.status-copy strong { font-size: .82rem; font-weight: 600; color: var(--text-primary); }
.status-copy span { font-size: .72rem; color: var(--text-muted); }
.window-actions { gap: .4rem; }
.header-chip, .icon-button, .ghost-button, .secondary-button, .primary-button, .danger-button, .session-search, .cwd-card, .proxy-field input { transition: background .2s ease, border-color .2s ease, color .2s ease, transform .2s ease; }
.header-chip, .icon-button { height: 28px; border-radius: 8px; background: #fffdfa; color: var(--text-secondary); border: 1px solid rgba(15,23,42,.06); cursor: pointer; }
.header-chip { min-width: 46px; padding: 0 .65rem; font-size: .74rem; font-weight: 700; }
.icon-button { width: 30px; display: grid; place-items: center; font-size: .88rem; }
.header-chip:hover, .icon-button:hover { background: #ffffff; color: var(--text-primary); border-color: rgba(15,23,42,.1); }
.close-button:hover { background: rgba(220,38,38,.08); border-color: rgba(220,38,38,.16); color: var(--bg-danger); }
.window-body { flex: 1; min-height: 0; display: flex; gap: 0; padding: 0; background: var(--bg-main); }
.sidebar-panel { width: 320px; min-width: 320px; display: flex; flex-direction: column; gap: .8rem; padding: .9rem .8rem; background: var(--bg-sidebar); border-right: 1px solid rgba(15, 23, 42, 0.06); }
.panel-card { padding: .95rem; border-radius: 8px; background: var(--bg-card); border: 1px solid rgba(15,23,42,.06); box-shadow: var(--shadow-sm); }
.sidebar-summary, .section-title-row, .section-headline, .dialog-header, .summary-line { justify-content: space-between; gap: .75rem; }
.workspace-preview, .preview-item, .welcome-stat, .dialog-actions, .dialog-main, .dialog-side, .proxy-field { display: flex; flex-direction: column; }
.workspace-preview, .dialog-main, .dialog-side { gap: .75rem; }
.eyebrow { font-size: .72rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--text-muted); }
.sidebar-summary h2, .dialog-header h2, .welcome-card h2, .section-title-row h3 { margin-top: .35rem; font-size: 1.15rem; color: var(--text-primary); }
.primary-button, .secondary-button, .ghost-button, .danger-button { border-radius: 8px; border: 1px solid transparent; cursor: pointer; }
.primary-button { padding: .72rem 1rem; background: var(--bg-primary); color: white; border-color: rgba(37,99,235,.18); box-shadow: 0 1px 2px rgba(37,99,235,.16); }
.primary-button:hover:not(:disabled) { transform: translateY(-1px); background: var(--bg-primary-hover); border-color: rgba(37,99,235,.22); color: white; }
.secondary-button, .ghost-button { padding: .68rem .95rem; background: #fffdfa; color: var(--text-secondary); border-color: rgba(15,23,42,.08); }
.secondary-button:hover, .ghost-button:hover, .ghost-button.active { color: var(--text-accent); border-color: rgba(37,99,235,.14); background: #ffffff; }
.danger-button { margin-top: auto; padding: .75rem 1rem; background: #fffdfa; color: var(--bg-danger); border-color: rgba(220,38,38,.12); }
.preview-label, .welcome-stat span, .proxy-field span { font-size: .76rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: .08em; }
.preview-item strong, .welcome-stat strong { font-size: .98rem; color: var(--text-primary); }
.session-search, .proxy-field input { width: 100%; height: 40px; border-radius: 8px; border: 1px solid var(--border-color); background: #fffdfa; color: var(--text-primary); padding: 0 .9rem; }
.session-search:focus, .proxy-field input:focus { outline: none; border-color: rgba(37,99,235,.32); box-shadow: 0 0 0 3px rgba(37,99,235,.08); }
.sidebar-top,
.sidebar-nav,
.sidebar-context,
.sidebar-footer { display: flex; flex-direction: column; gap: .35rem; }
.sidebar-create { width: 100%; display: flex; align-items: center; gap: .8rem; padding: .8rem .9rem; border-radius: 8px; border: 1px solid rgba(37,99,235,.12); background: #fffdfa; cursor: pointer; text-align: left; }
.sidebar-create:hover:not(:disabled) { background: #ffffff; border-color: rgba(37,99,235,.22); }
.sidebar-create:disabled { opacity: .55; cursor: not-allowed; }
.create-icon { width: 34px; height: 34px; border-radius: 8px; display: grid; place-items: center; background: rgba(37,99,235,.1); color: var(--text-accent); font-size: 1rem; font-weight: 700; flex-shrink: 0; }
.create-copy { display: flex; flex-direction: column; gap: .12rem; min-width: 0; }
.create-copy strong { font-size: .88rem; color: var(--text-primary); }
.create-copy span { font-size: .73rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sidebar-nav { padding: .2rem 0 .1rem; }
.nav-row { width: 100%; display: flex; align-items: center; gap: .72rem; min-height: 38px; padding: 0 .8rem; border-radius: 8px; border: 1px solid transparent; color: var(--text-secondary); }
.nav-row strong { margin-left: auto; font-size: .74rem; color: var(--text-muted); }
.nav-button { background: transparent; cursor: pointer; text-align: left; }
.nav-row.active { background: rgba(255, 255, 255, 0.72); border-color: rgba(15,23,42,.05); color: var(--text-primary); }
.nav-icon { width: 18px; text-align: center; color: var(--text-muted); }
.nav-label { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: .82rem; font-weight: 600; }
.sidebar-context { gap: .2rem; padding: .55rem .25rem .2rem; border-top: 1px solid rgba(15,23,42,.06); }
.context-row { display: flex; align-items: center; justify-content: space-between; gap: .75rem; padding: .35rem .55rem; }
.context-row span { font-size: .72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: .08em; }
.context-row strong { font-size: .78rem; color: var(--text-primary); min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: right; }
.sidebar-search { padding: .15rem 0 0; }
.session-list-wrap { flex: 1; min-height: 0; padding: 0; overflow: hidden; }
.sidebar-footer { padding-top: .4rem; border-top: 1px solid rgba(15,23,42,.06); }
.footer-button,
.footer-danger { width: 100%; min-height: 38px; padding: 0 .8rem; border-radius: 8px; border: 1px solid transparent; background: transparent; color: var(--text-secondary); text-align: left; cursor: pointer; }
.footer-button:hover { background: rgba(255,255,255,.72); border-color: rgba(15,23,42,.05); color: var(--text-primary); }
.footer-danger { color: var(--bg-danger); }
.footer-danger:hover { background: rgba(220,38,38,.06); border-color: rgba(220,38,38,.12); }
.sidebar-rail { width: 54px; border-right: 1px solid rgba(15, 23, 42, 0.06); background: var(--bg-sidebar); color: var(--text-secondary); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .4rem; cursor: pointer; }
.content-stage { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 0; background: #ffffff; }
.main-content { flex: 1; min-height: 0; overflow: hidden; background: #ffffff; }
.traffic-panel { overflow: hidden; border-top: 1px solid rgba(15,23,42,.06); background: #fffdfa; }
.error-banner { display: flex; align-items: center; gap: .75rem; padding: .9rem 1rem; background: rgba(220,38,38,.06); color: var(--bg-danger); border-bottom: 1px solid rgba(220,38,38,.12); }
.error-icon { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; background: rgba(220,38,38,.1); font-weight: 700; }
.error-text { flex: 1; }
.error-close { border: none; background: transparent; color: inherit; font-size: 1.1rem; cursor: pointer; }
.welcome-screen { height: 100%; display: grid; place-items: center; padding: 2rem; background: linear-gradient(180deg, #ffffff 0%, #fcfaf6 100%); }
.welcome-card { width: min(760px, 100%); padding: 2rem; border-radius: 8px; background: #fffdfa; border: 1px solid rgba(15,23,42,.06); box-shadow: var(--shadow-md); }
.welcome-text, .dialog-subtitle, .hint-text { margin-top: .65rem; line-height: 1.7; color: var(--text-secondary); }
.welcome-actions, .dialog-actions { gap: .75rem; margin-top: 1.4rem; }
.welcome-grid, .proxy-grid, .dialog-grid { display: grid; gap: .85rem; }
.welcome-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 1.6rem; }
.welcome-stat { gap: .35rem; padding: 1rem; border-radius: 8px; background: #ffffff; border: 1px solid rgba(15,23,42,.06); }
.modal-overlay { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 2rem; background: rgba(15,23,42,.16); backdrop-filter: blur(10px); }
.workspace-dialog { width: min(1080px, 100%); max-height: calc(100vh - 64px); overflow: auto; padding: 1.5rem; border-radius: 8px; background: #fffdfa; border: 1px solid rgba(15,23,42,.06); box-shadow: var(--shadow-lg); }
.empty-workspace { display: grid; place-items: center; gap: .75rem; padding: 3rem 1.5rem; text-align: center; }
.dialog-grid { grid-template-columns: minmax(0, 1.65fr) minmax(280px, .95fr); }
.dialog-header .icon-button { background: #ffffff; color: var(--text-secondary); border-color: rgba(15,23,42,.06); }
.dialog-header .icon-button:hover { background: #ffffff; border-color: rgba(15,23,42,.1); color: var(--text-primary); }
.cwd-card { gap: .35rem; padding: .95rem 1rem; border-radius: 8px; border: 1px solid rgba(15,23,42,.06); background: #ffffff; }
.cwd-card strong { font-size: 1rem; color: var(--text-primary); }
.cwd-card span, .summary-line, .proxy-switch { color: var(--text-secondary); }
.proxy-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: .9rem; }
.proxy-grid.disabled { opacity: .58; }
.summary-card { background: #ffffff; }
.summary-line { margin-top: .85rem; }
.summary-line strong { color: var(--text-primary); text-align: right; }
.primary-button:disabled, .secondary-button:disabled, .header-chip:disabled, .icon-button:disabled { opacity: .55; cursor: not-allowed; transform: none; }
@media (max-width: 1180px) {
  .window-header { grid-template-columns: auto 1fr; }
  .window-actions { grid-column: 1 / -1; justify-content: flex-end; }
  .dialog-grid { grid-template-columns: 1fr; }
}
@media (max-width: 900px) {
  .app-shell { padding: 0; }
  .window-body { padding: 0; }
  .sidebar-panel { position: absolute; inset: 56px auto 0 0; z-index: 8; width: min(320px, calc(100vw - 24px)); height: calc(100vh - 56px); box-shadow: var(--shadow-md); }
  .welcome-grid, .proxy-grid { grid-template-columns: 1fr; }
  .welcome-actions { flex-direction: column; }
}
</style>
