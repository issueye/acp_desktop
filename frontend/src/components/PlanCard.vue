<script setup>
import { ref } from 'vue';

defineProps({
    entries: { type: Array, required: true },
});

const expandedEntries = ref(new Set());

function getMarkerClass(status) {
  if (status === 'completed') return 'completed';
  if (status === 'in_progress') return 'in-progress';
  return 'pending';
}

function getEntryKey(entry, index) {
  return `${index}-${entry.content}`;
}

function isEntryLong(content) {
  if (typeof content !== 'string') return false;
  return content.length > 64 || content.includes('\n');
}

function isEntryExpanded(key) {
  return expandedEntries.value.has(key);
}

function toggleEntry(key) {
  const next = new Set(expandedEntries.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  expandedEntries.value = next;
}
</script>

<template>
  <div class="plan-card">
    <ol class="plan-list">
      <li
        v-for="(entry, index) in entries"
        :key="getEntryKey(entry, index)"
        class="plan-entry"
      >
        <span class="plan-marker" :class="getMarkerClass(entry.status)" aria-hidden="true"></span>
        <span class="plan-index">{{ index + 1 }}.</span>
        <span class="plan-content">
          <span
            class="plan-text"
            :class="{
              'is-collapsible': isEntryLong(entry.content),
              'is-expanded': isEntryExpanded(getEntryKey(entry, index)),
            }"
          >
            {{ entry.content }}
          </span>
          <button
            v-if="isEntryLong(entry.content)"
            type="button"
            class="plan-entry-toggle"
            @click="toggleEntry(getEntryKey(entry, index))"
          >
            {{ isEntryExpanded(getEntryKey(entry, index)) ? '收起' : '展开' }}
          </button>
        </span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.plan-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.plan-card {
  display: block;
}

.plan-marker {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  flex-shrink: 0;
  border: 1px solid var(--ued-border-strong);
  background: var(--ued-bg-panel);
  margin-top: 0.1rem;
}

.plan-marker.in-progress {
  border-color: var(--ued-accent);
  box-shadow: inset 0 0 0 2px var(--ued-bg-panel);
  background: var(--ued-accent);
}

.plan-marker.completed {
  border-color: var(--ued-success);
  box-shadow: inset 0 0 0 2px var(--ued-bg-panel);
  background: var(--ued-success);
}

.plan-entry {
  display: flex;
  align-items: center;
  gap: 0.42rem;
  padding: 0.28rem 0;
  color: var(--ued-text-primary);
}

.plan-index {
  color: var(--ued-text-muted);
  font-size: 0.82rem;
  line-height: 1.55;
  flex-shrink: 0;
  min-width: 1.1rem;
  text-align: right;
}

.plan-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.16rem;
}

.plan-text {
  width: 100%;
  line-height: 1.55;
  font-size: 0.84rem;
  color: var(--ued-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.plan-text.is-collapsible:not(.is-expanded) {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}

.plan-text.is-expanded {
  padding: 0.42rem 0.5rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--ued-bg-panel-muted) 76%, white);
  border: 1px solid color-mix(in srgb, var(--ued-border-subtle) 58%, transparent);
}

.plan-entry-toggle {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--ued-accent);
  font-size: 0.72rem;
  line-height: 1.4;
  font-weight: 500;
  cursor: pointer;
}

.plan-entry-toggle:hover {
  color: var(--ued-accent-hover);
  text-decoration: underline;
}
</style>
