<script setup lang="ts">
import type { AuthMethod } from '@agentclientprotocol/sdk';
import { useI18n } from '../lib/i18n';
import AppDialogShell from './AppDialogShell.vue';

defineProps<{
  authMethods: AuthMethod[];
  agentName: string;
}>();

const emit = defineEmits<{
  (e: 'select', methodId: string): void;
  (e: 'cancel'): void;
}>();
const { t } = useI18n();

function handleSelect(methodId: string) {
  emit('select', methodId);
}
</script>

<template>
  <AppDialogShell
    :model-value="true"
    :title="t('auth.required')"
    max-width="520px"
    @close="emit('cancel')"
  >
    <div class="dialog-content">
      <p class="description">
        {{ t('auth.description', { agent: agentName }) }}
        {{ t('auth.selectMethod') }}
      </p>
      
      <div class="auth-methods">
        <button
          v-for="method in authMethods"
          :key="method.id"
          class="auth-method-btn"
          @click="handleSelect(method.id)"
        >
          <div class="method-info">
            <span class="method-name">{{ method.name }}</span>
            <span v-if="method.description" class="method-desc">
              {{ method.description }}
            </span>
          </div>
          <span class="arrow">→</span>
        </button>
      </div>
    </div>

    <template #footer>
      <button class="cancel-btn" @click="emit('cancel')">
        {{ t('common.cancel') }}
      </button>
    </template>
  </AppDialogShell>
</template>

<style scoped>
.dialog-content {
  padding: 1rem;
}

.description {
  margin: 0 0 1rem 0;
  color: var(--text-secondary);
  font-size: 0.92rem;
  line-height: 1.7;
}

.auth-methods {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.auth-method-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: #ffffff;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  box-shadow: none;
}

.auth-method-btn:hover {
  border-color: rgba(37,99,235,.18);
  background: #f8fafc;
  transform: translateY(-1px);
}

.method-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.method-name {
  font-weight: 600;
  color: var(--text-primary);
}

.method-desc {
  font-size: 0.8rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.arrow {
  font-size: 1.25rem;
  color: var(--text-muted);
  flex-shrink: 0;
}

.auth-method-btn:hover .arrow {
  color: var(--text-accent);
}

.cancel-btn {
  padding: 0.72rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: #ffffff;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.9rem;
}

.cancel-btn:hover {
  background: #f8fafc;
}
</style>
