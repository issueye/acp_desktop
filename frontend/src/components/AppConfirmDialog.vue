<script setup lang="ts">
import AppDialogShell from './AppDialogShell.vue';

withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    tone?: 'default' | 'danger';
  }>(),
  {
    tone: 'default',
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [];
  cancel: [];
}>();

function handleCancel() {
  emit('update:modelValue', false);
  emit('cancel');
}

function handleConfirm() {
  emit('confirm');
  emit('update:modelValue', false);
}
</script>

<template>
  <AppDialogShell
    :model-value="modelValue"
    :title="title"
    max-width="420px"
    @update:modelValue="(value) => emit('update:modelValue', value)"
    @close="handleCancel"
  >
    <div class="confirm-content">
      <p>{{ message }}</p>
    </div>

    <template #footer>
      <button class="secondary-btn" @click="handleCancel">
        {{ cancelLabel }}
      </button>
      <button class="primary-btn" :class="tone" @click="handleConfirm">
        {{ confirmLabel }}
      </button>
    </template>
  </AppDialogShell>
</template>

<style scoped>
.confirm-content {
  padding: 0.9rem 1rem 1rem;
}

.confirm-content p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
  font-size: 0.9rem;
}

.secondary-btn,
.primary-btn {
  min-width: 92px;
  height: 36px;
  padding: 0 0.95rem;
  border-radius: 8px;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.secondary-btn {
  border: 1px solid var(--border-color);
  background: #ffffff;
  color: var(--text-secondary);
}

.secondary-btn:hover {
  background: #f8fafc;
}

.primary-btn {
  border: 1px solid rgba(37, 99, 235, 0.16);
  background: var(--bg-primary);
  color: #ffffff;
}

.primary-btn:hover {
  background: var(--bg-primary-hover);
  transform: translateY(-1px);
}

.primary-btn.danger {
  border-color: rgba(220, 38, 38, 0.14);
  background: var(--bg-danger);
}

.primary-btn.danger:hover {
  background: #b91c1c;
}
</style>
