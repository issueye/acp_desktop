<script setup>
import { computed, ref, watch } from 'vue';
import { useSessionStore } from '../../stores/session';
import { useI18n } from '../../lib/i18n';
import AppConfirmDialog from '../../components/AppConfirmDialog.vue';
import AgentAvatar from '../../components/AgentAvatar.vue';

const props = defineProps({
  query: { type: String, default: '' },
  agentNames: { type: Array, default: () => [] },
  workspaces: { type: Array, default: () => [] },
  selectedAgent: { type: String, default: '' },
  activeWorkspaceId: { type: String, default: '' },
  pinnedSessionIds: { type: Array, default: () => [] },
  activeSessionId: { type: String, default: '' },
  previewSessionId: { type: String, default: '' },
  connectedSessionIds: { type: Array, default: () => [] },
  pendingSessionIds: { type: Array, default: () => [] },
  deletingSessionIds: { type: Array, default: () => [] },
  refreshingWorkspaceIds: { type: Array, default: () => [] },
  isConnecting: { type: Boolean, default: false },
});

const emit = defineEmits([
  'selectAgent',
  'selectWorkspace',
  'refreshWorkspace',
  'deleteWorkspace',
  'resume',
  'activate',
  'disconnect',
  'delete',
  'togglePin',
  'viewSession',
]);

const sessionStore = useSessionStore();
const { t } = useI18n();
const expandedAgents = ref(new Set());
const expandedWorkspaces = ref(new Set());
const showDeleteConfirm = ref(false);
const pendingDeleteSessionId = ref('');

const normalizedQuery = computed(() => props.query.trim().toLowerCase());
const workspaceById = computed(() => new Map(props.workspaces.map((workspace) => [workspace.id, workspace])));

const sortedSessions = computed(() => {
  const pinned = new Set(props.pinnedSessionIds);
  return [...sessionStore.visibleSessions].sort((a, b) => {
    const aPinned = !a.external && pinned.has(a.id);
    const bPinned = !b.external && pinned.has(b.id);
    if (aPinned !== bPinned) {
      return aPinned ? -1 : 1;
    }
    return b.lastUpdated - a.lastUpdated;
  });
});

const tree = computed(() => {
  const agentNames = [
    ...new Set([
      ...props.agentNames,
      ...sortedSessions.value.map((session) => session.agentName).filter(Boolean),
    ]),
  ];
  const query = normalizedQuery.value;

  return agentNames
    .map((agentName) => {
      const workspaceMap = new Map();

      sortedSessions.value
        .filter((session) => session.agentName === agentName)
        .forEach((session) => {
          const workspace = workspaceById.value.get(session.workspaceId) ?? {
            id: session.workspaceId,
            name: getWorkspaceName(session.cwd),
            cwd: session.cwd,
            sessionCount: 0,
          };
          if (!workspaceMap.has(workspace.id)) {
            workspaceMap.set(workspace.id, { ...workspace, sessions: [] });
          }
          workspaceMap.get(workspace.id).sessions.push(session);
        });

      let workspaces = Array.from(workspaceMap.values()).sort((a, b) =>
        String(a.name || a.cwd || '').localeCompare(String(b.name || b.cwd || ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      );

      if (query) {
        workspaces = workspaces
          .map((workspace) => {
            const workspaceMatches = `${workspace.name} ${workspace.cwd}`.toLowerCase().includes(query);
            const sessions = workspace.sessions.filter((session) => {
              const haystack =
                `${session.title} ${session.agentName} ${session.cwd} ${session.path || ''}`.toLowerCase();
              return workspaceMatches || haystack.includes(query);
            });
            return workspaceMatches ? workspace : { ...workspace, sessions };
          })
          .filter((workspace) => {
            const agentMatches = agentName.toLowerCase().includes(query);
            const workspaceMatches = `${workspace.name} ${workspace.cwd}`.toLowerCase().includes(query);
            return agentMatches || workspaceMatches || workspace.sessions.length > 0;
          });
      }

      return {
        name: agentName,
        sessionCount: workspaces.reduce((count, workspace) => count + workspace.sessions.length, 0),
        workspaces,
      };
    })
    .filter((agent) => !query || agent.name.toLowerCase().includes(query) || agent.workspaces.length > 0);
});

function getWorkspaceName(cwd) {
  const normalized = String(cwd || '.').replace(/\\/g, '/').replace(/\/+$/g, '') || '.';
  if (normalized === '.') {
    return '.';
  }
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || normalized;
}

function isAgentOpen(agentName) {
  return expandedAgents.value.has(agentName) || normalizedQuery.value !== '';
}

function isWorkspaceOpen(agentName, workspaceId) {
  const key = `${agentName}:${workspaceId}`;
  return expandedWorkspaces.value.has(key) || normalizedQuery.value !== '';
}

function toggleAgent(agentName) {
  const next = new Set(expandedAgents.value);
  if (next.has(agentName)) {
    next.delete(agentName);
  } else {
    next.add(agentName);
  }
  expandedAgents.value = next;
}

function toggleWorkspace(agentName, workspaceId) {
  const key = `${agentName}:${workspaceId}`;
  const next = new Set(expandedWorkspaces.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  expandedWorkspaces.value = next;
}

function isPinned(sessionId) {
  return props.pinnedSessionIds.includes(sessionId);
}

function isConnectedSession(sessionId) {
  return props.connectedSessionIds.includes(sessionId);
}

function isSelectedSession(sessionId) {
  return props.previewSessionId === sessionId || props.activeSessionId === sessionId;
}

function isPendingSession(sessionId) {
  return props.pendingSessionIds.includes(sessionId);
}

function isDeletingSession(sessionId) {
  return props.deletingSessionIds.includes(sessionId);
}

function isRefreshingWorkspace(workspaceId) {
  return props.refreshingWorkspaceIds.includes(workspaceId);
}

function isRefreshingAgent(agentName) {
  return props.refreshingWorkspaceIds.includes(`agent:${agentName}`);
}

function getConnectActionLabel(session) {
  if (session.external) {
    return t('session.externalScanned');
  }
  if (isDeletingSession(session.id)) {
    return t('session.deleting');
  }
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

function handleAgentClick(agentName) {
  emit('selectAgent', agentName);
}

function handleWorkspaceClick(agentName, workspaceId) {
  emit('selectAgent', agentName);
  emit('selectWorkspace', workspaceId);
}

function handleConnectAction(session, event) {
  event.stopPropagation();
  if (session.external || isPendingSession(session.id) || isDeletingSession(session.id)) {
    return;
  }
  if (isConnectedSession(session.id)) {
    emit('disconnect', session.id);
    return;
  }
  emit('resume', session);
}

function handleSessionClick(session) {
  emit('selectAgent', session.agentName);
  emit('selectWorkspace', session.workspaceId);
  emit('viewSession', session.id);
  if (session.external) {
    return;
  }
  if (isConnectedSession(session.id)) {
    emit('activate', session.id);
  }
}

function handleDelete(sessionId, event) {
  event.stopPropagation();
  const session = sortedSessions.value.find((item) => item.id === sessionId);
  if (session?.external || isPendingSession(sessionId) || isDeletingSession(sessionId)) {
    return;
  }
  pendingDeleteSessionId.value = sessionId;
  showDeleteConfirm.value = true;
}

function handleTogglePin(sessionId, event) {
  event.stopPropagation();
  const session = sortedSessions.value.find((item) => item.id === sessionId);
  if (session?.external || isPendingSession(sessionId) || isDeletingSession(sessionId)) {
    return;
  }
  emit('togglePin', sessionId);
}

function confirmDelete() {
  if (!pendingDeleteSessionId.value) {
    return;
  }
  emit('delete', pendingDeleteSessionId.value);
  pendingDeleteSessionId.value = '';
  showDeleteConfirm.value = false;
}

function cancelDelete() {
  pendingDeleteSessionId.value = '';
  showDeleteConfirm.value = false;
}

const pendingDeleteSession = computed(() =>
  sortedSessions.value.find((session) => session.id === pendingDeleteSessionId.value) ?? null
);

watch(
  [() => props.selectedAgent, () => props.activeWorkspaceId, tree],
  ([agentName, workspaceId, treeItems]) => {
    if (agentName && expandedAgents.value.size === 0) {
      expandedAgents.value = new Set([agentName]);
    }
    if (agentName && workspaceId && expandedWorkspaces.value.size === 0) {
      const hasWorkspace = treeItems
        .find((agent) => agent.name === agentName)
        ?.workspaces.some((workspace) => workspace.id === workspaceId);
      if (hasWorkspace) {
        expandedWorkspaces.value = new Set([`${agentName}:${workspaceId}`]);
      }
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="session-tree">
    <div v-if="tree.length === 0" class="empty-state">
      <p>{{ query ? t('session.noMatching') : t('session.noneSaved') }}</p>
      <p class="hint">{{ query ? t('session.tryAnotherKeyword') : t('session.createHint') }}</p>
    </div>

    <div v-else class="tree-list">
      <section v-for="agent in tree" :key="agent.name" class="tree-agent">
        <button
          class="tree-row tree-row--agent"
          :class="{ active: selectedAgent === agent.name }"
          type="button"
          @click="handleAgentClick(agent.name)"
        >
          <span
            class="tree-chevron"
            :class="{ open: isAgentOpen(agent.name) }"
            role="button"
            tabindex="0"
            :title="isAgentOpen(agent.name) ? t('tree.collapse') : t('tree.expand')"
            :aria-label="isAgentOpen(agent.name) ? t('tree.collapse') : t('tree.expand')"
            @click.stop="toggleAgent(agent.name)"
            @keydown.enter.stop.prevent="toggleAgent(agent.name)"
            @keydown.space.stop.prevent="toggleAgent(agent.name)"
          ></span>
          <AgentAvatar :name="agent.name" :size="15" class="agent-icon" />
          <span class="tree-label">{{ agent.name }}</span>
          <span class="tree-count">{{ agent.sessionCount }}</span>
          <button
            class="agent-refresh ued-icon-btn ued-icon-btn--ghost"
            :class="{ spinning: isRefreshingAgent(agent.name) }"
            :disabled="isConnecting || isRefreshingAgent(agent.name)"
            :title="t('workspace.refresh')"
            :aria-label="t('workspace.refresh')"
            @click.stop="emit('selectAgent', agent.name); emit('refreshWorkspace', '', agent.name)"
          >
            <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M14.1 7.2A5.2 5.2 0 0 0 4.4 5.5L3.1 7.1" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M3 4.5v2.8h2.8" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M3.9 10.8a5.2 5.2 0 0 0 9.7 1.7l1.3-1.6" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M15 13.5v-2.8h-2.8" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </button>

        <div v-if="isAgentOpen(agent.name)" class="tree-children">
          <div v-if="agent.workspaces.length === 0" class="tree-empty">{{ t('workspace.none') }}</div>
          <section
            v-for="workspace in agent.workspaces"
            v-else
            :key="`${agent.name}:${workspace.id}`"
            class="tree-workspace"
          >
            <div
              class="tree-row tree-row--workspace"
              :class="{ active: activeWorkspaceId === workspace.id }"
              :title="workspace.cwd"
              role="button"
              tabindex="0"
              @click="handleWorkspaceClick(agent.name, workspace.id)"
              @keydown.enter.prevent="handleWorkspaceClick(agent.name, workspace.id)"
              @keydown.space.prevent="handleWorkspaceClick(agent.name, workspace.id)"
            >
              <span
                class="tree-chevron"
                :class="{ open: isWorkspaceOpen(agent.name, workspace.id) }"
                role="button"
                tabindex="0"
                :title="isWorkspaceOpen(agent.name, workspace.id) ? t('tree.collapse') : t('tree.expand')"
                :aria-label="isWorkspaceOpen(agent.name, workspace.id) ? t('tree.collapse') : t('tree.expand')"
                @click.stop="toggleWorkspace(agent.name, workspace.id)"
                @keydown.enter.stop.prevent="toggleWorkspace(agent.name, workspace.id)"
                @keydown.space.stop.prevent="toggleWorkspace(agent.name, workspace.id)"
              ></span>
              <span class="workspace-folder" aria-hidden="true"></span>
              <span class="tree-label">
                <strong>{{ workspace.name }}</strong>
                <small v-if="activeWorkspaceId === workspace.id">{{ workspace.cwd }}</small>
              </span>
              <span class="tree-count">{{ workspace.sessions.length }}</span>
              <button
                v-if="workspace.sessionCount === 0"
                class="workspace-delete ued-icon-btn ued-icon-btn--ghost ued-icon-btn--danger"
                :title="t('workspace.remove')"
                :aria-label="t('workspace.remove')"
                @click.stop="emit('deleteWorkspace', workspace.id)"
              >
                ×
              </button>
            </div>

            <div v-if="isWorkspaceOpen(agent.name, workspace.id)" class="tree-sessions">
              <div v-if="workspace.sessions.length === 0" class="tree-empty tree-empty--session">
                {{ t('session.noneSaved') }}
              </div>
              <div
                v-for="session in workspace.sessions"
                v-else
                :key="session.id"
                class="tree-row tree-row--session"
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
                <span class="session-icon" aria-hidden="true"></span>
                <span
                  v-if="activeSessionId === session.id || isConnectedSession(session.id)"
                  class="session-dot"
                  :class="{ active: activeSessionId === session.id }"
                ></span>
                <span class="tree-label">
                  <strong>{{ session.title }}</strong>
                  <small v-if="session.external">{{ t('session.externalScanned') }}</small>
                </span>
                <div v-if="!session.external" class="session-actions">
                  <button
                    class="row-icon-button ued-icon-btn ued-icon-btn--ghost connect-toggle"
                    :class="{ disconnect: isConnectedSession(session.id), busy: isPendingSession(session.id) }"
                    :disabled="isPendingSession(session.id) || isDeletingSession(session.id)"
                    :title="getConnectActionLabel(session)"
                    :aria-label="getConnectActionLabel(session)"
                    @click="(event) => handleConnectAction(session, event)"
                  >
                    <svg class="connect-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M6 5L4.2 3.2a2.4 2.4 0 0 0-3.4 3.4L2.6 8.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M10 11l1.8 1.8a2.4 2.4 0 0 0 3.4-3.4L13.4 7.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M5 11l6-6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                    </svg>
                  </button>
                  <button
                    class="row-icon-button ued-icon-btn ued-icon-btn--ghost"
                    :class="{ pinned: isPinned(session.id) }"
                    :disabled="isPendingSession(session.id) || isDeletingSession(session.id)"
                    :title="isPinned(session.id) ? t('session.unpin') : t('session.pin')"
                    @click="(event) => handleTogglePin(session.id, event)"
                  >
                    ★
                  </button>
                  <button
                    class="row-icon-button ued-icon-btn ued-icon-btn--ghost ued-icon-btn--danger danger"
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
      </section>
    </div>

    <AppConfirmDialog
      :model-value="showDeleteConfirm"
      :title="t('session.delete')"
      :message="
        pendingDeleteSession
          ? `${t('session.confirmDelete')} ${pendingDeleteSession.title}`
          : t('session.confirmDelete')
      "
      :confirm-label="t('session.delete')"
      :cancel-label="t('common.cancel')"
      tone="danger"
      @update:modelValue="(value) => { if (!value) cancelDelete(); }"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<style scoped>
.session-tree {
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tree-list {
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
}

.tree-agent,
.tree-workspace {
  min-width: 0;
}

.tree-children,
.tree-sessions {
  display: flex;
  flex-direction: column;
  gap: 0.02rem;
}

.tree-row {
  width: 100%;
  min-width: 0;
  min-height: 30px;
  display: flex;
  align-items: center;
  gap: 0.38rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--ued-text-secondary);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.tree-row:hover,
.tree-row.active {
  background: rgba(255, 255, 255, 0.52);
  color: var(--ued-text-primary);
}

.tree-row--agent {
  padding: 0.18rem 0.34rem 0.18rem 0.28rem;
  font-weight: 600;
}

.tree-row--workspace {
  padding: 0.18rem 0.28rem 0.18rem 0.78rem;
}

.tree-row--session {
  position: relative;
  min-height: 28px;
  padding: 0.14rem 0.28rem 0.14rem 1.48rem;
}

.tree-row--session.external {
  cursor: default;
}

.tree-chevron {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  position: relative;
}

.tree-chevron::before {
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

.tree-chevron.open::before {
  transform: rotate(45deg);
}

.tree-label {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0;
}

.tree-label strong,
.tree-label small,
.tree-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-label strong {
  font-size: 0.8rem;
  font-weight: 500;
}

.tree-label small {
  margin-top: 1px;
  color: var(--ued-text-muted);
  font-size: 0.66rem;
}

.tree-count {
  flex-shrink: 0;
  min-width: 1.1rem;
  color: var(--ued-text-muted);
  font-size: 0.7rem;
  text-align: right;
}

.agent-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.workspace-folder {
  position: relative;
  width: 15px;
  height: 10px;
  border: 1.2px solid color-mix(in srgb, var(--ued-text-muted) 82%, transparent);
  border-radius: 2px;
  flex-shrink: 0;
}

.workspace-folder::before {
  content: '';
  position: absolute;
  left: 1px;
  top: -4px;
  width: 6px;
  height: 4px;
  border: 1.2px solid color-mix(in srgb, var(--ued-text-muted) 82%, transparent);
  border-bottom: none;
  border-radius: 2px 2px 0 0;
}

.session-icon {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--ued-text-muted) 70%, transparent);
  flex-shrink: 0;
}

.session-dot {
  position: absolute;
  left: 1.68rem;
  bottom: 0.24rem;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--ued-success);
  box-shadow: 0 0 0 2px var(--bg-sidebar, #f2ede3);
}

.session-dot.active {
  background: var(--ued-accent);
}

.agent-refresh,
.workspace-delete {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
}

.agent-refresh svg {
  width: 16px;
  height: 16px;
}

.tree-row--agent:hover .agent-refresh,
.tree-row--agent.active .agent-refresh,
.tree-row--workspace:hover .workspace-delete,
.tree-row--workspace.active .workspace-delete {
  opacity: 1;
  pointer-events: auto;
}

.agent-refresh.spinning svg {
  animation: workspace-refresh-spin 0.82s linear infinite;
}

@keyframes workspace-refresh-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.session-actions {
  display: flex;
  align-items: center;
  gap: 0.14rem;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.tree-row--session:hover .session-actions,
.tree-row--session.active .session-actions {
  opacity: 1;
  pointer-events: auto;
}

.row-icon-button {
  width: 21px;
  height: 21px;
  font-size: 0.76rem;
}

.row-icon-button.pinned {
  color: var(--ued-warning);
}

.row-icon-button.danger:hover,
.row-icon-button.connect-toggle.disconnect {
  color: var(--ued-danger);
}

.row-icon-button.connect-toggle {
  color: var(--ued-accent);
}

.connect-icon {
  width: 14px;
  height: 14px;
}

.empty-state,
.tree-empty {
  padding: 0.5rem;
  color: var(--ued-text-muted);
  font-size: 0.78rem;
}

.empty-state .hint {
  margin-top: 0.3rem;
  font-size: 0.72rem;
}

.tree-empty--session {
  padding: 0.28rem 0.5rem 0.34rem 1.7rem;
  font-size: 0.72rem;
}

@media (max-width: 900px) {
  .session-actions,
  .agent-refresh,
  .workspace-delete {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
