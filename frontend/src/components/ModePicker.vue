<script setup lang="ts">
import { computed } from 'vue';
import type { SessionMode } from '../lib/types';
import UEDMenuPicker from './common/UEDMenuPicker.vue';

const props = defineProps<{
  modes: SessionMode[];
  currentModeId: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  change: [modeId: string];
}>();

const items = computed(() =>
  props.modes.map((mode) => ({
    id: mode.id,
    name: mode.name,
    description: mode.description,
    icon: getModeIcon(mode.id),
  }))
);

function getModeIcon(modeId: string): string {
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
