<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from '../lib/i18n';
import UEDButton from './common/UEDButton.vue';
import UEDCard from './common/UEDCard.vue';
import UEDInput from './common/UEDInput.vue';

interface EnvVar {
  key: string;
  value: string;
}

const props = defineProps<{
  modelValue: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, string>): void;
}>();
const { t } = useI18n();

const envVars = ref<EnvVar[]>([]);

// Convert Record to array for editing
watch(
  () => props.modelValue,
  (newValue) => {
    envVars.value = Object.entries(newValue || {}).map(([key, value]) => ({
      key,
      value,
    }));
  },
  { immediate: true }
);

// Emit changes when envVars change
function emitUpdate() {
  const result: Record<string, string> = {};
  for (const env of envVars.value) {
    if (env.key.trim()) {
      result[env.key.trim()] = env.value;
    }
  }
  emit('update:modelValue', result);
}

function addEnvVar() {
  envVars.value.push({ key: '', value: '' });
}

function removeEnvVar(index: number) {
  envVars.value.splice(index, 1);
  emitUpdate();
}

const hasEnvVars = computed(() => envVars.value.length > 0);
</script>

<template>
  <div class="env-var-editor">
    <div class="env-header">
      <span class="ued-label env-label">{{ t('env.title') }}</span>
      <UEDButton type="button" variant="ghost" size="sm" @click="addEnvVar">
        {{ t('env.add') }}
      </UEDButton>
    </div>

    <div v-if="hasEnvVars" class="env-list">
      <UEDCard v-for="(env, index) in envVars" :key="index" class="env-row">
        <UEDInput
          class="env-key"
          placeholder="KEY"
          :model-value="env.key"
          @update:modelValue="envVars[index].key = $event; emitUpdate()"
        />
        <span class="env-equals">=</span>
        <UEDInput
          class="env-value"
          :placeholder="t('env.value')"
          :model-value="env.value"
          @update:modelValue="envVars[index].value = $event; emitUpdate()"
        />
        <button type="button" class="remove-env-btn ued-icon-btn ued-icon-btn--danger" @click="removeEnvVar(index)" :title="t('env.remove')">
          ✕
        </button>
      </UEDCard>
    </div>

    <div v-else class="env-empty ued-meta">
      {{ t('env.empty') }}
    </div>
  </div>
</template>

<style scoped>
.env-var-editor {
  margin-top: 0.5rem;
  padding: 0.9rem;
  border-radius: var(--ued-radius-md);
  background: var(--ued-bg-panel-muted);
  border: 1px solid var(--ued-border-default);
}

.env-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.7rem;
}

.env-label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
}

.env-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.env-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.env-key {
  flex: 0 0 120px;
  font-family: monospace;
}

.env-equals {
  color: var(--ued-text-secondary);
  padding: 0 0.25rem;
}

.env-value {
  flex: 1;
  font-family: monospace;
}

.remove-env-btn {
  flex-shrink: 0;
  font-size: 0.875rem;
}

.env-empty {
  font-size: 0.78rem;
  font-style: italic;
  padding: 0.7rem 0.2rem 0.15rem;
}

@media (max-width: 720px) {
  .env-row {
    flex-wrap: wrap;
  }

  .env-key,
  .env-value {
    flex: 1 1 100%;
  }

  .env-equals {
    display: none;
  }
}
</style>
