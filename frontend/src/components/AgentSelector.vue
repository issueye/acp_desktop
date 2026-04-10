<script setup lang="ts">
import { computed, watch } from 'vue';
import { useConfigStore } from '../stores/config';
import { useI18n } from '../lib/i18n';

const emit = defineEmits<{
  select: [agentName: string];
}>();

const configStore = useConfigStore();
const { t } = useI18n();

const selectedAgent = defineModel<string>('selected', { default: '' });

const agents = computed(() => configStore.agentNames);
const hasAgents = computed(() => configStore.hasAgents);
const configPath = computed(() => configStore.configPath);

// Auto-select first agent when agents are available and none selected
watch(agents, (newAgents) => {
  if (newAgents.length > 0 && !selectedAgent.value) {
    selectedAgent.value = newAgents[0];
    emit('select', newAgents[0]);
  }
}, { immediate: true });

function handleSelect(event: Event) {
  const target = event.target as HTMLSelectElement;
  selectedAgent.value = target.value;
  if (target.value) {
    emit('select', target.value);
  }
}
</script>

<template>
  <div class="agent-selector">
    <label for="agent-select">{{ t('agent.label') }}</label>
    <select 
      id="agent-select" 
      :value="selectedAgent"
      @change="handleSelect"
      :disabled="!hasAgents"
    >
      <option value="" disabled>
        {{ hasAgents ? t('agent.select') : t('agent.noneConfigured') }}
      </option>
      <option v-for="agent in agents" :key="agent" :value="agent">
        {{ agent }}
      </option>
    </select>
    
    <div v-if="!hasAgents" class="config-hint">
      <p>{{ t('agent.noneFound') }}</p>
      <code>{{ configPath }}</code>
    </div>
  </div>
</template>

<style scoped>
.agent-selector {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

label {
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary, #486176);
}

select {
  height: 46px;
  padding: 0 0.9rem;
  border: 1px solid rgba(121, 151, 176, 0.2);
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  background: #ffffff;
  color: var(--text-primary, #102033);
  box-shadow: none;
}

select:focus {
  outline: none;
  border-color: rgba(37,99,235,.32);
  box-shadow: 0 0 0 3px rgba(37,99,235,.08);
}

select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.config-hint {
  margin-top: 0.5rem;
  padding: 0.85rem;
  background: rgba(210, 153, 34, 0.12);
  border-radius: 8px;
  font-size: 0.78rem;
  border: 1px solid rgba(210, 153, 34, 0.16);
}

.config-hint code {
  display: block;
  margin-top: 0.45rem;
  padding: 0.45rem 0.55rem;
  background: #ffffff;
  border-radius: 8px;
  font-family: monospace;
  word-break: break-all;
}
</style>
