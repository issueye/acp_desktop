<script setup>
import { computed, ref, watch } from 'vue';
import { useConfigStore } from '../../stores/config';
import { useSessionStore } from '../../stores/session';
import { useI18n } from '../../lib/i18n';
import AppConfirmDialog from '../../components/AppConfirmDialog.vue';
import SessionPreview from '../chat/SessionPreview.vue';
import AgentAvatar from '../../components/AgentAvatar.vue';
import GitCommitPanel from './GitCommitPanel.vue';

const emit = defineEmits(['notify']);

const sessionStore = useSessionStore();
const configStore = useConfigStore();
const { t } = useI18n();

const searchQuery = ref('');
const selectedSessionId = ref('');
const expandedAgents = ref(new Set());
const showDeleteConfirm = ref(false);
const pendingDeleteSessionId = ref('');

const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase());

const sessionsByAgent = computed(() => {
  const agentNames = [
    ...new Set([
      ...configStore.agentNames,
      ...sessionStore.visibleSessions.map((s) => s.agentName).filter(Boolean),
    ]),
  ];
  const query = normalizedQuery.value;

  return agentNames
    .map((agentName) => {
      let sessions = sessionStore.visibleSessions
        .filter((s) => s.agentName === agentName)
        .sort((a, b) => b.lastUpdated - a.lastUpdated);

      if (query) {
        sessions = sessions.filter((s) => {
          const haystack = `${s.title} ${s.agentName} ${s.cwd}`.toLowerCase();
          return haystack.includes(query);
        });
      }

      return { name: agentName, sessions };
    })
    .filter((agent) => {
      if (!query) return agent.sessions.length > 0;
      return agent.name.toLowerCase().includes(query) || agent.sessions.length > 0;
    });
});

const selectedSession = computed(() => {
  if (!selectedSessionId.value) return null;
  return sessionStore.visibleSessions.find((s) => s.id === selectedSessionId.value) ?? null;
});

const selectedCwd = computed(() => selectedSession.value?.cwd || '');

const totalSessionCount = computed(() => sessionStore.visibleSessions.length);

function isAgentOpen(agentName) {
  return expandedAgents.value.has(agentName) || normalizedQuery.value !== '';
}

function toggleAgent(agentName) {
  const next = new Set(expandedAgents.value);
  if (next.has(agentName)) next.delete(agentName);
  else next.add(agentName);
  expandedAgents.value = next;
}

function selectSession(sessionId) {
  selectedSessionId.value = sessionId;
}

function handleDeleteSession(session) {
  pendingDeleteSessionId.value = session.id;
  showDeleteConfirm.value = true;
}

function cancelDelete() {
  pendingDeleteSessionId.value = '';
  showDeleteConfirm.value = false;
}

async function confirmDelete() {
  if (!pendingDeleteSessionId.value) return;
  try {
    await sessionStore.deleteSession(pendingDeleteSessionId.value);
    if (selectedSessionId.value === pendingDeleteSessionId.value) {
      selectedSessionId.value = '';
    }
    emit('notify', { message: t('session.delete'), tone: 'success' });
  } catch (e) {
    emit('notify', { message: e instanceof Error ? e.message : String(e), tone: 'danger' });
  }
  cancelDelete();
}

async function handleGitCommitted(result) {
  if (!selectedSession.value?.id || selectedSession.value.external) {
    return;
  }
  await sessionStore.recordSessionGitCommit(selectedSession.value.id, result);
}

function formatDate(timestamp) {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString();
}

function getSessionSummary(session) {
  return [session.agentName, session.cwd, formatDate(session.lastUpdated)]
    .filter(Boolean)
    .join(' · ');
}

// Auto-expand when search
watch(
  () => normalizedQuery.value,
  (query) => {
    if (query) {
      expandedAgents.value = new Set(sessionsByAgent.value.map((a) => a.name));
    }
  }
);

// Auto-select first session if none selected
watch(
  () => sessionsByAgent.value,
  (agents) => {
    if (!selectedSessionId.value && agents.length > 0) {
      const firstAgent = agents[0];
      if (firstAgent.sessions.length > 0) {
        selectedSessionId.value = firstAgent.sessions[0].id;
      }
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="workspaces-view">
    <div class="sessions-split">
      <!-- Left: Session List -->
      <aside class="sessions-list-pane">
        <div class="sessions-list-head">
          <div>
            <h3>{{ t('session.title') }}</h3>
            <p>{{ totalSessionCount }} {{ t('workspace.sessionUnit') }}</p>
          </div>
        </div>

        <div class="sessions-list-search">
          <input
            v-model="searchQuery"
            type="text"
            class="session-search-input"
            :placeholder="t('app.searchSessions')"
          />
        </div>

        <div v-if="sessionsByAgent.length === 0" class="sessions-empty">
          <strong>{{ t('session.noneSaved') }}</strong>
          <p>{{ searchQuery ? t('session.tryAnotherKeyword') : t('session.createHint') }}</p>
        </div>

        <div v-else class="sessions-tree">
          <section
            v-for="agent in sessionsByAgent"
            :key="agent.name"
            class="sessions-agent"
          >
            <button
              class="sessions-agent-row"
              :class="{ open: isAgentOpen(agent.name) }"
              type="button"
              @click="toggleAgent(agent.name)"
            >
              <span
                class="sessions-chevron"
                :class="{ open: isAgentOpen(agent.name) }"
              />
              <AgentAvatar :name="agent.name" :size="14" class="sessions-agent-icon" />
              <span class="sessions-agent-name">{{ agent.name }}</span>
              <span class="sessions-agent-count">{{ agent.sessions.length }}</span>
            </button>

            <div v-if="isAgentOpen(agent.name)" class="sessions-agent-children">
              <button
                v-for="session in agent.sessions"
                :key="session.id"
                class="sessions-session-row"
                :class="{ active: selectedSessionId === session.id, external: session.external }"
                type="button"
                :title="getSessionSummary(session)"
                @click="selectSession(session.id)"
              >
                <span class="sessions-session-dot" />
                <span class="sessions-session-info">
                  <strong>{{ session.title }}</strong>
                  <small>{{ session.cwd }} · {{ formatDate(session.lastUpdated) }}</small>
                </span>
                <span v-if="session.external" class="sessions-external-badge">
                  {{ t('session.externalScanned') }}
                </span>
              </button>
            </div>
          </section>
        </div>
      </aside>

      <!-- Right: Session Detail -->
      <section class="sessions-detail-pane">
        <template v-if="selectedSession">
          <SessionPreview
            :session="selectedSession"
            :show-connect-button="false"
            @resume="(session) => emit('notify', { message: `${t('session.connect')}: ${session.title}`, tone: 'success' })"
          />
          <GitCommitPanel
            :cwd="selectedCwd"
            @notify="emit('notify', $event)"
            @committed="handleGitCommitted"
          />
        </template>

        <div v-else class="sessions-detail-empty">
          <strong>{{ t('session.noneSaved') }}</strong>
          <p>{{ t('session.createHint') }}</p>
        </div>
      </section>
    </div>

    <AppConfirmDialog
      :model-value="showDeleteConfirm"
      :title="t('session.delete')"
      :message="t('session.confirmDelete')"
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
.workspaces-view {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, var(--ued-bg-window) 0%, var(--ued-bg-canvas) 100%);
}

.sessions-split {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
  gap: 0;
}

.sessions-list-pane {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--ued-border-subtle);
  background: color-mix(in srgb, var(--ued-bg-panel-muted) 44%, var(--ued-bg-panel));
}

.sessions-list-head {
  flex-shrink: 0;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 0.85rem 0.6rem;
  border-bottom: 1px solid var(--ued-border-subtle);
}

.sessions-list-head h3 {
  margin: 0;
  color: var(--ued-text-primary);
  font-size: 0.98rem;
  line-height: 1.25;
}

.sessions-list-head p {
  margin: 0.15rem 0 0;
  color: var(--ued-text-muted);
  font-size: 0.74rem;
}

.sessions-list-search {
  flex-shrink: 0;
  padding: 0.55rem 0.7rem;
  border-bottom: 1px solid var(--ued-border-subtle);
}

.session-search-input {
  width: 100%;
  min-height: 30px;
  border-radius: 6px;
  border: 1px solid var(--ued-border-default);
  background: rgba(255, 255, 255, 0.42);
  color: var(--ued-text-primary);
  padding: 0 0.65rem;
  font-size: 0.8rem;
}

.session-search-input:focus {
  outline: none;
  border-color: var(--ued-accent);
  box-shadow: var(--ued-shadow-focus);
}

.sessions-empty,
.sessions-detail-empty {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 0.5rem;
  min-height: 220px;
  padding: 1rem;
  color: var(--ued-text-muted);
  text-align: center;
}

.sessions-empty strong,
.sessions-detail-empty strong {
  color: var(--ued-text-primary);
}

.sessions-empty p,
.sessions-detail-empty p {
  font-size: 0.8rem;
}

.sessions-tree {
  min-height: 0;
  overflow-y: auto;
  padding: 0.3rem 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.sessions-agent {
  min-width: 0;
}

.sessions-agent-row {
  width: 100%;
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.45rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--ued-text-secondary);
  cursor: pointer;
  text-align: left;
  font-weight: 600;
  font-size: 0.82rem;
  transition: background 0.15s ease, color 0.15s ease;
}

.sessions-agent-row:hover,
.sessions-agent-row.open {
  background: rgba(255, 255, 255, 0.72);
  border-color: var(--ued-border-subtle);
  color: var(--ued-text-primary);
}

.sessions-chevron {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  position: relative;
}

.sessions-chevron::before {
  content: '';
  position: absolute;
  left: 3px;
  top: 2px;
  width: 5px;
  height: 5px;
  border-right: 1.4px solid currentColor;
  border-bottom: 1.4px solid currentColor;
  transform: rotate(-45deg);
  transition: transform 0.14s ease;
}

.sessions-chevron.open::before {
  transform: rotate(45deg);
}

.sessions-agent-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.sessions-agent-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sessions-agent-count {
  flex-shrink: 0;
  min-width: 1.1rem;
  color: var(--ued-text-muted);
  font-size: 0.7rem;
  text-align: right;
  font-weight: 400;
}

.sessions-agent-children {
  display: flex;
  flex-direction: column;
  padding-left: 0.3rem;
}

.sessions-session-row {
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem 0.35rem 0.7rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--ued-text-secondary);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease, color 0.15s ease;
}

.sessions-session-row:hover,
.sessions-session-row.active {
  background: rgba(255, 255, 255, 0.72);
  border-color: var(--ued-border-subtle);
  color: var(--ued-text-primary);
}

.sessions-session-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--ued-text-muted) 70%, transparent);
  flex-shrink: 0;
}

.sessions-session-row.active .sessions-session-dot {
  background: var(--ued-accent);
}

.sessions-session-info {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0.12rem;
}

.sessions-session-info strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.82rem;
  font-weight: 500;
  color: inherit;
}

.sessions-session-info small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ued-text-muted);
  font-size: 0.7rem;
}

.sessions-external-badge {
  flex-shrink: 0;
  padding: 0.06rem 0.3rem;
  border: 1px solid var(--ued-border-default);
  border-radius: 999px;
  color: var(--ued-text-muted);
  background: color-mix(in srgb, var(--ued-bg-panel-muted) 68%, transparent);
  font-size: 0.64rem;
  line-height: 1.3;
}

.sessions-detail-pane {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--ued-bg-window);
}

.sessions-detail-pane :deep(.session-preview) {
  border-radius: 0;
  flex: 1;
  height: auto;
  min-height: 0;
}

@media (max-width: 900px) {
  .sessions-split {
    grid-template-columns: 1fr;
  }

  .sessions-list-pane {
    max-height: 320px;
    border-right: none;
    border-bottom: 1px solid var(--ued-border-subtle);
  }
}
</style>
