<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useSessionStore } from '../stores/session';
import type { SavedSession } from '../lib/types';
import { useI18n } from '../lib/i18n';
import AppConfirmDialog from './AppConfirmDialog.vue';

const props = withDefaults(
  defineProps<{
    query?: string;
    pinnedSessionIds?: string[];
    activeSessionId?: string;
    connectedSessionIds?: string[];
    pendingSessionIds?: string[];
    deletingSessionIds?: string[];
  }>(),
  {
    query: '',
    pinnedSessionIds: () => [],
    activeSessionId: '',
    connectedSessionIds: () => [],
    pendingSessionIds: () => [],
    deletingSessionIds: () => [],
  }
);

const emit = defineEmits<{
  resume: [session: SavedSession];
  activate: [sessionId: string];
  disconnect: [sessionId: string];
  delete: [sessionId: string];
  togglePin: [sessionId: string];
}>();

const sessionStore = useSessionStore();
const { t } = useI18n();
const selectedIndex = ref(0);
const showDeleteConfirm = ref(false);
const pendingDeleteSessionId = ref('');
const query = computed(() => props.query ?? '');

const sessions = computed(() => {
  const pinned = new Set(props.pinnedSessionIds);
  const all = [...sessionStore.resumableSessions].sort((a, b) => {
    const aPinned = pinned.has(a.id);
    const bPinned = pinned.has(b.id);
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
    const haystack = `${session.title} ${session.agentName} ${session.cwd}`.toLowerCase();
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

function isPinned(sessionId: string): boolean {
  return props.pinnedSessionIds.includes(sessionId);
}

function isConnectedSession(sessionId: string): boolean {
  return props.connectedSessionIds.includes(sessionId);
}

function isPendingSession(sessionId: string): boolean {
  return props.pendingSessionIds.includes(sessionId);
}

function isDeletingSession(sessionId: string): boolean {
  return props.deletingSessionIds.includes(sessionId);
}

function getSessionSummary(session: SavedSession): string {
  return [session.agentName, session.cwd, new Date(session.lastUpdated).toLocaleString()]
    .filter(Boolean)
    .join(' · ');
}

function handleResume(session: SavedSession) {
  emit('resume', session);
}

function handleActivate(sessionId: string) {
  emit('activate', sessionId);
}

function handleConnectAction(session: SavedSession, event: Event) {
  event.stopPropagation();
  if (isPendingSession(session.id) || isDeletingSession(session.id)) {
    return;
  }
  if (isConnectedSession(session.id)) {
    emit('disconnect', session.id);
    return;
  }
  handleResume(session);
}

function handleDelete(sessionId: string, event: Event) {
  event.stopPropagation();
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

function handleTogglePin(sessionId: string, event: Event) {
  event.stopPropagation();
  if (isPendingSession(sessionId) || isDeletingSession(sessionId)) {
    return;
  }
  emit('togglePin', sessionId);
}

function setSelectedById(sessionId: string) {
  if (isPendingSession(sessionId) || isDeletingSession(sessionId)) {
    return;
  }
  const idx = sessions.value.findIndex((s) => s.id === sessionId);
  if (idx >= 0) {
    selectedIndex.value = idx;
  }
}

function handleKeyDown(event: KeyboardEvent) {
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
          </div>

          <div class="session-actions">
            <button
              class="connect-btn"
              :class="{ disconnect: isConnectedSession(session.id), busy: isPendingSession(session.id) }"
              :disabled="isPendingSession(session.id) || isDeletingSession(session.id)"
              :title="
                isDeletingSession(session.id)
                  ? t('session.deleting')
                  : isConnectedSession(session.id)
                    ? (isPendingSession(session.id) ? t('session.disconnecting') : t('session.disconnect'))
                    : (isPendingSession(session.id) ? t('session.connecting') : t('session.connect'))
              "
              @click="(event) => handleConnectAction(session, event)"
            >
              {{
                isDeletingSession(session.id)
                  ? t('session.deleting')
                  : isConnectedSession(session.id)
                    ? (isPendingSession(session.id) ? t('session.disconnecting') : t('session.disconnect'))
                    : (isPendingSession(session.id) ? t('session.connecting') : t('session.connect'))
              }}
            </button>
            <button
              class="row-icon-button"
              :class="{ pinned: isPinned(session.id) }"
              :disabled="isPendingSession(session.id) || isDeletingSession(session.id)"
              @click.stop="(e) => handleTogglePin(session.id, e)"
              :title="isPinned(session.id) ? t('session.unpin') : t('session.pin')"
            >
              ★
            </button>
            <button
              class="row-icon-button danger"
              :disabled="isPendingSession(session.id) || isDeletingSession(session.id)"
              @click.stop="(e) => handleDelete(session.id, e)"
              :title="isDeletingSession(session.id) ? t('session.deleting') : t('session.delete')"
            >
              {{ isDeletingSession(session.id) ? '...' : '×' }}
            </button>
          </div>
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
  padding: 0.85rem 0.6rem;
  color: var(--text-muted, #999);
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
  gap: 0.1rem;
}

.session-item {
  display: block;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  margin-bottom: 0;
  cursor: pointer;
  background: transparent;
  box-shadow: none;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.session-item:hover,
.session-item.selected {
  background: rgba(255, 255, 255, 0.74);
  border-color: rgba(15, 23, 42, 0.04);
}

.session-item.active {
  background: rgba(255, 255, 255, 0.92);
  border-color: rgba(15, 23, 42, 0.04);
}

.session-item.busy {
  opacity: 0.82;
}

.session-info {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  padding: 0.62rem 0.72rem;
}

.session-main {
  flex: 1;
  min-width: 0;
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
  font-size: 0.92rem;
  color: #5a6472;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-item.active .session-title,
.session-item:hover .session-title,
.session-item.selected .session-title {
  color: #2d3748;
}

.folder-icon {
  position: relative;
  width: 14px;
  height: 10px;
  border: 1.4px solid rgba(112, 120, 132, 0.9);
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
  border: 1.4px solid rgba(112, 120, 132, 0.9);
  border-bottom: none;
  border-radius: 2px 2px 0 0;
  background: transparent;
}

.session-dot {
  position: absolute;
  right: -2px;
  bottom: -1px;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #10b981;
  box-shadow: 0 0 0 2px var(--bg-sidebar, #f2ede3);
}

.session-dot.active {
  background: #2563eb;
}

.session-actions {
  display: flex;
  align-items: center;
  gap: 0.3rem;
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

.connect-btn {
  min-width: 56px;
  height: 28px;
  padding: 0 0.72rem;
  border-radius: 999px;
  border: 1px solid rgba(37, 99, 235, 0.12);
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.connect-btn:hover {
  background: rgba(37, 99, 235, 0.14);
  border-color: rgba(37, 99, 235, 0.2);
}

.connect-btn.disconnect {
  border-color: rgba(220, 38, 38, 0.12);
  background: rgba(220, 38, 38, 0.08);
  color: #dc2626;
}

.connect-btn.disconnect:hover {
  background: rgba(220, 38, 38, 0.14);
  border-color: rgba(220, 38, 38, 0.2);
}

.connect-btn:disabled,
.row-icon-button:disabled {
  opacity: 0.58;
  cursor: not-allowed;
}

.row-icon-button {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #7b8694;
  font-size: 0.86rem;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.row-icon-button:hover {
  background: rgba(15, 23, 42, 0.06);
  color: #374151;
}

.row-icon-button.active {
  color: #2563eb;
}

.row-icon-button.pinned {
  color: #b45309;
}

.row-icon-button.danger:hover {
  background: rgba(220, 38, 38, 0.08);
  color: #dc2626;
}

.row-icon-button:disabled:hover,
.connect-btn:disabled:hover {
  transform: none;
  background: inherit;
  border-color: inherit;
  color: inherit;
}

@media (max-width: 900px) {
  .session-actions {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
