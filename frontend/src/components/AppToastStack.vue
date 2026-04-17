<script setup lang="ts">
import UEDStatus from './common/UEDStatus.vue';

export interface AppToastItem {
  id: string;
  message: string;
  tone?: 'success' | 'info' | 'warning' | 'danger';
}

defineProps<{
  items: AppToastItem[];
}>();

const emit = defineEmits<{
  dismiss: [id: string];
}>();
</script>

<template>
  <Teleport to="body">
    <div v-if="items.length > 0" class="toast-stack">
      <TransitionGroup name="toast">
        <div
          v-for="item in items"
          :key="item.id"
          class="toast-item"
          :class="item.tone || 'success'"
        >
          <span class="toast-accent"></span>
          <span class="toast-icon">
            {{
              item.tone === 'danger'
                ? '!'
                : item.tone === 'warning'
                  ? 'i'
                  : item.tone === 'info'
                    ? 'i'
                    : '✓'
            }}
          </span>
          <span class="toast-message">{{ item.message }}</span>
          <UEDStatus class="toast-tone" kind="badge" :tone="item.tone === 'danger' ? 'error' : item.tone || 'success'">
            {{ item.tone || 'success' }}
          </UEDStatus>
          <button class="toast-close ued-icon-btn" @click="emit('dismiss', item.id)">×</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 1200;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  width: min(320px, calc(100vw - 24px));
}

.toast-item {
  display: grid;
  grid-template-columns: 4px 20px minmax(0, 1fr) auto 32px;
  align-items: center;
  gap: 0.75rem;
  min-height: 48px;
  padding: 0.7rem 0.75rem 0.7rem 0;
  border-radius: var(--ued-radius-md);
  border: 1px solid var(--ued-border-default);
  background: color-mix(in srgb, var(--ued-bg-panel) 92%, white);
  box-shadow: var(--ued-shadow-panel);
  backdrop-filter: blur(10px);
}

.toast-accent {
  align-self: stretch;
  border-radius: 8px 0 0 8px;
  background: var(--bg-primary);
}

.toast-item.info .toast-accent {
  background: var(--bg-primary);
}

.toast-item.info {
  background: color-mix(in srgb, var(--ued-info-soft) 90%, white);
}

.toast-item.success .toast-accent {
  background: #16a34a;
}

.toast-item.success {
  background: color-mix(in srgb, var(--ued-success-soft) 90%, white);
}

.toast-item.warning .toast-accent {
  background: #d97706;
}

.toast-item.warning {
  background: color-mix(in srgb, var(--ued-warning-soft) 90%, white);
}

.toast-item.danger .toast-accent {
  background: var(--bg-danger);
}

.toast-item.danger {
  background: color-mix(in srgb, var(--ued-danger-soft) 92%, white);
}

.toast-icon {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--ued-accent);
  background: color-mix(in srgb, var(--ued-accent) 12%, transparent);
}

.toast-item.success .toast-icon {
  color: var(--ued-success);
  background: color-mix(in srgb, var(--ued-success) 12%, transparent);
}

.toast-item.warning .toast-icon {
  color: var(--ued-warning);
  background: color-mix(in srgb, var(--ued-warning) 12%, transparent);
}

.toast-item.danger .toast-icon {
  color: var(--ued-danger);
  background: color-mix(in srgb, var(--ued-danger) 12%, transparent);
}

.toast-message {
  min-width: 0;
  font-size: 0.84rem;
  line-height: 1.5;
  color: var(--ued-text-primary);
}

.toast-close {
  font-size: 0.95rem;
}

.toast-tone {
  text-transform: capitalize;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
