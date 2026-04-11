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
  border: 1px solid #cbd5e1;
  background: #ffffff;
  margin-top: 0.1rem;
}

.plan-marker.in-progress {
  border-color: #3b82f6;
  box-shadow: inset 0 0 0 2px #ffffff;
  background: #3b82f6;
}

.plan-marker.completed {
  border-color: #10b981;
  box-shadow: inset 0 0 0 2px #ffffff;
  background: #10b981;
}

.plan-entry {
  display: flex;
  align-items: flex-start;
  gap: 0.42rem;
  padding: 0.28rem 0;
  color: #334155;
}

.plan-index {
  color: #94a3b8;
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
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
