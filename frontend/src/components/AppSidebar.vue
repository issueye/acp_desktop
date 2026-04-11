<script setup lang="ts">
import SessionList from './SessionList.vue';
import type { SavedSession } from '../lib/types';
import { useI18n } from '../lib/i18n';

defineProps<{
  isConnecting: boolean;
  isConnected: boolean;
  savedSessionCount: number;
  selectedAgent: string;
  selectedCwdDisplay: string;
  sessionSearchQuery: string;
  pinnedSessionIds: string[];
  activeSessionId: string;
  connectedSessionIds: string[];
}>();

const emit = defineEmits<{
  openWorkspace: [];
  'update:query': [value: string];
  resume: [session: SavedSession];
  activate: [sessionId: string];
  disconnect: [sessionId?: string];
  'delete': [sessionId: string];
  togglePin: [sessionId: string];
  openSettings: [];
}>();

const { t } = useI18n();
</script>

<template>
  <aside class="sidebar-panel">
    <div class="sidebar-top">
      <button class="sidebar-create" :disabled="isConnecting" @click="emit('openWorkspace')">
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
    </nav>

    <div class="sidebar-context">
      <div class="context-row">
        <span>{{ t('agent.label') }}</span>
        <strong>{{ selectedAgent || t('agent.noneConfigured') }}</strong>
      </div>
      <div class="context-row">
        <span>{{ t('app.workingDirectory') }}</span>
        <strong>{{ selectedCwdDisplay }}</strong>
      </div>
    </div>

    <div class="sidebar-search">
      <input
        :value="sessionSearchQuery"
        type="text"
        class="session-search"
        :placeholder="t('app.searchSessions')"
        @input="emit('update:query', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <div class="session-list-wrap">
      <SessionList
        :query="sessionSearchQuery"
        :pinned-session-ids="pinnedSessionIds"
        :active-session-id="activeSessionId"
        :connected-session-ids="connectedSessionIds"
        @resume="(session) => emit('resume', session)"
        @activate="(sessionId) => emit('activate', sessionId)"
        @disconnect="(sessionId) => emit('disconnect', sessionId)"
        @delete="(sessionId) => emit('delete', sessionId)"
        @toggle-pin="(sessionId) => emit('togglePin', sessionId)"
      />
    </div>

    <div class="sidebar-footer">
      <button class="footer-button" @click="emit('openSettings')">
        {{ t('app.settings') }}
      </button>
      <button v-if="isConnected" class="footer-danger" @click="emit('disconnect')">
        {{ t('app.disconnect') }}
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar-panel {
  width: 320px;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 0.9rem 0.8rem;
  background: var(--bg-sidebar);
  border-right: 1px solid rgba(15, 23, 42, 0.06);
}

.sidebar-top,
.sidebar-nav,
.sidebar-context,
.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.sidebar-create {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.8rem 0.9rem;
  border-radius: 8px;
  border: 1px solid rgba(37, 99, 235, 0.12);
  background: #fffdfa;
  cursor: pointer;
  text-align: left;
}

.sidebar-create:hover:not(:disabled) {
  background: #ffffff;
  border-color: rgba(37, 99, 235, 0.22);
}

.sidebar-create:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.create-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: rgba(37, 99, 235, 0.1);
  color: var(--text-accent);
  font-size: 1rem;
  font-weight: 700;
  flex-shrink: 0;
}

.create-copy {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  min-width: 0;
}

.create-copy strong {
  font-size: 0.88rem;
  color: var(--text-primary);
}

.create-copy span {
  font-size: 0.73rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-nav {
  padding: 0.2rem 0 0.1rem;
}

.nav-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.72rem;
  min-height: 38px;
  padding: 0 0.8rem;
  border-radius: 8px;
  border: 1px solid transparent;
  color: var(--text-secondary);
}

.nav-row strong {
  margin-left: auto;
  font-size: 0.74rem;
  color: var(--text-muted);
}

.nav-row.active {
  background: rgba(255, 255, 255, 0.72);
  border-color: rgba(15, 23, 42, 0.05);
  color: var(--text-primary);
}

.nav-icon {
  width: 18px;
  text-align: center;
  color: var(--text-muted);
}

.nav-label {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.82rem;
  font-weight: 600;
}

.sidebar-context {
  gap: 0.2rem;
  padding: 0.55rem 0.25rem 0.2rem;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
}

.context-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.35rem 0.55rem;
}

.context-row span {
  font-size: 0.72rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.context-row strong {
  font-size: 0.78rem;
  color: var(--text-primary);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
}

.sidebar-search {
  padding: 0.15rem 0 0;
}

.session-search {
  width: 100%;
  height: 40px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: #fffdfa;
  color: var(--text-primary);
  padding: 0 0.9rem;
}

.session-search:focus {
  outline: none;
  border-color: rgba(37, 99, 235, 0.32);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

.session-list-wrap {
  flex: 1;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

.sidebar-footer {
  padding-top: 0.4rem;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
}

.footer-button,
.footer-danger {
  width: 100%;
  min-height: 38px;
  padding: 0 0.8rem;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  text-align: left;
  cursor: pointer;
}

.footer-button:hover {
  background: rgba(255, 255, 255, 0.72);
  border-color: rgba(15, 23, 42, 0.05);
  color: var(--text-primary);
}

.footer-danger {
  color: var(--bg-danger);
}

.footer-danger:hover {
  background: rgba(220, 38, 38, 0.06);
  border-color: rgba(220, 38, 38, 0.12);
}
</style>
