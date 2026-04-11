<script setup lang="ts">
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
          <button class="toast-close" @click="emit('dismiss', item.id)">×</button>
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
  grid-template-columns: 4px 20px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 0.75rem;
  min-height: 48px;
  padding: 0.7rem 0.75rem 0.7rem 0;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 253, 250, 0.96);
  box-shadow: var(--shadow-md);
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
  background: rgba(239, 246, 255, 0.96);
}

.toast-item.success .toast-accent {
  background: #16a34a;
}

.toast-item.success {
  background: rgba(240, 253, 244, 0.96);
}

.toast-item.warning .toast-accent {
  background: #d97706;
}

.toast-item.warning {
  background: rgba(255, 251, 235, 0.96);
}

.toast-item.danger .toast-accent {
  background: var(--bg-danger);
}

.toast-item.danger {
  background: rgba(254, 242, 242, 0.96);
}

.toast-icon {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--text-accent);
  background: rgba(37, 99, 235, 0.12);
}

.toast-item.success .toast-icon {
  color: #15803d;
  background: rgba(22, 163, 74, 0.12);
}

.toast-item.warning .toast-icon {
  color: #b45309;
  background: rgba(217, 119, 6, 0.12);
}

.toast-item.danger .toast-icon {
  color: var(--bg-danger);
  background: rgba(220, 38, 38, 0.12);
}

.toast-message {
  min-width: 0;
  font-size: 0.84rem;
  line-height: 1.5;
  color: var(--text-primary);
}

.toast-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.toast-close:hover {
  background: rgba(15, 23, 42, 0.06);
  color: var(--text-primary);
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
