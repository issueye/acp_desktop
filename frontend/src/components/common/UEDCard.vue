<script setup lang="ts">
import { computed, useAttrs } from 'vue';

const props = withDefaults(
  defineProps<{
    muted?: boolean;
    raised?: boolean;
    padded?: boolean;
    tag?: string;
  }>(),
  {
    muted: false,
    raised: false,
    padded: true,
    tag: 'section',
  }
);

const attrs = useAttrs();

const classes = computed(() => [
  'ued-panel',
  props.muted ? 'ued-panel--muted' : '',
  props.raised ? 'ued-panel--raised' : '',
]);
</script>

<template>
  <component :is="tag" v-bind="attrs" :class="classes">
    <div v-if="padded" class="ued-panel-body">
      <slot />
    </div>
    <slot v-else />
  </component>
</template>
