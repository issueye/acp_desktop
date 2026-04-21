<script setup>
import { computed } from 'vue';
import PlanCard from './PlanCard.vue';

import { useI18n } from '../../lib/i18n';

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
      v-if="collapsed"
      type="button"
      class="plan-rail-toggle"
      :aria-expanded="false"
      :aria-label="panelSummaryLabel"
      :title="panelSummaryLabel"
      @click="emit('toggle')"
    >
      <span class="plan-rail-toggle__icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M14.5 6.5L9 12L14.5 17.5"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <span class="plan-rail-toggle__count">{{ entries.length }}</span>
      <span class="plan-rail-toggle__label">{{ t('chat.currentPlan') }}</span>
    </button>

    <div v-else class="plan-shell">
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
        <button
          type="button"
          class="plan-panel-toggle"
          :aria-expanded="true"
          :aria-label="t('chat.currentPlan')"
          :title="t('chat.currentPlan')"
          @click="emit('toggle')"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M9.5 6.5L15 12L9.5 17.5"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
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
  width: 240px;
  min-width: 240px;
  height: 100%;
  display: flex;
  border-left: 1px solid var(--ued-border-default);
  background: color-mix(in srgb, var(--ued-bg-panel) 92%, white);
  overflow: visible;
  z-index: 4;
  transition:
    width 0.2s ease,
    min-width 0.2s ease,
    background-color 0.16s ease;
}

.current-plan-panel.is-collapsed {
  width: 0;
  min-width: 0;
  border-left: none;
  background: transparent;
}

.plan-shell {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: transparent;
}

.plan-rail-toggle {
  position: absolute;
  top: 50%;
  right: 12px;
  z-index: 9;
  width: 30px;
  height: 60px;
  border: 1px solid color-mix(in srgb, var(--ued-border-default) 82%, white);
  border-radius: 999px;
  background: color-mix(in srgb, var(--ued-bg-panel) 88%, white);
  color: var(--ued-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-shadow: 0 8px 24px rgba(19, 31, 52, 0.08);
  backdrop-filter: blur(10px);
  cursor: pointer;
  transform: translateY(-50%);
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    color 0.16s ease;
}

.plan-rail-toggle:hover {
  color: var(--ued-accent);
  border-color: color-mix(in srgb, var(--ued-accent) 26%, var(--ued-border-default));
  background: color-mix(in srgb, var(--ued-bg-panel) 94%, white);
  box-shadow: 0 10px 28px rgba(19, 31, 52, 0.12);
}

.plan-rail-toggle__icon {
  width: 16px;
  height: 16px;
  display: block;
}

.plan-rail-toggle__icon svg {
  width: 16px;
  height: 16px;
  display: block;
}

.plan-rail-toggle__count {
  position: absolute;
  right: -4px;
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
}

.plan-rail-toggle__label {
  display: none;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  color: var(--ued-text-muted);
}

.plan-panel-header {
  padding: 0.72rem 0.68rem 0.58rem;
  border-bottom: 1px solid var(--ued-border-subtle);
  background: color-mix(in srgb, var(--ued-bg-panel) 86%, white);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
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
}

.plan-panel-toggle {
  width: 28px;
  height: 28px;
  min-width: 28px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ued-border-default);
  border-radius: 999px;
  background: color-mix(in srgb, var(--ued-bg-panel) 92%, white);
  color: var(--ued-text-muted);
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}

.plan-panel-toggle:hover {
  color: var(--ued-accent);
  border-color: color-mix(in srgb, var(--ued-accent) 24%, var(--ued-border-default));
  background: white;
}

.plan-panel-toggle svg {
  width: 14px;
  height: 14px;
  display: block;
}

.plan-panel-body {
  flex: 1;
  min-height: 0;
  padding: 0.3rem 0.66rem 0.72rem;
  overflow: auto;
}

@media (max-width: 1100px) {
  .current-plan-panel {
    width: 240px;
    min-width: 240px;
  }

  .current-plan-panel.is-collapsed {
    width: 0;
    min-width: 0;
  }
}

@media (max-width: 900px) {
  .current-plan-panel {
    width: 100%;
    min-width: 0;
    height: auto;
    border-left: none;
    border-top: 1px solid var(--ued-border-default);
  }

  .current-plan-panel.is-collapsed {
    width: 0;
    min-width: 0;
    min-height: 0;
    border-top: none;
  }

  .plan-rail-toggle {
    top: auto;
    right: 12px;
    bottom: 86px;
    width: 28px;
    height: 54px;
    transform: none;
  }
}
</style>
