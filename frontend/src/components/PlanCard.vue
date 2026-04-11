<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../lib/i18n';
import type { PlanEntry } from '../lib/types';

const props = defineProps<{
  entries: PlanEntry[];
}>();

const { t } = useI18n();

const completedCount = computed(
  () => props.entries.filter((entry) => entry.status === 'completed').length
);

function getStatusLabel(status: PlanEntry['status']): string {
  switch (status) {
    case 'completed':
      return t('chat.planStatusCompleted');
    case 'in_progress':
      return t('chat.planStatusInProgress');
    default:
      return t('chat.planStatusPending');
  }
}

function getPriorityLabel(priority: PlanEntry['priority']): string {
  switch (priority) {
    case 'high':
      return t('chat.planPriorityHigh');
    case 'low':
      return t('chat.planPriorityLow');
    default:
      return t('chat.planPriorityMedium');
  }
}
</script>

<template>
  <section class="plan-card">
    <div class="plan-head">
      <div>
        <p class="plan-eyebrow">{{ t('chat.planTitle') }}</p>
        <h4>{{ completedCount }}/{{ entries.length }} {{ t('chat.planCompletedCount') }}</h4>
      </div>
    </div>

    <div class="plan-list">
      <article
        v-for="(entry, index) in entries"
        :key="`${index}-${entry.content}`"
        class="plan-entry"
        :class="[`status-${entry.status}`, `priority-${entry.priority}`]"
      >
        <div class="plan-marker" aria-hidden="true"></div>
        <div class="plan-copy">
          <div class="plan-meta">
            <span class="plan-status">{{ getStatusLabel(entry.status) }}</span>
            <span class="plan-priority">{{ getPriorityLabel(entry.priority) }}</span>
          </div>
          <p>{{ entry.content }}</p>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.plan-card {
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: linear-gradient(180deg, #fffdfa 0%, #faf7f1 100%);
  overflow: hidden;
}

.plan-head {
  padding: 0.9rem 1rem 0.8rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.7);
}

.plan-eyebrow {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.plan-head h4 {
  margin-top: 0.24rem;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.plan-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.9rem 1rem 1rem;
}

.plan-entry {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.plan-marker {
  width: 11px;
  height: 11px;
  margin-top: 0.36rem;
  border-radius: 999px;
  flex-shrink: 0;
  background: #cbd5e1;
  box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.12);
}

.plan-entry.status-in_progress .plan-marker {
  background: #2563eb;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.14);
}

.plan-entry.status-completed .plan-marker {
  background: #059669;
  box-shadow: 0 0 0 4px rgba(5, 150, 105, 0.14);
}

.plan-copy {
  min-width: 0;
  flex: 1;
  padding: 0.75rem 0.85rem;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: #ffffff;
}

.plan-meta {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.plan-status,
.plan-priority {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
}

.plan-status {
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
}

.plan-entry.status-pending .plan-status {
  background: rgba(148, 163, 184, 0.12);
  color: #64748b;
}

.plan-entry.status-completed .plan-status {
  background: rgba(5, 150, 105, 0.1);
  color: #059669;
}

.plan-priority {
  background: rgba(15, 23, 42, 0.06);
  color: var(--text-secondary);
}

.plan-entry.priority-high .plan-priority {
  background: rgba(220, 38, 38, 0.08);
  color: #dc2626;
}

.plan-entry.priority-medium .plan-priority {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}

.plan-entry.priority-low .plan-priority {
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
}

.plan-copy p {
  margin-top: 0.55rem;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
