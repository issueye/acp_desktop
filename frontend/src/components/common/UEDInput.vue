<script setup>
import { computed, ref, useAttrs } from 'vue';

const props = defineProps({
    modelValue: { type: [String, Number], default: '' },
    as: { type: String, default: 'input' },
    type: { type: String, default: 'text' },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    rows: { type: Number, default: 4 },
    error: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'keydown']);

const attrs = useAttrs();
const controlRef = ref(null);

const classes = computed(() => [
  props.as === 'textarea' ? 'ued-textarea' : 'ued-input',
  props.error ? 'is-error' : '',
]);

function handleInput(event) {
  const target = event.target;
  emit('update:modelValue', target ? target.value : '');
}

function handleKeydown(event) {
  emit('keydown', event);
}

function focus() {
  controlRef.value?.focus();
}

defineExpose({
  focus,
});
</script>

<template>
  <textarea
    v-if="as === 'textarea'"
    ref="controlRef"
    v-bind="attrs"
    :class="classes"
    :rows="rows"
    :placeholder="placeholder"
    :disabled="disabled"
    :value="modelValue"
    @input="handleInput"
    @keydown="handleKeydown"
  />
  <input
    v-else
    ref="controlRef"
    v-bind="attrs"
    :class="classes"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :value="modelValue"
    @input="handleInput"
    @keydown="handleKeydown"
  />
</template>
