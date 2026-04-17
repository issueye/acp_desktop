<script setup>
import { useAttrs } from 'vue';

defineProps({
    modelValue: { type: [String, Number], default: '' },
    disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);

const attrs = useAttrs();

function handleChange(event) {
  emit('update:modelValue', (event.target).value);
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
