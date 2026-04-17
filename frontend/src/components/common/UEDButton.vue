<script setup>
import { computed, useAttrs } from 'vue';


const props = defineProps({
    variant: { type: String, default: 'secondary' },
    size: { type: String, default: 'md' },
    block: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    type: { type: String, default: 'button' },
});

const attrs = useAttrs();

const classes = computed(() => [
  'ued-btn',
  `ued-btn--${props.variant}`,
  props.size !== 'md' ? `ued-btn--${props.size}` : '',
  props.block ? 'ued-btn--block' : '',
  props.active ? 'is-active' : '',
]);
</script>

<template>
  <button v-bind="attrs" :type="type" :disabled="disabled" :class="classes">
    <slot />
  </button>
</template>
