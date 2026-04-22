<script setup>
import SvgIcon from '../../components/common/SvgIcon.vue';
import { computed, ref, watch } from 'vue';
import { useSessionStore } from '../../stores/session';

import { useI18n } from '../../lib/i18n';
import AppConfirmDialog from '../../components/AppConfirmDialog.vue';

const props = defineProps({
    query: { type: String, default: '' },
    workspaceId: { type: String, default: '' },
    pinnedSessionIds: { type: Array, default: () => [] },
    activeSessionId: { type: String, default: '' },
    connectedSessionIds: { type: Array, default: () => [] },
    pendingSessionIds: { type: Array, default: () => [] },
    deletingSessionIds: { type: Array, default: () => [] },
});

const emit = defineEmits(['resume', 'activate', 'disconnect', 'delete', 'togglePin']);

const sessionStore = useSessionStore();
const { t } = useI18n();
const selectedIndex = ref(0);
const showDeleteConfirm = ref(false);
const pendingDeleteSessionId = ref('');
const query = computed(() => props.query ?? '');

const sessions = computed(() => {
  const pinned = new Set(props.pinnedSessionIds);
  const workspaceSessions = props.workspaceId
    ? sessionStore.visibleSessions.filter((session) => session.workspaceId === props.workspaceId)
    : sessionStore.visibleSessions;
  const all = [...workspaceSessions].sort((a, b) => {
    const aPinned = !a.external && pinned.has(a.id);
    const bPinned = !b.external && pinned.has(b.id);
    if (aPinned !== bPinned) {
      return aPinned ? -1 : 1;
    }
    return b.lastUpdated - a.lastUpdated;
  });
  const normalizedQuery = query.value.trim().toLowerCase();
  if (!normalizedQuery) {
    return all;
  }
  return all.filter((session) => {
    const haystack =
      `${session.title} ${session.agentName} ${session.cwd} ${session.path || ''}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
});

watch(
  sessions,
  (list) => {
    if (list.length === 0) {
      selectedIndex.value = 0;
      return;
    }
    if (selectedIndex.value >= list.length) {
      selectedIndex.value = list.length - 1;
    }
  },
  { immediate: true }
);

function isPinned(sessionId) {
  return props.pinnedSessionIds.includes(sessionId);
}

function isConnectedSession(sessionId) {
  return props.connectedSessionIds.includes(sessionId);
}

function isPendingSession(sessionId) {
  return props.pendingSessionIds.includes(sessionId);
}

function isDeletingSession(sessionId) {
  return props.deletingSessionIds.includes(sessionId);
}

function getConnectActionLabel(sessionId) {
  const session = sessions.value.find((item) => item.id === sessionId);
  if (session?.external) {
    return t('session.externalScanned');
  }
  if (isDeletingSession(sessionId)) {
    return t('session.deleting');
  }
  if (isConnectedSession(sessionId)) {
    return isPendingSession(sessionId) ? t('session.disconnecting') : t('session.disconnect');
  }
  return isPendingSession(sessionId) ? t('session.connecting') : t('session.connect');
}

function getSessionSummary(session) {
  return [session.agentName, session.cwd, new Date(session.lastUpdated).toLocaleString()]
    .filter(Boolean)
    .join(' · ');
}

function handleResume(session) {
  if (session.external) {
    return;
  }
  emit('resume', session);
}

function handleActivate(sessionId) {
  emit('activate', sessionId);
}

function handleConnectAction(session, event) {
  event.stopPropagation();
  if (session.external) {
    return;
  }
  if (isPendingSession(session.id) || isDeletingSession(session.id)) {
    return;
  }
  if (isConnectedSession(session.id)) {
    emit('disconnect', session.id);
    return;
  }
  handleResume(session);
}

function handleDelete(sessionId, event) {
  event.stopPropagation();
  const session = sessions.value.find((item) => item.id === sessionId);
  if (session?.external) {
    return;
  }
  if (isPendingSession(sessionId) || isDeletingSession(sessionId)) {
    return;
  }
  pendingDeleteSessionId.value = sessionId;
  showDeleteConfirm.value = true;
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
  sessions.value.find((session) => session.id === pendingDeleteSessionId.value) ?? null
);

function handleTogglePin(sessionId, event) {
  event.stopPropagation();
  const session = sessions.value.find((item) => item.id === sessionId);
  if (session?.external) {
    return;
  }
  if (isPendingSession(sessionId) || isDeletingSession(sessionId)) {
    return;
  }
  emit('togglePin', sessionId);
}

function setSelectedById(sessionId) {
  if (isPendingSession(sessionId) || isDeletingSession(sessionId)) {
    return;
  }
  const idx = sessions.value.findIndex((s) => s.id === sessionId);
  if (idx >= 0) {
    selectedIndex.value = idx;
  }
}

function handleKeyDown(event) {
  if (sessions.value.length === 0) {
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    selectedIndex.value = (selectedIndex.value + 1) % sessions.value.length;
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    selectedIndex.value =
      (selectedIndex.value - 1 + sessions.value.length) % sessions.value.length;
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    const session = sessions.value[selectedIndex.value];
    if (session && isConnectedSession(session.id)) {
      handleActivate(session.id);
    }
  }
}
</script>

<template>
  <div class="session-list" tabindex="0" @keydown="handleKeyDown">
    <div v-if="sessions.length === 0" class="empty-state">
      <p>{{ query ? t('session.noMatching') : t('session.noneSaved') }}</p>
      <p class="hint">{{ query ? t('session.tryAnotherKeyword') : t('session.createHint') }}</p>
    </div>

    <ul v-else>
      <li
        v-for="(session, idx) in sessions"
        :key="session.id"
        class="session-item"
        :class="{
          selected: idx === selectedIndex,
          active: activeSessionId === session.id,
          external: session.external,
          busy: isPendingSession(session.id) || isDeletingSession(session.id)
        }"
        :title="getSessionSummary(session)"
        @click="setSelectedById(session.id); if (!isPendingSession(session.id) && !isDeletingSession(session.id) && isConnectedSession(session.id)) handleActivate(session.id)"
        @mouseenter="setSelectedById(session.id)"
      >
        <div class="session-info">
          <span class="session-leading">
            <span class="folder-icon" aria-hidden="true"></span>
            <span
              v-if="activeSessionId === session.id || isConnectedSession(session.id)"
              class="session-dot"
              :class="{ active: activeSessionId === session.id }"
            ></span>
          </span>

          <div class="session-main">
            <span class="session-title">{{ session.title }}</span>
            <span v-if="session.external" class="session-source">{{ t('session.externalScanned') }}</span>
          </div>

          <div v-if="!session.external" class="session-actions">
            <button
              class="row-icon-button ued-icon-btn ued-icon-btn--ghost connect-toggle"
              :class="{ disconnect: isConnectedSession(session.id), busy: isPendingSession(session.id) }"
              :disabled="isPendingSession(session.id) || isDeletingSession(session.id)"
              :title="getConnectActionLabel(session.id)"
              :aria-label="getConnectActionLabel(session.id)"
              @click="(event) => handleConnectAction(session, event)"
            >
              <SvgIcon name="session-list-01" v-if="isConnectedSession(session.id)" class="connect-icon" />
              <SvgIcon name="session-list-02" v-else class="connect-icon" />
            </button>
            <button
              class="row-icon-button ued-icon-btn ued-icon-btn--ghost"
              :class="{ pinned: isPinned(session.id) }"
              :disabled="isPendingSession(session.id) || isDeletingSession(session.id)"
              @click.stop="(e) => handleTogglePin(session.id, e)"
              :title="isPinned(session.id) ? t('session.unpin') : t('session.pin')"
            >
              ★
            </button>
            <button
              class="row-icon-button ued-icon-btn ued-icon-btn--ghost ued-icon-btn--danger danger"
              :disabled="isPendingSession(session.id) || isDeletingSession(session.id)"
              @click.stop="(e) => handleDelete(session.id, e)"
              :title="isDeletingSession(session.id) ? t('session.deleting') : t('session.delete')"
            >
              {{ isDeletingSession(session.id) ? '...' : '×' }}
            </button>
          </div>
          <span v-else class="external-badge">{{ session.agentName }}</span>
        </div>
      </li>
    </ul>

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
.session-list {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  outline: none;
}

.session-list:focus-visible {
  border-radius: 6px;
}

.empty-state {
  text-align: left;
  padding: 0.65rem 0.5rem;
  color: var(--ued-text-muted);
}

.empty-state .hint {
  font-size: 0.78rem;
  margin-top: 0.32rem;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.02rem;
}

.session-item {
  display: block;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  margin-bottom: 0;
  cursor: pointer;
  background: transparent;
  box-shadow: none;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.session-item:hover,
.session-item.selected {
  border-color: transparent;
  background: rgba(255, 255, 255, 0.5);
}

.session-item.active {
  background: rgba(255, 255, 255, 0.68);
  border-color: transparent;
  box-shadow: none;
}

.session-item.busy {
  opacity: 0.82;
}

.session-info {
  display: flex;
  align-items: center;
  gap: 0.46rem;
  min-width: 0;
  padding: 0.16rem 0.5rem;
}

.session-main {
  flex: 1;
  min-width: 0;
}

.session-source {
  display: block;
  margin-top: 1px;
  color: var(--ued-text-muted);
  font-size: 0.68rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-leading {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.session-title {
  display: block;
  min-width: 0;
  font-weight: 500;
  font-size: 0.82rem;
  color: var(--ued-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-item.active .session-title,
.session-item:hover .session-title,
.session-item.selected .session-title {
  color: var(--ued-text-primary);
}

.session-item.external {
  cursor: default;
}

.external-badge {
  max-width: 72px;
  flex-shrink: 0;
  padding: 0.08rem 0.34rem;
  border: 1px solid var(--ued-border-default);
  border-radius: 999px;
  color: var(--ued-text-muted);
  background: color-mix(in srgb, var(--ued-bg-panel-muted) 68%, transparent);
  font-size: 0.66rem;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.folder-icon {
  position: relative;
  width: 14px;
  height: 10px;
  border: 1.25px solid color-mix(in srgb, var(--ued-text-muted) 82%, transparent);
  border-radius: 2px;
  background: transparent;
}

.folder-icon::before {
  content: '';
  position: absolute;
  left: 1px;
  top: -4px;
  width: 6px;
  height: 4px;
  border: 1.25px solid color-mix(in srgb, var(--ued-text-muted) 82%, transparent);
  border-bottom: none;
  border-radius: 2px 2px 0 0;
  background: transparent;
}

.session-dot {
  position: absolute;
  right: -2px;
  bottom: -1px;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--ued-success);
  box-shadow: 0 0 0 2px var(--bg-sidebar, #f2ede3);
}

.session-dot.active {
  background: var(--ued-accent);
}

.session-actions {
  display: flex;
  align-items: center;
  gap: 0.18rem;
  margin-left: auto;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.session-item:hover .session-actions,
.session-item.active .session-actions,
.session-item.selected .session-actions {
  opacity: 1;
  pointer-events: auto;
}

.connect-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.row-icon-button.connect-toggle {
  color: var(--ued-accent);
}

.row-icon-button.connect-toggle:hover {
  background: var(--ued-accent-soft);
  color: var(--ued-accent);
}

.row-icon-button.connect-toggle.disconnect {
  color: var(--ued-danger);
}

.row-icon-button.connect-toggle.disconnect:hover {
  background: var(--ued-danger-soft);
  color: var(--ued-danger);
}

.row-icon-button:disabled {
  opacity: 0.58;
  cursor: not-allowed;
}

.row-icon-button {
  width: 22px;
  height: 22px;
  font-size: 0.78rem;
}

.row-icon-button:hover {
  color: var(--ued-text-primary);
}

.row-icon-button.active {
  color: var(--ued-accent);
}

.row-icon-button.pinned {
  color: var(--ued-warning);
}

.row-icon-button.danger:hover {
  color: var(--ued-danger);
}

.row-icon-button:disabled:hover {
  transform: none;
  color: inherit;
}

@media (max-width: 900px) {
  .session-actions {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
