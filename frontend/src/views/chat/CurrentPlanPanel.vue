<script setup>
import SvgIcon from '../../components/common/SvgIcon.vue';
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
      v-if="!collapsed"
      type="button"
      class="plan-floating-toggle plan-floating-toggle--collapse"
      :aria-expanded="true"
      :aria-label="t('chat.currentPlan')"
      :title="t('chat.currentPlan')"
      @click="emit('toggle')"
    >
      <SvgIcon name="current-plan-panel-03" />
    </button>

    <div class="plan-shell">
      <div class="plan-panel-header">
        <div class="plan-panel-summary">
          <SvgIcon name="current-plan-panel-02" class="plan-toggle-mark" />
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

    <button
      v-if="collapsed"
      type="button"
      class="plan-floating-toggle plan-floating-toggle--expand"
      :aria-expanded="false"
      :aria-label="panelSummaryLabel"
      :title="panelSummaryLabel"
      @click="emit('toggle')"
    >
      <span class="plan-floating-toggle__icon" aria-hidden="true">
        <SvgIcon name="current-plan-panel-01" />
      </span>
      <span class="plan-floating-toggle__count">{{ entries.length }}</span>
    </button>
  </section>
</template>

<style scoped>
.current-plan-panel {
  --plan-panel-width: 260px;
  position: absolute;
  top: 0;
  right: 0;
  width: var(--plan-panel-width);
  height: 100%;
  display: flex;
  justify-content: flex-end;
  pointer-events: none;
  overflow: visible;
  z-index: 8;
}

.current-plan-panel.is-collapsed {
  width: 0;
}

.plan-shell {
  width: var(--plan-panel-width);
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  border-left: 1px solid var(--ued-border-default);
  background: color-mix(in srgb, var(--ued-bg-panel) 92%, white);
  box-shadow: -10px 0 28px rgba(19, 31, 52, 0.08);
  transform: translateX(0);
  opacity: 1;
  transition:
    transform 0.22s ease,
    opacity 0.18s ease,
    background-color 0.16s ease;
}

.current-plan-panel.is-collapsed .plan-shell {
  transform: translateX(100%);
  opacity: 0;
  pointer-events: none;
}

.plan-floating-toggle {
  position: absolute;
  top: 50%;
  z-index: 10;
  width: 32px;
  height: 64px;
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
  pointer-events: auto;
  transform: translateY(-50%);
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    color 0.16s ease,
    opacity 0.16s ease,
    left 0.22s ease,
    right 0.22s ease;
}

.plan-floating-toggle:hover {
  color: var(--ued-accent);
  border-color: color-mix(in srgb, var(--ued-accent) 26%, var(--ued-border-default));
  background: color-mix(in srgb, var(--ued-bg-panel) 94%, white);
  box-shadow: 0 10px 28px rgba(19, 31, 52, 0.12);
}

.plan-floating-toggle--collapse {
  left: -16px;
}

.plan-floating-toggle--expand {
  right: 8px;
}

.plan-floating-toggle__icon {
  width: 16px;
  height: 16px;
  display: block;
}

.plan-floating-toggle__icon .svg-icon {
  width: 16px;
  height: 16px;
  display: block;
}

.plan-floating-toggle__count {
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

.plan-panel-body {
  flex: 1;
  min-height: 0;
  padding: 0.3rem 0.66rem 0.72rem;
  overflow: auto;
}

@media (max-width: 1100px) {
  .current-plan-panel {
    --plan-panel-width: 240px;
  }
}

@media (max-width: 900px) {
  .current-plan-panel {
    --plan-panel-width: min(300px, calc(100vw - 24px));
    height: calc(100% - 12px);
  }

  .plan-shell {
    border-left: 1px solid var(--ued-border-default);
    border-top: 1px solid var(--ued-border-default);
    border-top-left-radius: var(--ued-radius-md);
    border-bottom-left-radius: var(--ued-radius-md);
  }
}
</style>
