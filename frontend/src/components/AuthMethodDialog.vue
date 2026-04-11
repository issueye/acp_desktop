<script setup lang="ts">
import type { AuthMethod } from '@agentclientprotocol/sdk';
import { useI18n } from '../lib/i18n';
import AppModal from './AppModal.vue';

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
  <AppModal :model-value="true" max-width="520px" @close="emit('cancel')">
    <div class="auth-dialog">
      <div class="dialog-header">
        <h3>{{ t('auth.required') }}</h3>
        <button class="close-btn" @click="emit('cancel')">✕</button>
      </div>
      
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
      
      <div class="dialog-footer">
        <button class="cancel-btn" @click="emit('cancel')">
          {{ t('common.cancel') }}
        </button>
      </div>
    </div>
  </AppModal>
</template>

<style scoped>
.auth-dialog {
  background: #fffdfa;
}

.dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.2rem 1.25rem 1rem;
  border-bottom: 1px solid var(--border-color);
}

.dialog-header h3 {
  margin: 0;
  font-size: 1.2rem;
}

.close-btn {
  width: 38px;
  height: 38px;
  border: 1px solid var(--border-color);
  background: #ffffff;
  border-radius: 8px;
  font-size: 1.15rem;
  cursor: pointer;
  color: var(--text-secondary);
}

.close-btn:hover {
  color: var(--text-primary);
  background: #f8fafc;
  border-color: rgba(148,163,184,.34);
}

.dialog-content {
  padding: 1.15rem 1.25rem;
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

.dialog-footer {
  padding: 1rem 1.25rem 1.2rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
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
