<script setup>
import { computed } from 'vue';

import UEDMenuPicker from './common/UEDMenuPicker.vue';

const props = defineProps({
    models: { type: Array, required: true },
    currentModelId: { type: String, required: true },
    disabled: { type: Boolean },
});

const emit = defineEmits(['change']);

const items = computed(() =>
  props.models.map((model) => ({
    id: model.modelId,
    name: model.name,
    description: model.description,
    icon: getModelIcon(model.modelId),
  }))
);

function getModelIcon(modelId) {
  const lower = modelId.toLowerCase();
  if (lower.includes('claude')) return '🟣';
  if (lower.includes('gpt') || lower.includes('openai')) return '🟢';
  if (lower.includes('gemini') || lower.includes('google')) return '🔵';
  if (lower.includes('llama') || lower.includes('meta')) return '🟠';
  if (lower.includes('mistral')) return '🔴';
  if (lower.includes('deepseek')) return '🟤';
  return '🤖';
}

</script>

<template>
  <UEDMenuPicker
    :items="items"
    :current-id="currentModelId"
    :disabled="disabled"
    min-width="348px"
    max-width="420px"
    trigger-min-width="220px"
    @change="emit('change', $event)"
  />
</template>
