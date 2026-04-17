<script setup>
import { computed } from 'vue';
import PlanCard from './PlanCard.vue';

import { useI18n } from '../lib/i18n';

const props = defineProps({
    entries: { type: Array, required: true },
    collapsed: { type: Boolean, required: true },
});

const emit = defineEmits(['toggle']);

const { t } = useI18n();
const completedCount = computed(
  () => props.entries.filter((entry) => entry.status === 'completed').length
);
const panelSummaryLabel = computed(
  () =>
    `${t('chat.planSummaryTotal', { count: props.entries.length })}，${t('chat.planSummaryCompleted', { count: completedCount.value })}`
);
</script>

<template>
  <section class="current-plan-panel" :class="{ 'is-collapsed': collapsed }">
    <div class="plan-panel-wrap">
      <div class="plan-shell">
        <button
          type="button"
          class="plan-toggle ued-btn ued-btn--ghost"
          :aria-expanded="!collapsed"
          :aria-label="collapsed ? panelSummaryLabel : undefined"
          :title="collapsed ? panelSummaryLabel : undefined"
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
              {{ panelSummaryLabel }}
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
  width: 100%;
  display: flex;
  justify-content: flex-end;
}

.plan-panel-wrap {
  width: 100%;
  display: flex;
  justify-content: flex-end;
}

.current-plan-panel.is-collapsed .plan-panel-wrap {
  width: auto;
}

.plan-shell {
  width: min(380px, calc(100vw - 32px));
  max-width: 100%;
  border: 1px solid var(--ued-border-default);
  border-radius: var(--ued-radius-lg);
  background: color-mix(in srgb, var(--ued-bg-panel) 94%, white);
  box-shadow: var(--ued-shadow-dialog);
  backdrop-filter: blur(14px);
  overflow: hidden;
  transform-origin: right center;
  transition:
    width 0.26s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.26s ease,
    border-color 0.26s ease,
    transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}

.current-plan-panel.is-collapsed .plan-shell {
  width: 48px;
  box-shadow: 0 12px 28px rgba(16, 24, 40, 0.18);
  transform: translateX(2px);
}

.plan-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 42px;
  padding: 0.6rem 0.8rem;
  border-radius: var(--ued-radius-lg) var(--ued-radius-lg) 0 0;
  background: color-mix(in srgb, var(--ued-bg-panel) 70%, white);
  text-align: left;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    padding 0.26s cubic-bezier(0.22, 1, 0.36, 1),
    min-height 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}

.current-plan-panel.is-collapsed .plan-toggle {
  justify-content: center;
  min-height: 48px;
  padding: 0;
}

.plan-toggle:hover {
  background: var(--ued-bg-panel-hover);
}

.plan-toggle-summary {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  transition: gap 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}

.current-plan-panel.is-collapsed .plan-toggle-summary {
  gap: 0;
}

.plan-toggle-mark {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--ued-accent);
  transition:
    color 0.18s ease,
    transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}

.current-plan-panel.is-collapsed .plan-toggle-mark {
  transform: scale(1.02);
}

.plan-toggle-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ued-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition:
    opacity 0.16s ease,
    max-width 0.26s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
  max-width: 260px;
}

.current-plan-panel.is-collapsed .plan-toggle-title {
  opacity: 0;
  max-width: 0;
  transform: translateX(8px);
}

.plan-toggle-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  color: var(--ued-text-muted);
  transition:
    transform 0.18s ease,
    opacity 0.16s ease,
    width 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}

.plan-toggle-icon svg {
  width: 100%;
  height: 100%;
}

.current-plan-panel.is-collapsed .plan-toggle-icon {
  opacity: 0;
  width: 0;
}

.plan-toggle-icon.collapsed {
  transform: rotate(180deg);
}

.plan-panel-body {
  padding: 0.15rem 0.8rem 0.75rem;
  border-top: 1px solid var(--ued-border-subtle);
  max-height: min(40vh, 320px);
  overflow: auto;
}
</style>
