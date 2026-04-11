<script setup lang="ts">
import type { PermissionRequest } from '../lib/types';
import { useI18n } from '../lib/i18n';
import AppDialogShell from './AppDialogShell.vue';

defineProps<{
  request: PermissionRequest;
}>();

const emit = defineEmits<{
  select: [optionId: string];
  cancel: [];
}>();
const { t } = useI18n();

function handleSelect(optionId: string) {
  emit('select', optionId);
}

function handleCancel() {
  emit('cancel');
}
</script>

<template>
  <AppDialogShell
    :model-value="true"
    :title="t('permission.required')"
    max-width="560px"
    @close="handleCancel"
  >
    <template #header-extra>
      <span class="icon">🔐</span>
    </template>

    <div class="dialog-content">
      <div class="tool-info">
        <span class="tool-title">{{ request.toolCall.title }}</span>
        <span class="tool-kind">{{ request.toolCall.kind }}</span>
      </div>
      
      <div v-if="request.toolCall.locations?.length" class="locations">
        <div 
          v-for="(loc, index) in request.toolCall.locations" 
          :key="index"
          class="location"
        >
          📁 {{ loc.path }}
        </div>
      </div>
    </div>

    <template #footer>
      <button 
        v-for="option in request.options" 
        :key="option.optionId"
        :class="['option-btn', `option-${option.kind}`]"
        @click="handleSelect(option.optionId)"
      >
        {{ option.name }}
      </button>
      <button class="cancel-btn" @click="handleCancel">
        {{ t('common.cancel') }}
      </button>
    </template>
  </AppDialogShell>
</template>

<style scoped>
.dialog-content {
  padding: 1rem;
}

.icon {
  font-size: 1rem;
}

.tool-info {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.95rem 1rem;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid var(--border-color);
}

.tool-title {
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-primary, #102033);
}

.tool-kind {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  font-size: 0.74rem;
  color: var(--text-muted, #486176);
  background: rgba(37, 99, 235, 0.08);
  text-transform: capitalize;
}

.locations {
  margin-top: 0.9rem;
  padding: 0.8rem 0.9rem;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.location {
  font-family: monospace;
  font-size: 0.78rem;
  padding: 0.18rem 0;
  color: var(--text-primary, #333);
  word-break: break-all;
}

.option-btn {
  flex: 1;
  min-width: 120px;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
}

.option-allow_once,
.option-allow_always {
  background: var(--bg-primary);
  color: white;
}

.option-allow_once:hover,
.option-allow_always:hover {
  background: var(--bg-primary-hover);
  transform: translateY(-1px);
}

.option-reject_once,
.option-reject_always {
  background: var(--bg-danger);
  color: white;
}

.option-reject_once:hover,
.option-reject_always:hover {
  background: #b91c1c;
  transform: translateY(-1px);
}

.cancel-btn {
  flex: 1;
  min-width: 120px;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: #ffffff;
  font-size: 0.9rem;
  cursor: pointer;
}

.cancel-btn:hover {
  background: #f8fafc;
  transform: translateY(-1px);
}
</style>
