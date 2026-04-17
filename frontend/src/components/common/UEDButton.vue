<script setup lang="ts">
import { computed, useAttrs } from 'vue';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg';

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant;
    size?: ButtonSize;
    block?: boolean;
    active?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    block: false,
    active: false,
    disabled: false,
    type: 'button',
  }
);

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

<style scoped>
.ued-btn--block {
  width: 100%;
}

.ued-btn.is-active.ued-btn--secondary,
.ued-btn.is-active.ued-btn--ghost {
  background: var(--ued-accent-soft);
  border-color: color-mix(in srgb, var(--ued-accent) 22%, var(--ued-border-default));
  color: var(--ued-accent);
}
</style>
