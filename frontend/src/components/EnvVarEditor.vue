<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from '../lib/i18n';

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

function onKeyChange(index: number, event: Event) {
  const input = event.target as HTMLInputElement;
  envVars.value[index].key = input.value;
  emitUpdate();
}

function onValueChange(index: number, event: Event) {
  const input = event.target as HTMLInputElement;
  envVars.value[index].value = input.value;
  emitUpdate();
}

const hasEnvVars = computed(() => envVars.value.length > 0);
</script>

<template>
  <div class="env-var-editor">
    <div class="env-header">
      <span class="env-label">{{ t('env.title') }}</span>
      <button type="button" class="add-env-btn" @click="addEnvVar">
        {{ t('env.add') }}
      </button>
    </div>

    <div v-if="hasEnvVars" class="env-list">
      <div v-for="(env, index) in envVars" :key="index" class="env-row">
        <input
          type="text"
          class="env-key"
          placeholder="KEY"
          :value="env.key"
          @input="onKeyChange(index, $event)"
        />
        <span class="env-equals">=</span>
        <input
          type="text"
          class="env-value"
          :placeholder="t('env.value')"
          :value="env.value"
          @input="onValueChange(index, $event)"
        />
        <button
          type="button"
          class="remove-env-btn"
          @click="removeEnvVar(index)"
          :title="t('env.remove')"
        >
          ✕
        </button>
      </div>
    </div>

    <div v-else class="env-empty">
      {{ t('env.empty') }}
    </div>
  </div>
</template>

<style scoped>
.env-var-editor {
  margin-top: 0.5rem;
  padding: 0.9rem;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid var(--border-color);
}

.env-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.7rem;
}

.env-label {
  font-size: 0.76rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
}

.add-env-btn {
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.14);
  color: var(--text-accent);
  padding: 0.42rem 0.72rem;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
}

.add-env-btn:hover {
  background: rgba(37, 99, 235, 0.14);
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
  padding: 0.65rem;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid var(--border-color);
}

.env-key {
  flex: 0 0 120px;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: #ffffff;
  color: var(--text-primary);
  font-family: monospace;
  font-size: 0.875rem;
}

.env-equals {
  color: var(--text-secondary);
  padding: 0 0.25rem;
}

.env-value {
  flex: 1;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: #ffffff;
  color: var(--text-primary);
  font-family: monospace;
  font-size: 0.875rem;
}

.remove-env-btn {
  width: 32px;
  height: 32px;
  background: rgba(255, 123, 114, 0.08);
  border: 1px solid rgba(255, 123, 114, 0.16);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  font-size: 0.875rem;
}

.remove-env-btn:hover {
  color: #e74c3c;
  background: rgba(220, 38, 38, 0.1);
}

.env-empty {
  font-size: 0.78rem;
  color: var(--text-secondary);
  font-style: italic;
  padding: 0.7rem 0.2rem 0.15rem;
}

.env-key:focus,
.env-value:focus {
  outline: none;
  border-color: rgba(37,99,235,.32);
  box-shadow: 0 0 0 3px rgba(37,99,235,.08);
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
