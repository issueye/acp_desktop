<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useSessionStore } from '../stores/session';
import type { SavedSession } from '../lib/types';
import { useI18n } from '../lib/i18n';

const props = withDefaults(
  defineProps<{
    query?: string;
    pinnedSessionIds?: string[];
    activeSessionId?: string;
  }>(),
  {
    query: '',
    pinnedSessionIds: () => [],
    activeSessionId: '',
  }
);

const emit = defineEmits<{
  resume: [session: SavedSession];
  delete: [sessionId: string];
  togglePin: [sessionId: string];
}>();

const sessionStore = useSessionStore();
const { t } = useI18n();
const selectedIndex = ref(0);
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

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function formatPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return '.';
  if (parts.length === 1) return parts[0];
  return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
}

function handleResume(session: SavedSession) {
  emit('resume', session);
}

function handleDelete(sessionId: string, event: Event) {
  event.stopPropagation();
  if (confirm(t('session.confirmDelete'))) {
    emit('delete', sessionId);
  }
}

function handleTogglePin(sessionId: string, event: Event) {
  event.stopPropagation();
  emit('togglePin', sessionId);
}

function setSelectedById(sessionId: string) {
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
    if (session) {
      handleResume(session);
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
          active: activeSessionId === session.id
        }"
        @click="setSelectedById(session.id)"
        @mouseenter="setSelectedById(session.id)"
      >
        <div class="session-info">
          <div class="session-title-row">
            <span class="session-title">{{ session.title }}</span>
            <span v-if="isPinned(session.id)" class="pinned-badge">{{ t('session.pinned') }}</span>
            <span v-if="session.proxy?.enabled" class="proxy-badge">{{ t('session.proxy') }}</span>
            <div class="session-actions">
              <button
                class="connect-btn"
                @click="handleResume(session)"
              >
                {{ t('session.connect') }}
              </button>
              <button
                class="pin-btn"
                :class="{ pinned: isPinned(session.id) }"
                @click="(e) => handleTogglePin(session.id, e)"
                :title="isPinned(session.id) ? t('session.unpin') : t('session.pin')"
              >
                ★
              </button>
              <button
                class="delete-btn"
                @click="(e) => handleDelete(session.id, e)"
                :title="t('session.delete')"
              >
                ×
              </button>
            </div>
          </div>
          <span class="session-agent">{{ session.agentName }}</span>
          <span class="session-cwd" :title="session.cwd">{{ formatPath(session.cwd) }}</span>
          <span class="session-date">{{ formatDate(session.lastUpdated) }}</span>
        </div>
      </li>
    </ul>
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
  text-align: center;
  padding: 1.4rem 0.75rem;
  color: var(--text-muted, #999);
}

.empty-state .hint {
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
}

.session-item {
  display: block;
  padding: 0.62rem 0.7rem;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 6px;
  margin-bottom: 0.45rem;
  cursor: default;
  transition: background 0.15s, border-color 0.15s;
}

.session-item:hover,
.session-item.selected {
  background: var(--bg-hover, #f5f5f5);
  border-color: rgba(0, 102, 204, 0.35);
}

.session-item.active {
  border-color: rgba(0, 102, 204, 0.7);
  box-shadow: inset 0 0 0 1px rgba(0, 102, 204, 0.18);
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.session-title-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.session-title {
  flex: 1;
  min-width: 0;
  font-weight: 500;
  font-size: 0.86rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pinned-badge {
  flex-shrink: 0;
  font-size: 0.62rem;
  font-weight: 700;
  border-radius: 999px;
  padding: 0.06rem 0.35rem;
  color: #8a5a00;
  background: #ffe7ad;
}

.proxy-badge {
  flex-shrink: 0;
  font-size: 0.62rem;
  font-weight: 700;
  border-radius: 999px;
  padding: 0.06rem 0.35rem;
  color: #005f73;
  background: #cdeff5;
}

.session-agent {
  font-size: 0.72rem;
  color: var(--text-accent, #0066cc);
}

.session-cwd {
  font-size: 0.72rem;
  color: var(--text-secondary, #777);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-date {
  font-size: 0.68rem;
  color: var(--text-muted, #999);
}

.session-actions {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  margin-left: auto;
  flex-shrink: 0;
}

.connect-btn {
  height: 24px;
  padding: 0 0.5rem;
  border: 1px solid var(--border-color, #d0d0d0);
  border-radius: 4px;
  background: var(--bg-main);
  color: var(--text-secondary, #555);
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
}

.connect-btn:hover {
  border-color: var(--text-accent, #0066cc);
  color: var(--text-accent, #0066cc);
  background: rgba(0, 102, 204, 0.06);
}

.pin-btn,
.delete-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-muted, #999);
  font-size: 1rem;
  cursor: pointer;
  border-radius: 4px;
}

.pin-btn.pinned {
  color: #c68400;
}

.pin-btn:hover {
  background: #fff4d5;
  color: #c68400;
}

.delete-btn:hover {
  background: var(--bg-danger, #fee);
  color: var(--text-danger, #c00);
}
</style>
