<script setup>
import { computed, useAttrs } from 'vue';

const props = defineProps({
    modelValue: { type: [String, Number], default: '' },
    as: { type: String, default: 'input' },
    type: { type: String, default: 'text' },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    rows: { type: Number, default: 4 },
    error: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);

const attrs = useAttrs();

const classes = computed(() => [
  props.as === 'textarea' ? 'ued-textarea' : 'ued-input',
  props.error ? 'is-error' : '',
]);

function handleInput(event) {
  emit('update:modelValue', (event.target | HTMLTextAreaElement).value);
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
