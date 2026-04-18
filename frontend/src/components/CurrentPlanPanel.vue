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
    <button
      type="button"
      class="plan-floating-toggle"
      :aria-expanded="!collapsed"
      :aria-label="collapsed ? panelSummaryLabel : t('chat.currentPlan')"
      :title="collapsed ? panelSummaryLabel : t('chat.currentPlan')"
      @click="emit('toggle')"
    >
      <svg
        class="plan-floating-toggle__icon"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          v-if="collapsed"
          d="M14.5 6.5L9 12L14.5 17.5"
          stroke="currentColor"
          stroke-width="1.9"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          v-else
          d="M9.5 6.5L15 12L9.5 17.5"
          stroke="currentColor"
          stroke-width="1.9"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span v-if="collapsed" class="plan-floating-toggle__badge">
        {{ entries.length }}
      </span>
    </button>

    <div v-if="!collapsed" class="plan-shell">
      <div class="plan-panel-header">
        <div class="plan-panel-summary">
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
          <div class="plan-panel-copy">
            <strong>{{ t('chat.currentPlan') }}</strong>
            <span>{{ panelSummaryLabel }}</span>
          </div>
        </div>
      </div>

      <div class="plan-panel-body">
        <PlanCard :entries="entries" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.current-plan-panel {
  position: relative;
  width: min(380px, calc(100vw - 32px));
  min-height: 60px;
  display: flex;
  justify-content: flex-end;
  pointer-events: none;
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
  pointer-events: auto;
}

.plan-floating-toggle {
  position: absolute;
  top: 50%;
  right: -14px;
  z-index: 2;
  width: 30px;
  height: 60px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--ued-border-default) 82%, white);
  border-radius: 999px;
  background: color-mix(in srgb, var(--ued-bg-panel) 88%, white);
  color: var(--ued-text-muted);
  box-shadow: 0 8px 24px rgba(19, 31, 52, 0.08);
  backdrop-filter: blur(10px);
  cursor: pointer;
  pointer-events: auto;
  transform: translateY(-50%);
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    color 0.16s ease,
    right 0.2s ease;
}

.plan-floating-toggle:hover {
  color: var(--ued-accent);
  border-color: color-mix(in srgb, var(--ued-accent) 26%, var(--ued-border-default));
  background: color-mix(in srgb, var(--ued-bg-panel) 94%, white);
  box-shadow: 0 10px 28px rgba(19, 31, 52, 0.12);
}

.plan-floating-toggle__icon {
  width: 16px;
  height: 16px;
  display: block;
}

.plan-floating-toggle__badge {
  position: absolute;
  left: -4px;
  bottom: -3px;
  min-width: 16px;
  height: 16px;
  padding: 0 0.24rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--ued-accent);
  color: var(--ued-text-on-accent);
  font-size: 0.64rem;
  font-weight: 700;
  box-shadow: 0 0 0 2px var(--ued-bg-window);
}

.plan-panel-header {
  padding: 0.75rem 0.85rem 0.55rem;
  border-bottom: 1px solid var(--ued-border-subtle);
  background: color-mix(in srgb, var(--ued-bg-panel) 84%, white);
}

.plan-panel-summary {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.plan-toggle-mark {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--ued-accent);
}

.plan-panel-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
}

.plan-panel-copy strong {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ued-text-primary);
  line-height: 1.35;
}

.plan-panel-copy span {
  font-size: 0.72rem;
  line-height: 1.45;
  color: var(--ued-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.plan-panel-body {
  padding: 0.35rem 0.8rem 0.75rem;
  max-height: min(40vh, 320px);
  overflow: auto;
}

@media (max-width: 720px) {
  .current-plan-panel {
    width: min(340px, calc(100vw - 24px));
  }

  .plan-shell {
    width: min(340px, calc(100vw - 24px));
  }

  .plan-floating-toggle {
    width: 28px;
    height: 54px;
    right: -12px;
  }
}
</style>
