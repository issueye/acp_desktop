<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useConfigStore } from './stores/config';
import { useSessionStore } from './stores/session';
import { initTelemetry } from './lib/telemetry';
import { loadStore, saveStore, selectDirectory } from './lib/wails';
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
const showTrafficMonitor = ref(false);
const showStartupDetails = ref(false);
const workspaceCollapsed = ref(false);
const sessionsCollapsed = ref(false);
const sessionSearchQuery = ref('');
const pinnedSessionIds = ref<string[]>([]);
const proxyEnabled = ref(false);
const httpProxy = ref('');
const httpsProxy = ref('');
const allProxy = ref('');
const noProxy = ref('');

// Preferences store for persisting user selections
let prefsStoreData: Record<string, unknown> = {};
const prefsStoreName = 'preferences.json';

const isConnected = computed(() => sessionStore.isConnected);
const isLoading = computed(() => sessionStore.isLoading);
const isConnecting = computed(() => sessionStore.isConnecting);
const error = computed(() => sessionStore.error || configStore.error);
const hasAgents = computed(() => configStore.hasAgents);
const savedSessionCount = computed(() => sessionStore.resumableSessions.length);
const currentSessionId = computed(() => sessionStore.currentSession?.id ?? '');

// Watch for permission requests from session store
const pendingPermission = computed(() => sessionStore.pendingPermission);

// Watch for auth method selection requests
const pendingAuthMethods = computed(() => sessionStore.pendingAuthMethods);
const pendingAuthAgentName = computed(() => sessionStore.pendingAuthAgentName);

async function persistPreferences() {
  await saveStore(prefsStoreName, prefsStoreData);
}

onMounted(async () => {
  // Load persisted preferences first
  prefsStoreData = await loadStore(prefsStoreName);
  workspaceCollapsed.value = (prefsStoreData.workspaceCollapsed as boolean | undefined) ?? false;
  sessionsCollapsed.value = (prefsStoreData.sessionsCollapsed as boolean | undefined) ?? false;
  pinnedSessionIds.value = Array.isArray(prefsStoreData.pinnedSessionIds)
    ? (prefsStoreData.pinnedSessionIds as string[])
    : [];
  proxyEnabled.value = (prefsStoreData.proxyEnabled as boolean | undefined) ?? false;
  httpProxy.value = (prefsStoreData.httpProxy as string | undefined) ?? '';
  httpsProxy.value = (prefsStoreData.httpsProxy as string | undefined) ?? '';
  allProxy.value = (prefsStoreData.allProxy as string | undefined) ?? '';
  noProxy.value = (prefsStoreData.noProxy as string | undefined) ?? '';
  
  // Initialize telemetry (check user preference)
  const telemetryEnabled = (prefsStoreData.telemetryEnabled as boolean | undefined) ?? true;
  await initTelemetry(telemetryEnabled);
  
  // Initialize stores
  await configStore.loadConfig();
  await configStore.setupHotReload();
  await sessionStore.initStore();
  
  const savedCwd = prefsStoreData.lastCwd as string | undefined;
  if (savedCwd) {
    selectedCwd.value = savedCwd;
  }
});

async function handleAgentSelect(agentName: string) {
  selectedAgent.value = agentName;
}

async function handleSelectFolder() {
  const folder = await selectDirectory();
  if (folder) {
    selectedCwd.value = folder;
    // Persist the selection
    prefsStoreData.lastCwd = folder;
    await persistPreferences();
  }
}

async function handleNewSession() {
  if (!selectedAgent.value) return;
  
  try {
    const cwd = selectedCwd.value || '.';
    prefsStoreData.proxyEnabled = proxyEnabled.value;
    prefsStoreData.httpProxy = httpProxy.value;
    prefsStoreData.httpsProxy = httpsProxy.value;
    prefsStoreData.allProxy = allProxy.value;
    prefsStoreData.noProxy = noProxy.value;
    await persistPreferences();
    await sessionStore.createSession(selectedAgent.value, cwd, buildSessionProxyConfig());
  } catch (e) {
    console.error('Failed to create session:', e);
  }
}

async function handleResumeSession(session: SavedSession) {
  selectedAgent.value = session.agentName;
  applyProxyConfig(session.proxy);
  prefsStoreData.proxyEnabled = proxyEnabled.value;
  prefsStoreData.httpProxy = httpProxy.value;
  prefsStoreData.httpsProxy = httpsProxy.value;
  prefsStoreData.allProxy = allProxy.value;
  prefsStoreData.noProxy = noProxy.value;
  await persistPreferences();
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

async function toggleWorkspaceSection() {
  workspaceCollapsed.value = !workspaceCollapsed.value;
  prefsStoreData.workspaceCollapsed = workspaceCollapsed.value;
  await persistPreferences();
}

async function toggleSessionsSection() {
  sessionsCollapsed.value = !sessionsCollapsed.value;
  prefsStoreData.sessionsCollapsed = sessionsCollapsed.value;
  await persistPreferences();
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

function clearError() {
  sessionStore.clearError();
  configStore.clearError();
}
</script>

<template>
  <div class="app-container">
    <!-- Sidebar -->
    <aside v-if="showSidebar" class="sidebar">
      <div class="sidebar-header">
        <div class="title-group">
          <h1>ACP UI</h1>
          <p>{{ t('app.desktopClient') }}</p>
        </div>
        <div class="header-actions">
          <button
            class="settings-btn lang-btn"
            @click="toggleLocale"
            :title="t('app.language')"
          >
            {{ locale === 'zh-CN' ? t('app.langLabelZh') : t('app.langLabelEn') }}
          </button>
          <button 
            class="settings-btn" 
            :class="{ active: showTrafficMonitor }"
            @click="showTrafficMonitor = !showTrafficMonitor" 
            :title="t('app.trafficMonitor')"
          >📡</button>
          <button class="settings-btn" @click="showSettings = true" :title="t('app.settings')">⚙</button>
          <button class="toggle-btn" @click="toggleSidebar">◀</button>
        </div>
      </div>
      
      <div class="sidebar-content">
        <!-- Agent Selection -->
        <div class="section workspace-section" :class="{ 'section-collapsed': workspaceCollapsed }">
          <div class="section-head">
            <h2>{{ t('app.workspace') }}</h2>
            <button class="section-toggle" @click="toggleWorkspaceSection">
              {{ workspaceCollapsed ? '▸' : '▾' }}
            </button>
          </div>

          <div v-show="!workspaceCollapsed" class="section-body">
            <AgentSelector 
              v-model:selected="selectedAgent"
              @select="handleAgentSelect"
            />
            
            <!-- Working Directory Picker -->
            <div class="cwd-picker">
              <label>{{ t('app.workingDirectory') }}:</label>
              <div class="cwd-row">
                <span class="cwd-path" :title="selectedCwd || t('app.currentDirectory')">
                  {{ selectedCwd ? selectedCwd.split(/[\\/]/).pop() : '.' }}
                </span>
                <button 
                  class="cwd-btn" 
                  @click="handleSelectFolder"
                  :title="t('app.selectFolder')"
                  :disabled="isConnecting || isConnected"
                >
                  📁
                </button>
              </div>
            </div>

            <div class="proxy-config">
              <div class="proxy-header">
                <label>{{ t('app.proxy') }}</label>
                <label class="proxy-enable">
                  <input
                    v-model="proxyEnabled"
                    type="checkbox"
                    :disabled="isConnecting || isConnected"
                  />
                  <span>{{ t('app.proxyEnable') }}</span>
                </label>
              </div>
              <div class="proxy-fields" :class="{ disabled: !proxyEnabled }">
                <div class="proxy-row">
                  <span class="proxy-label">{{ t('app.proxyHttp') }}</span>
                  <input
                    v-model="httpProxy"
                    class="proxy-input"
                    type="text"
                    :placeholder="t('app.proxySampleHost')"
                    :disabled="!proxyEnabled || isConnecting || isConnected"
                  />
                </div>
                <div class="proxy-row">
                  <span class="proxy-label">{{ t('app.proxyHttps') }}</span>
                  <input
                    v-model="httpsProxy"
                    class="proxy-input"
                    type="text"
                    :placeholder="t('app.proxySampleHost')"
                    :disabled="!proxyEnabled || isConnecting || isConnected"
                  />
                </div>
                <div class="proxy-row">
                  <span class="proxy-label">{{ t('app.proxyAll') }}</span>
                  <input
                    v-model="allProxy"
                    class="proxy-input"
                    type="text"
                    :placeholder="t('app.proxySampleHost')"
                    :disabled="!proxyEnabled || isConnecting || isConnected"
                  />
                </div>
                <div class="proxy-row">
                  <span class="proxy-label">{{ t('app.proxyNo') }}</span>
                  <input
                    v-model="noProxy"
                    class="proxy-input"
                    type="text"
                    :placeholder="t('app.proxySampleNo')"
                    :disabled="!proxyEnabled || isConnecting || isConnected"
                  />
                </div>
              </div>
            </div>
            
            <div class="session-actions">
              <button 
                v-if="hasAgents && !isConnected && !isConnecting"
                class="new-session-btn"
                :disabled="!selectedAgent || isLoading"
                @click="handleNewSession"
              >
                {{ isLoading ? t('app.connecting') : t('app.newSession') }}
              </button>
              
              <!-- Startup Progress -->
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
              
              <button 
                v-if="isConnected"
                class="disconnect-btn"
                @click="handleDisconnect"
              >
                {{ t('app.disconnect') }}
              </button>
            </div>
          </div>
        </div>
        
        <!-- Session List -->
        <div class="section sessions-section" :class="{ 'section-collapsed': sessionsCollapsed }">
          <div class="section-head">
            <h2>{{ t('app.savedSessions') }}</h2>
            <div class="section-head-right">
              <span class="session-count">{{ savedSessionCount }}</span>
              <button class="section-toggle" @click="toggleSessionsSection">
                {{ sessionsCollapsed ? '▸' : '▾' }}
              </button>
            </div>
          </div>
          <div v-show="!sessionsCollapsed" class="section-body sessions-body">
            <div class="session-search-wrap">
              <input
                v-model="sessionSearchQuery"
                type="text"
                class="session-search"
                :placeholder="t('app.searchSessions')"
              />
            </div>
            <SessionList 
              :query="sessionSearchQuery"
              :pinned-session-ids="pinnedSessionIds"
              :active-session-id="currentSessionId"
              @resume="handleResumeSession"
              @delete="handleDeleteSession"
              @toggle-pin="handleToggleSessionPin"
            />
          </div>
        </div>
      </div>
    </aside>
    
    <!-- Collapsed sidebar toggle -->
    <button 
      v-if="!showSidebar" 
      class="sidebar-toggle-collapsed"
      @click="toggleSidebar"
    >
      ▶
    </button>
    
    <!-- Main Content Area -->
    <div class="main-area">
      <main class="main-content">
        <!-- Error display -->
        <div v-if="error" class="error-banner">
          <span class="error-icon">⚠</span>
          <span class="error-text">{{ error }}</span>
          <button class="error-close" @click="clearError" title="Dismiss">×</button>
        </div>
        
        <!-- Chat View when connected -->
        <ChatView v-if="isConnected" />
        
        <!-- Welcome screen when not connected -->
        <div v-else class="welcome-screen">
          <h2>{{ t('app.welcomeTitle') }}</h2>
          <p>{{ t('app.welcomeDesc') }}</p>
          <p v-if="!hasAgents" class="hint">
            {{ t('app.configureAgentsHint') }}
          </p>
        </div>
      </main>
      
      <!-- Traffic Monitor Panel -->
      <div v-if="showTrafficMonitor" class="traffic-panel">
        <TrafficMonitor @close="showTrafficMonitor = false" />
      </div>
    </div>
    
    <!-- Permission Dialog -->
    <PermissionDialog 
      v-if="pendingPermission"
      :request="pendingPermission"
      @select="handlePermissionSelect"
      @cancel="handlePermissionCancel"
    />

    <!-- Auth Method Dialog -->
    <AuthMethodDialog 
      v-if="pendingAuthMethods.length > 0"
      :auth-methods="pendingAuthMethods"
      :agent-name="pendingAuthAgentName"
      @select="handleAuthMethodSelect"
      @cancel="handleAuthMethodCancel"
    />

    <!-- Settings -->
    <SettingsView 
      v-if="showSettings"
      @close="showSettings = false"
    />
  </div>
</template>

<style>
:root {
  --bg-primary: #0066cc;
  --bg-primary-hover: #0052a3;
  --bg-sidebar: #f8f9fa;
  --bg-main: #ffffff;
  --bg-hover: #f0f0f0;
  --bg-user: #e3f2fd;
  --bg-assistant: #f5f5f5;
  --bg-code: #282c34;
  --bg-success: #28a745;
  --bg-danger: #dc3545;
  --bg-warning: #fff3cd;
  --text-primary: #333;
  --text-secondary: #666;
  --text-muted: #999;
  --text-accent: #0066cc;
  --text-code: #abb2bf;
  --border-color: #e0e0e0;
  
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: var(--text-primary);
  background-color: #ffffff;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #4da6ff;
    --bg-primary-hover: #3399ff;
    --bg-sidebar: #1e1e1e;
    --bg-main: #252525;
    --bg-hover: #333;
    --bg-user: #1a3a5c;
    --bg-assistant: #2d2d2d;
    --text-primary: #e0e0e0;
    --text-secondary: #a0a0a0;
    --text-muted: #707070;
    --text-accent: #4da6ff;
    --border-color: #404040;
    background-color: #252525;
  }
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #app {
  height: 100%;
}
</style>

<style scoped>
.app-container {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  width: clamp(300px, 27vw, 360px);
  min-width: 300px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1rem 0.8rem;
  border-bottom: 1px solid var(--border-color);
}

.title-group h1 {
  font-size: 1.15rem;
  margin: 0;
}

.title-group p {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.header-actions {
  display: flex;
  gap: 0.4rem;
}

.settings-btn,
.toggle-btn {
  width: 30px;
  height: 30px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-main);
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.lang-btn {
  width: auto;
  min-width: 42px;
  padding: 0 0.45rem;
  font-size: 0.72rem;
  font-weight: 700;
}

.settings-btn:hover,
.toggle-btn:hover {
  color: var(--text-primary);
  border-color: var(--text-accent);
}

.settings-btn.active {
  color: var(--text-accent);
  background: rgba(0, 102, 204, 0.08);
  border-color: rgba(0, 102, 204, 0.35);
}

.sidebar-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
}

.section {
  padding: 0.85rem;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-main);
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.65rem;
}

.section-head-right {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.section-head h2 {
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.session-count {
  min-width: 1.75rem;
  text-align: center;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-accent);
  background: rgba(0, 102, 204, 0.11);
}

.workspace-section {
  flex-shrink: 0;
}

.sessions-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.section-body {
  min-height: 0;
}

.sessions-body {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-height: 0;
  flex: 1;
}

.sessions-section :deep(.session-list) {
  flex: 1;
  min-height: 0;
}

.section-collapsed {
  padding-bottom: 0.55rem;
}

.section-toggle {
  width: 22px;
  height: 22px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-main);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.76rem;
  line-height: 1;
}

.section-toggle:hover {
  border-color: var(--text-accent);
  color: var(--text-accent);
}

.session-search-wrap {
  flex-shrink: 0;
}

.session-search {
  width: 100%;
  height: 31px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-main);
  color: var(--text-primary);
  font-size: 0.82rem;
  padding: 0 0.55rem;
}

.session-search:focus {
  outline: none;
  border-color: var(--text-accent);
}

.new-session-btn,
.disconnect-btn {
  width: 100%;
  margin-top: 0.75rem;
  padding: 0.625rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
}

.new-session-btn {
  background: var(--bg-primary);
  color: white;
}

.new-session-btn:hover:not(:disabled) {
  background: var(--bg-primary-hover);
}

.new-session-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cwd-picker {
  margin-top: 0.65rem;
}

.cwd-picker label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.cwd-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.cwd-path {
  flex: 1;
  padding: 0.375rem 0.5rem;
  background: var(--bg-main);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 0.8rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cwd-btn {
  width: 34px;
  height: 34px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-main);
  cursor: pointer;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cwd-btn:hover:not(:disabled) {
  background: var(--bg-hover);
}

.cwd-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.proxy-config {
  margin-top: 0.6rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.5rem;
  background: var(--bg-main);
}

.proxy-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.45rem;
}

.proxy-header > label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.proxy-enable {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.proxy-fields {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.proxy-fields.disabled {
  opacity: 0.65;
}

.proxy-row {
  display: grid;
  grid-template-columns: 68px 1fr;
  align-items: center;
  gap: 0.4rem;
}

.proxy-label {
  font-size: 0.72rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.proxy-input {
  width: 100%;
  height: 28px;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  background: var(--bg-main);
  color: var(--text-primary);
  font-size: 0.76rem;
  padding: 0 0.45rem;
}

.proxy-input:focus {
  outline: none;
  border-color: var(--text-accent);
}

.disconnect-btn {
  background: var(--bg-danger);
  color: white;
}

.disconnect-btn:hover {
  background: #c82333;
}

.sidebar-toggle-collapsed {
  position: fixed;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-left: none;
  border-radius: 0 4px 4px 0;
  background: var(--bg-sidebar);
  cursor: pointer;
}

.session-actions {
  margin-top: 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-main);
}

.traffic-panel {
  flex-shrink: 0;
  border-top: 2px solid var(--border-color);
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #fee;
  color: #c00;
  border-bottom: 1px solid #fcc;
}

.error-icon {
  flex-shrink: 0;
}

.error-text {
  flex: 1;
}

.error-close {
  flex-shrink: 0;
  padding: 0.25rem 0.5rem;
  border: none;
  background: transparent;
  color: #c00;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0.6;
  border-radius: 4px;
}

.error-close:hover {
  opacity: 1;
  background: rgba(204, 0, 0, 0.1);
}

.welcome-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.welcome-screen h2 {
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.welcome-screen .hint {
  margin-top: 1rem;
  font-size: 0.875rem;
  color: var(--text-muted);
}
</style>
