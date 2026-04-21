<script setup lang="ts">
import { computed, watch } from 'vue';
import { useConfigStore } from '../../stores/config';
import { useI18n } from '../../lib/i18n';
import UEDCard from '../../components/common/UEDCard.vue';
import UEDField from '../../components/common/UEDField.vue';
import UEDSelect from '../../components/common/UEDSelect.vue';

const props = withDefaults(defineProps<{
  selected?: string;
}>(), {
  selected: '',
});

const emit = defineEmits<{
  'update:selected': [value: string];
  select: [agentName: string];
}>();

const configStore = useConfigStore();
const { t } = useI18n();

const selectedAgent = computed({
  get: () => props.selected,
  set: (value: string) => {
    emit('update:selected', value);
    emit('select', value);
  },
});

const agents = computed(() => configStore.agentNames);
const hasAgents = computed(() => configStore.hasAgents);
const configPath = computed(() => configStore.configPath);

// Auto-select first agent when agents are available and none selected
watch(agents, (newAgents) => {
  if (newAgents.length > 0 && !selectedAgent.value) {
    selectedAgent.value = newAgents[0];
  }
}, { immediate: true });

</script>

<template>
  <div class="agent-selector">
    <UEDField :label="t('agent.label')">
      <UEDSelect
        id="agent-select"
        :model-value="selectedAgent"
        :disabled="!hasAgents"
        @update:modelValue="selectedAgent = $event"
      >
        <option value="" disabled>
          {{ hasAgents ? t('agent.select') : t('agent.noneConfigured') }}
        </option>
        <option v-for="agent in agents" :key="agent" :value="agent">
          {{ agent }}
        </option>
      </UEDSelect>
    </UEDField>
    
    <UEDCard v-if="!hasAgents" muted class="config-hint">
      <p class="ued-meta">{{ t('agent.noneFound') }}</p>
      <code class="ued-code config-path">{{ configPath }}</code>
    </UEDCard>
  </div>
</template>

<style scoped>
.agent-selector {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.config-hint {
  margin-top: 0.3rem;
}

.config-path {
  display: block;
  margin-top: 0.45rem;
  padding: 0.45rem 0.55rem;
  background: var(--ued-bg-panel);
  border-radius: var(--ued-radius-sm);
  word-break: break-all;
}
</style>
