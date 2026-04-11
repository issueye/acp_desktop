<script setup lang="ts">
import { computed } from 'vue';
import PlanCard from './PlanCard.vue';
import type { PlanEntry } from '../lib/types';
import { useI18n } from '../lib/i18n';

const props = defineProps<{
  entries: PlanEntry[];
  collapsed: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

const { t } = useI18n();
const completedCount = computed(
  () => props.entries.filter((entry) => entry.status === 'completed').length
);
</script>

<template>
  <section class="current-plan-panel">
    <div class="plan-panel-wrap">
      <div class="plan-shell">
        <button
          type="button"
          class="plan-toggle"
          :aria-expanded="!collapsed"
          @click="emit('toggle')"
        >
          <div class="plan-toggle-summary">
            <svg class="plan-toggle-mark" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3.5 4.5h5M3.5 8h7M3.5 11.5h4"
                stroke="currentColor"
                stroke-width="1.3"
                stroke-linecap="round"
              />
              <path
                d="M11.25 4.25l1 1 1.75-2"
                stroke="currentColor"
                stroke-width="1.3"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span class="plan-toggle-title">
              {{ t('chat.planSummaryTotal', { count: entries.length }) }}，{{ t('chat.planSummaryCompleted', { count: completedCount }) }}
            </span>
          </div>
          <span class="plan-toggle-icon" :class="{ collapsed }" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none">
              <path
                d="M5.25 9.75L8 7l2.75 2.75"
                stroke="currentColor"
                stroke-width="1.35"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
        </button>

        <div v-if="!collapsed" class="plan-panel-body">
          <PlanCard :entries="entries" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.current-plan-panel {
  padding: 0.7rem 1.2rem 0.45rem;
  background: #fffdfa;
}

.plan-panel-wrap {
  width: min(920px, 100%);
  margin: 0 auto;
}

.plan-shell {
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 10px;
  background: #ffffff;
}

.plan-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 38px;
  padding: 0.6rem 0.8rem;
  border: none;
  border-radius: 10px 10px 0 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease, color 0.15s ease;
}

.plan-toggle:hover {
  background: rgba(15, 23, 42, 0.025);
}

.plan-toggle-summary {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.plan-toggle-mark {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: #94a3b8;
}

.plan-toggle-title {
  font-size: 0.8rem;
  font-weight: 500;
  color: #64748b;
}

.plan-toggle-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  color: #94a3b8;
  transition: transform 0.15s ease;
}

.plan-toggle-icon svg {
  width: 100%;
  height: 100%;
}

.plan-toggle-icon.collapsed {
  transform: rotate(180deg);
}

.plan-panel-body {
  padding: 0.15rem 0.8rem 0.75rem;
  border-top: 1px solid rgba(226, 232, 240, 0.8);
}
</style>
