<script setup>
import { ref, watch, computed } from 'vue';
import { useI18n } from '../../lib/i18n';
import UEDButton from '../../components/common/UEDButton.vue';
import UEDCard from '../../components/common/UEDCard.vue';
import UEDInput from '../../components/common/UEDInput.vue';


const props = defineProps({
    modelValue: { type: Object, required: true },
});

const emit = defineEmits(['update:modelValue']);
const { t } = useI18n();

const envVars = ref([]);

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
  const result = {};
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

function removeEnvVar(index) {
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
  border-radius: var(--ued-radius-md);
  background: var(--ued-bg-panel-muted);
  border: 1px solid var(--ued-border-default);
}

.env-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.2rem 0.5rem;
}

.env-label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
}

.env-list {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.env-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0.2rem;
}

::v-deep(.ued-panel-body) {
  width: 100%;
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
