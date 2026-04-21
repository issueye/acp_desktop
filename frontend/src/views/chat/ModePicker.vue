<script setup>
import { computed } from 'vue';

import UEDMenuPicker from '../../components/common/UEDMenuPicker.vue';

const props = defineProps({
    modes: { type: Array, required: true },
    currentModeId: { type: String, required: true },
    disabled: { type: Boolean },
});

const emit = defineEmits(['change']);

const items = computed(() =>
  props.modes.map((mode) => ({
    id: mode.id,
    name: mode.name,
    description: mode.description,
    icon: getModeIcon(mode.id),
  }))
);

function getModeIcon(modeId) {
  switch (modeId.toLowerCase()) {
    case 'ask': return '🎯';
    case 'architect': 
    case 'plan': return '📐';
    case 'code': 
    case 'auto': return '💻';
    case 'debug': return '🐛';
    case 'review': return '👀';
    default: return '⚙️';
  }
}

</script>

<template>
  <UEDMenuPicker
    :items="items"
    :current-id="currentModeId"
    :disabled="disabled"
    min-width="292px"
    max-width="336px"
    trigger-min-width="172px"
    @change="emit('change', $event)"
  />
</template>
