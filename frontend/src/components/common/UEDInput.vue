<script setup lang="ts">
import { computed, useAttrs } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue?: string | number;
    as?: 'input' | 'textarea';
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    rows?: number;
    error?: boolean;
  }>(),
  {
    modelValue: '',
    as: 'input',
    type: 'text',
    placeholder: '',
    disabled: false,
    rows: 4,
    error: false,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const attrs = useAttrs();

const classes = computed(() => [
  props.as === 'textarea' ? 'ued-textarea' : 'ued-input',
  props.error ? 'is-error' : '',
]);

function handleInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement | HTMLTextAreaElement).value);
}
</script>

<template>
  <textarea
    v-if="as === 'textarea'"
    v-bind="attrs"
    :class="classes"
    :rows="rows"
    :placeholder="placeholder"
    :disabled="disabled"
    :value="modelValue"
    @input="handleInput"
  />
  <input
    v-else
    v-bind="attrs"
    :class="classes"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :value="modelValue"
    @input="handleInput"
  />
</template>
