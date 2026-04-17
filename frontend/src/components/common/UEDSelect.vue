<script setup lang="ts">
import { useAttrs } from 'vue';

withDefaults(
  defineProps<{
    modelValue?: string | number;
    disabled?: boolean;
  }>(),
  {
    modelValue: '',
    disabled: false,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const attrs = useAttrs();

function handleChange(event: Event) {
  emit('update:modelValue', (event.target as HTMLSelectElement).value);
}
</script>

<template>
  <select
    v-bind="attrs"
    class="ued-select"
    :disabled="disabled"
    :value="modelValue"
    @change="handleChange"
  >
    <slot />
  </select>
</template>
