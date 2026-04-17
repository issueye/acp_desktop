<script setup lang="ts">
import { computed, useAttrs } from 'vue';

type StatusTone = 'neutral' | 'success' | 'warning' | 'error' | 'info';
type StatusKind = 'status' | 'badge' | 'chip';

const props = withDefaults(
  defineProps<{
    tone?: StatusTone;
    kind?: StatusKind;
  }>(),
  {
    tone: 'neutral',
    kind: 'badge',
  }
);

const attrs = useAttrs();

const classes = computed(() => [
  `ued-${props.kind}`,
  props.kind === 'status' ? `ued-status--${props.tone}` : '',
]);
</script>

<template>
  <span v-bind="attrs" :class="classes">
    <slot />
  </span>
</template>
