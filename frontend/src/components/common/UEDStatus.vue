<script setup>
import { computed, useAttrs } from 'vue';


const props = defineProps({

});

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
