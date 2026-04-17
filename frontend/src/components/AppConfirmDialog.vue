<script setup lang="ts">
import AppDialogShell from './AppDialogShell.vue';
import UEDButton from './common/UEDButton.vue';

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
      <UEDButton variant="secondary" @click="handleCancel">
        {{ cancelLabel }}
      </UEDButton>
      <UEDButton :variant="tone === 'danger' ? 'danger' : 'primary'" @click="handleConfirm">
        {{ confirmLabel }}
      </UEDButton>
    </template>
  </AppDialogShell>
</template>

<style scoped>
.confirm-content {
  padding: 4px 0 0;
}

.confirm-content p {
  margin: 0;
  color: var(--ued-text-secondary);
  line-height: 1.6;
  font-size: var(--ued-text-body);
}
</style>
