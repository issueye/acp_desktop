<script setup>

import { useI18n } from '../lib/i18n';
import AppDialogShell from './AppDialogShell.vue';
import UEDButton from './common/UEDButton.vue';
import UEDCard from './common/UEDCard.vue';

defineProps({
    authMethods: { type: Array, required: true },
    agentName: { type: String, required: true },
});

const emit = defineEmits(['select', 'cancel']);
const { t } = useI18n();

function handleSelect(methodId) {
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
      <p class="description ued-body">
        {{ t('auth.description', { agent: agentName }) }}
        {{ t('auth.selectMethod') }}
      </p>
      
      <div class="auth-methods">
        <UEDCard
          v-for="method in authMethods"
          :key="method.id"
          tag="button"
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
        </UEDCard>
      </div>
    </div>

    <template #footer>
      <UEDButton variant="secondary" @click="emit('cancel')">
        {{ t('common.cancel') }}
      </UEDButton>
    </template>
  </AppDialogShell>
</template>

<style scoped>
.description {
  margin: 0 0 1rem 0;
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
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.auth-method-btn:hover {
  border-color: color-mix(in srgb, var(--ued-accent) 18%, var(--ued-border-default));
  background: var(--ued-bg-panel-hover);
  transform: translateY(-1px);
}

.method-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.method-name {
  font-weight: 600;
  color: var(--ued-text-primary);
}

.method-desc {
  font-size: 0.8rem;
  color: var(--ued-text-muted);
  line-height: 1.5;
}

.arrow {
  font-size: 1.25rem;
  color: var(--ued-text-muted);
  flex-shrink: 0;
}

.auth-method-btn:hover .arrow {
  color: var(--ued-accent);
}
</style>
