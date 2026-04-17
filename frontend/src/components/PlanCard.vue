<script setup lang="ts">
import type { PlanEntry } from '../lib/types';

defineProps<{
  entries: PlanEntry[];
}>();

function getMarkerClass(status: PlanEntry['status']): string {
  if (status === 'completed') return 'completed';
  if (status === 'in_progress') return 'in-progress';
  return 'pending';
}
</script>

<template>
  <div class="plan-card">
    <ol class="plan-list">
      <li
        v-for="(entry, index) in entries"
        :key="`${index}-${entry.content}`"
        class="plan-entry"
      >
        <span class="plan-marker" :class="getMarkerClass(entry.status)" aria-hidden="true"></span>
        <span class="plan-index">{{ index + 1 }}.</span>
        <span class="plan-text">{{ entry.content }}</span>
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
  align-items: flex-start;
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

.plan-text {
  flex: 1;
  line-height: 1.55;
  font-size: 0.84rem;
  color: var(--ued-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
