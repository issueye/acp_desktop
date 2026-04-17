<script setup>
import SessionList from './SessionList.vue';
import UEDButton from './common/UEDButton.vue';

import { useI18n } from '../lib/i18n';

defineProps({
    isConnecting: { type: Boolean, required: true },
    isConnected: { type: Boolean, required: true },
    isDisconnectingCurrent: { type: Boolean, required: true },
    savedSessionCount: { type: Number, required: true },
    selectedAgent: { type: String, required: true },
    selectedCwdDisplay: { type: String, required: true },
    sessionSearchQuery: { type: String, required: true },
    pinnedSessionIds: { type: Array, required: true },
    activeSessionId: { type: String, required: true },
    connectedSessionIds: { type: Array, required: true },
    pendingSessionIds: { type: Array, required: true },
    deletingSessionIds: { type: Array, required: true },
});

const emit = defineEmits(['openWorkspace', 'update:query', 'resume', 'activate', 'disconnect', 'delete', 'togglePin', 'openSettings']);

const { t } = useI18n();
</script>

<template>
  <aside class="sidebar-panel">
    <div class="sidebar-top">
      <UEDButton class="sidebar-create" variant="surface" block :disabled="isConnecting" @click="emit('openWorkspace')">
        <span class="create-icon">+</span>
        <span class="create-copy">
          <strong>{{ t('app.newSession') }}</strong>
        </span>
      </UEDButton>
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
        @input="emit('update:query', ($event.target).value)"
      />
    </div>

    <div class="session-list-wrap">
      <SessionList
        :query="sessionSearchQuery"
        :pinned-session-ids="pinnedSessionIds"
        :active-session-id="activeSessionId"
        :connected-session-ids="connectedSessionIds"
        :pending-session-ids="pendingSessionIds"
        :deleting-session-ids="deletingSessionIds"
        @resume="(session) => emit('resume', session)"
        @activate="(sessionId) => emit('activate', sessionId)"
        @disconnect="(sessionId) => emit('disconnect', sessionId)"
        @delete="(sessionId) => emit('delete', sessionId)"
        @toggle-pin="(sessionId) => emit('togglePin', sessionId)"
      />
    </div>

    <div class="sidebar-footer">
      <UEDButton class="sidebar-footer-btn" variant="ghost" block @click="emit('openSettings')">
        {{ t('app.settings') }}
      </UEDButton>
      <UEDButton
        v-if="isConnected"
        class="sidebar-footer-btn"
        variant="danger-soft"
        block
        :disabled="isDisconnectingCurrent"
        @click="emit('disconnect')"
      >
        {{ isDisconnectingCurrent ? t('session.disconnecting') : t('app.disconnect') }}
      </UEDButton>
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
  border-right: 1px solid var(--ued-border-default);
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
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.8rem;
  min-height: 48px;
  padding: 0.5rem 0.9rem;
  border-radius: var(--ued-radius-md);
  text-align: left;
}

.create-icon {
  width: 34px;
  height: 34px;
  border-radius: var(--ued-radius-md);
  display: grid;
  place-items: center;
  background: var(--ued-accent-soft);
  color: var(--ued-accent);
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
  color: var(--ued-text-primary);
}

.create-copy span {
  font-size: 0.73rem;
  color: var(--ued-text-muted);
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
  border-radius: var(--ued-radius-md);
  border: 1px solid transparent;
  color: var(--ued-text-secondary);
}

.nav-row strong {
  margin-left: auto;
  font-size: 0.74rem;
  color: var(--ued-text-muted);
}

.nav-row.active {
  border-color: var(--ued-border-default);
  background: rgba(255, 255, 255, 0.56);
  color: var(--ued-text-primary);
}

.nav-icon {
  width: 18px;
  text-align: center;
  color: var(--ued-text-muted);
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
  border-top: 1px solid var(--ued-border-subtle);
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
  color: var(--ued-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.context-row strong {
  font-size: 0.78rem;
  color: var(--ued-text-primary);
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
  min-height: var(--ued-control-height-lg);
  border-radius: var(--ued-radius-md);
  border: 1px solid var(--ued-border-default);
  background: var(--ued-bg-panel);
  color: var(--ued-text-primary);
  padding: 0 0.9rem;
}

.session-search:focus {
  outline: none;
  border-color: var(--ued-accent);
  box-shadow: var(--ued-shadow-focus);
}

.session-list-wrap {
  flex: 1;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

.sidebar-footer {
  padding-top: 0.4rem;
  border-top: 1px solid var(--ued-border-subtle);
}

.sidebar-footer-btn {
  min-height: 38px;
  justify-content: flex-start;
  padding: 0 0.8rem;
  border-radius: var(--ued-radius-md);
  text-align: left;
}
</style>
