<script setup lang="ts">
import PlanCard from './PlanCard.vue';
import type { PlanEntry } from '../lib/types';
import { useI18n } from '../lib/i18n';

defineProps<{
  entries: PlanEntry[];
  collapsed: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

const { t } = useI18n();
</script>

<template>
  <section class="current-plan-panel">
    <button
      type="button"
      class="plan-toggle"
      :aria-expanded="!collapsed"
      @click="emit('toggle')"
    >
      <div class="plan-toggle-copy">
        <span class="plan-toggle-eyebrow">{{ t('chat.currentPlan') }}</span>
        <strong>{{ entries.length }} {{ t('chat.planItems') }}</strong>
      </div>
      <span class="plan-toggle-action">
        {{ collapsed ? t('chat.planToggleShow') : t('chat.planToggleHide') }}
      </span>
      <span class="plan-toggle-icon" :class="{ collapsed }" aria-hidden="true">⌃</span>
    </button>

    <div v-if="!collapsed" class="plan-panel-body">
      <PlanCard :entries="entries" />
    </div>
  </section>
</template>

<style scoped>
.current-plan-panel {
  padding: 0 1.2rem 0.9rem;
  background: linear-gradient(180deg, rgba(255, 253, 250, 0.96) 0%, rgba(252, 250, 246, 0.98) 100%);
  border-top: 1px solid rgba(15, 23, 42, 0.06);
}

.plan-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 0.95rem;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 10px;
  background: #ffffff;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.plan-toggle:hover {
  border-color: rgba(37, 99, 235, 0.16);
  background: #fffdfa;
}

.plan-toggle-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.plan-toggle-eyebrow {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.plan-toggle-copy strong {
  color: var(--text-primary);
  font-size: 0.94rem;
}

.plan-toggle-action {
  margin-left: auto;
  font-size: 0.8rem;
  color: var(--text-accent);
  font-weight: 600;
}

.plan-toggle-icon {
  flex-shrink: 0;
  color: var(--text-muted);
  transition: transform 0.15s ease;
}

.plan-toggle-icon.collapsed {
  transform: rotate(180deg);
}

.plan-panel-body {
  margin-top: 0.7rem;
}
</style>
