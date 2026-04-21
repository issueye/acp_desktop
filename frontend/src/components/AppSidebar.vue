<script setup>
import SessionTree from '../views/chat/SessionTree.vue';
import UEDButton from './common/UEDButton.vue';

import { useI18n } from '../lib/i18n';

const props = defineProps({
    contentVisible: { type: Boolean, required: true },
    isConnecting: { type: Boolean, required: true },
    isConnected: { type: Boolean, required: true },
    isDisconnectingCurrent: { type: Boolean, required: true },
    savedSessionCount: { type: Number, required: true },
    selectedAgent: { type: String, required: true },
    selectedCwdDisplay: { type: String, required: true },
    activeRoute: { type: String, required: true },
    agentNames: { type: Array, required: true },
    workspaces: { type: Array, required: true },
    activeWorkspaceId: { type: String, required: true },
    sessionSearchQuery: { type: String, required: true },
    pinnedSessionIds: { type: Array, required: true },
    activeSessionId: { type: String, required: true },
    connectedSessionIds: { type: Array, required: true },
    pendingSessionIds: { type: Array, required: true },
    deletingSessionIds: { type: Array, required: true },
    refreshingWorkspaceIds: { type: Array, default: () => [] },
});

const emit = defineEmits(['navigateRoute', 'openWorkspace', 'addWorkspace', 'refreshWorkspace', 'selectAgent', 'selectWorkspace', 'deleteWorkspace', 'update:query', 'resume', 'activate', 'disconnect', 'delete', 'togglePin', 'openSettings', 'openAddAgent']);

const { t } = useI18n();
</script>

<template>
  <aside class="sidebar-panel" :class="{ collapsed: !contentVisible }">
    <div class="sidebar-menu-rail" :aria-label="t('app.desktopClient')">
      <div class="menu-rail-top">
        <button
          class="menu-rail-button"
          :class="{ active: activeRoute === 'chat' }"
          :title="t('chat.titleFallback')"
          :aria-label="t('chat.titleFallback')"
          type="button"
          @click="emit('navigateRoute', 'chat')"
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M4 5.8A2.3 2.3 0 0 1 6.3 3.5h7.4A2.3 2.3 0 0 1 16 5.8v4.6a2.3 2.3 0 0 1-2.3 2.3H9.2L5.4 15v-2.3A2.3 2.3 0 0 1 4 10.4V5.8Z" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round" />
            <path d="M7.1 7.4h5.8M7.1 9.7h3.8" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" />
          </svg>
        </button>
        <button
          class="menu-rail-button"
          :class="{ active: activeRoute === 'agents' }"
          :title="t('settings.agents')"
          :aria-label="t('settings.agents')"
          type="button"
          @click="emit('navigateRoute', 'agents')"
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 10.2a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4Z" stroke="currentColor" stroke-width="1.45" />
            <path d="M4.8 16.1c.7-2.3 2.5-3.6 5.2-3.6s4.5 1.3 5.2 3.6" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" />
            <path d="M15.2 5.4l.8-.8M16 8.1h1.2M15.2 10.8l.8.8" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <button
        class="menu-rail-button"
        :class="{ active: activeRoute === 'settings' }"
        :title="t('app.settings')"
        :aria-label="t('app.settings')"
        type="button"
        @click="emit('navigateRoute', 'settings')"
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M8.9 3.6h2.2l.4 1.6c.4.1.8.3 1.2.5l1.4-.8 1.6 1.6-.8 1.4c.2.4.4.8.5 1.2l1.6.4v2.2l-1.6.4c-.1.4-.3.8-.5 1.2l.8 1.4-1.6 1.6-1.4-.8c-.4.2-.8.4-1.2.5l-.4 1.6H8.9l-.4-1.6c-.4-.1-.8-.3-1.2-.5l-1.4.8-1.6-1.6.8-1.4c-.2-.4-.4-.8-.5-1.2L3 11.7V9.5l1.6-.4c.1-.4.3-.8.5-1.2l-.8-1.4 1.6-1.6 1.4.8c.4-.2.8-.4 1.2-.5l.4-1.6Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round" />
          <path d="M10 12.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z" stroke="currentColor" stroke-width="1.25" />
        </svg>
      </button>
    </div>

    <div v-if="contentVisible && activeRoute === 'chat'" class="sidebar-content">
      <div class="sidebar-top">
        <button
          class="sidebar-create ued-icon-btn ued-icon-btn--ghost"
          :disabled="isConnecting"
          :title="t('workspace.add')"
          :aria-label="t('workspace.add')"
          @click="emit('addWorkspace')"
        >
          <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M3 6.2a1.4 1.4 0 0 1 1.4-1.4h3l1.2 1.4h5a1.4 1.4 0 0 1 1.4 1.4v5a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 12.6V6.2Z" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round" />
            <path d="M9 8.1v3.8M7.1 10h3.8" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" />
          </svg>
        </button>
        <button
          class="sidebar-create ued-icon-btn ued-icon-btn--ghost"
          :disabled="isConnecting"
          :title="t('app.newSession')"
          :aria-label="t('app.newSession')"
          @click="emit('openWorkspace')"
        >
          +
        </button>
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

      <div class="session-tree-wrap">
        <SessionTree
          :query="sessionSearchQuery"
          :agent-names="agentNames"
          :workspaces="workspaces"
          :selected-agent="selectedAgent"
          :active-workspace-id="activeWorkspaceId"
          :pinned-session-ids="pinnedSessionIds"
          :active-session-id="activeSessionId"
          :connected-session-ids="connectedSessionIds"
          :pending-session-ids="pendingSessionIds"
          :deleting-session-ids="deletingSessionIds"
          :refreshing-workspace-ids="refreshingWorkspaceIds"
          :is-connecting="isConnecting"
          @select-agent="(agentName) => emit('selectAgent', agentName)"
          @select-workspace="(workspaceId) => emit('selectWorkspace', workspaceId)"
          @refresh-workspace="(workspaceId) => emit('refreshWorkspace', workspaceId)"
          @delete-workspace="(workspaceId) => emit('deleteWorkspace', workspaceId)"
          @resume="(session) => emit('resume', session)"
          @activate="(sessionId) => emit('activate', sessionId)"
          @disconnect="(sessionId) => emit('disconnect', sessionId)"
          @delete="(sessionId) => emit('delete', sessionId)"
          @toggle-pin="(sessionId) => emit('togglePin', sessionId)"
        />
      </div>

      <div class="sidebar-footer">
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
    </div>

    <div v-else-if="contentVisible && activeRoute === 'agents'" class="sidebar-content route-sidebar">
      <div class="route-sidebar__header">
        <span>{{ t('settings.agents') }}</span>
        <button
          class="route-sidebar__add ued-icon-btn ued-icon-btn--ghost"
          :title="t('settings.addAgent')"
          :aria-label="t('settings.addAgent')"
          @click="emit('openAddAgent')"
        >
          +
        </button>
      </div>

      <div v-if="agentNames.length === 0" class="route-sidebar__empty">
        {{ t('settings.noAgents') }}
      </div>

      <button
        v-for="agentName in agentNames"
        v-else
        :key="agentName"
        class="route-sidebar__row"
        type="button"
      >
        <span class="agent-route-icon" aria-hidden="true"></span>
        <span>{{ agentName }}</span>
      </button>
    </div>

    <div v-else-if="contentVisible" class="sidebar-content route-sidebar">
      <div class="route-sidebar__header">
        <span>{{ t('app.settings') }}</span>
      </div>

      <button class="route-sidebar__row active" type="button">
        <svg class="settings-route-icon" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M7.9 3.1h2.2l.3 1.2c.4.1.7.3 1 .5l1.1-.6 1.5 1.5-.6 1.1c.2.3.4.6.5 1l1.2.3v2.2l-1.2.3c-.1.4-.3.7-.5 1l.6 1.1-1.5 1.5-1.1-.6c-.3.2-.6.4-1 .5l-.3 1.2H7.9l-.3-1.2c-.4-.1-.7-.3-1-.5l-1.1.6L4 12.7l.6-1.1c-.2-.3-.4-.6-.5-1l-1.2-.3V8.1l1.2-.3c.1-.4.3-.7.5-1L4 5.7l1.5-1.5 1.1.6c.3-.2.6-.4 1-.5l.3-1.2Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
          <path d="M9 10.8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z" stroke="currentColor" stroke-width="1.2" />
        </svg>
        <span>{{ t('app.settings') }}</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar-panel {
  width: var(--app-sidebar-width);
  min-width: var(--app-sidebar-width);
  display: flex;
  flex-direction: row;
  gap: 0;
  padding: 0;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--ued-border-default);
}

.sidebar-panel.collapsed {
  width: 48px;
  min-width: 48px;
}

.sidebar-menu-rail {
  width: 48px;
  min-width: 48px;
  padding: 0.55rem 0.35rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  border-right: 1px solid var(--ued-border-subtle);
}

.menu-rail-top {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.menu-rail-button {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--ued-text-muted);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.menu-rail-button svg {
  width: 19px;
  height: 19px;
}

.menu-rail-button:hover,
.menu-rail-button.active {
  background: rgba(255, 255, 255, 0.58);
  color: var(--ued-text-primary);
}

.menu-rail-button.active {
  border-color: var(--ued-border-default);
}

.sidebar-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.65rem 0.55rem;
}

.sidebar-top,
.sidebar-footer {
  display: flex;
  gap: 0.35rem;
}

.sidebar-top {
  align-items: center;
  justify-content: flex-end;
}

.sidebar-create {
  width: 28px;
  height: 28px;
  color: var(--ued-text-secondary);
  font-size: 1.05rem;
  font-weight: 500;
}

.sidebar-create svg {
  width: 17px;
  height: 17px;
}

.sidebar-search {
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

.session-tree-wrap {
  flex: 1;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

.sidebar-footer {
  padding-top: 0.25rem;
  border-top: none;
  flex-direction: column;
}

.sidebar-footer-btn {
  min-height: 32px;
  justify-content: flex-start;
  padding: 0 0.55rem;
  border-radius: 6px;
  text-align: left;
  font-size: 0.82rem;
}

.route-sidebar {
  gap: 0.35rem;
}

.route-sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 30px;
  padding: 0 0.35rem 0 0.45rem;
  color: var(--ued-text-muted);
}

.route-sidebar__header span {
  font-size: 0.72rem;
  font-weight: 600;
}

.route-sidebar__add {
  width: 24px;
  height: 24px;
  color: var(--ued-text-secondary);
}

.route-sidebar__empty {
  padding: 0.55rem 0.5rem;
  color: var(--ued-text-muted);
  font-size: 0.78rem;
  line-height: 1.45;
}

.route-sidebar__row {
  width: 100%;
  min-height: 32px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.22rem 0.5rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--ued-text-secondary);
  cursor: default;
  text-align: left;
}

.route-sidebar__row:hover,
.route-sidebar__row.active {
  background: rgba(255, 255, 255, 0.52);
  color: var(--ued-text-primary);
}

.route-sidebar__row span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.82rem;
  font-weight: 500;
}

.agent-route-icon {
  width: 16px;
  height: 16px;
  border: 1.25px solid color-mix(in srgb, var(--ued-text-muted) 82%, transparent);
  border-radius: 50%;
  flex-shrink: 0;
}

.settings-route-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--ued-text-muted);
}
</style>
