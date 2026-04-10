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
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
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
        @dblclick="handleResume(session)"
      >
        <div class="session-info">
          <div class="session-main">
            <div class="title-stack">
              <div class="session-title-line">
                <span class="session-title">{{ session.title }}</span>
                <span v-if="activeSessionId === session.id" class="live-badge">{{ t('session.activeNow') }}</span>
                <span v-if="isPinned(session.id)" class="pinned-badge">{{ t('session.pinned') }}</span>
                <span v-if="session.proxy?.enabled" class="proxy-badge">{{ t('session.proxy') }}</span>
              </div>
              <div class="session-meta-row">
                <span class="session-agent">{{ session.agentName }}</span>
                <span class="meta-separator">/</span>
                <span class="session-cwd" :title="session.cwd">{{ formatPath(session.cwd) }}</span>
              </div>
            </div>
            <div class="session-side">
              <span class="session-date">{{ formatDate(session.lastUpdated) }}</span>
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
          </div>
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
  padding: 1.6rem 0.85rem;
  color: var(--text-muted, #999);
}

.empty-state .hint {
  font-size: 0.82rem;
  margin-top: 0.5rem;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.session-item {
  display: block;
  padding: 0.72rem 0.78rem;
  border: 1px solid transparent;
  border-radius: 8px;
  margin-bottom: 0;
  cursor: default;
  background: transparent;
  box-shadow: none;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
}

.session-item:hover,
.session-item.selected {
  background: rgba(255, 255, 255, 0.76);
  border-color: rgba(15, 23, 42, 0.06);
}

.session-item.active {
  background: #ffffff;
  border-color: rgba(37, 99, 235, 0.18);
  box-shadow: inset 3px 0 0 rgba(37, 99, 235, 0.95);
}

.session-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.session-main {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.title-stack {
  flex: 1;
  min-width: 0;
}

.session-title-line {
  display: flex;
  align-items: center;
  gap: 0.36rem;
  min-width: 0;
}

.session-title {
  min-width: 0;
  font-weight: 600;
  font-size: 0.88rem;
  color: var(--text-primary, #102033);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-meta-row {
  display: flex;
  align-items: center;
  gap: 0.36rem;
  margin-top: 0.22rem;
  flex-wrap: wrap;
}

.pinned-badge {
  flex-shrink: 0;
  font-size: 0.59rem;
  font-weight: 700;
  border-radius: 999px;
  padding: 0.12rem 0.34rem;
  color: #b45309;
  background: rgba(245, 158, 11, 0.12);
}

.proxy-badge {
  flex-shrink: 0;
  font-size: 0.59rem;
  font-weight: 700;
  border-radius: 999px;
  padding: 0.12rem 0.34rem;
  color: #0369a1;
  background: rgba(14, 165, 233, 0.12);
}

.live-badge {
  flex-shrink: 0;
  font-size: 0.59rem;
  font-weight: 700;
  border-radius: 999px;
  padding: 0.12rem 0.34rem;
  color: #2563eb;
  background: rgba(37, 99, 235, 0.1);
}

.session-agent {
  font-size: 0.72rem;
  color: var(--text-accent, #2563eb);
  font-weight: 600;
}

.session-cwd {
  max-width: 100%;
  font-size: 0.72rem;
  color: var(--text-secondary, #486176);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta-separator {
  color: var(--text-muted, #94a3b8);
  font-size: 0.7rem;
}

.session-date {
  font-size: 0.67rem;
  color: var(--text-muted, #6d8295);
  white-space: nowrap;
}

.session-side {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-left: auto;
  flex-shrink: 0;
}

.session-actions {
  display: flex;
  align-items: center;
  gap: 0.18rem;
}

.connect-btn {
  height: 28px;
  padding: 0 0.62rem;
  border: 1px solid rgba(37, 99, 235, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--text-accent, #2563eb);
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
}

.connect-btn:hover {
  border-color: rgba(37, 99, 235, 0.24);
  background: #ffffff;
}

.pin-btn,
.delete-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted, #999);
  font-size: 0.92rem;
  cursor: pointer;
  border-radius: 999px;
}

.pin-btn.pinned {
  color: #c68400;
}

.pin-btn:hover {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}

.delete-btn:hover {
  background: rgba(220, 38, 38, 0.08);
  color: var(--bg-danger, #dc2626);
}

@media (max-width: 900px) {
  .session-main {
    align-items: flex-start;
    flex-direction: column;
  }

  .session-side {
    width: 100%;
    justify-content: space-between;
    margin-left: 0;
  }
}
</style>
