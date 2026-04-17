<script setup>
import { computed, useAttrs } from 'vue';

const props = defineProps({
    muted: { type: Boolean, default: false },
    raised: { type: Boolean, default: false },
    padded: { type: Boolean, default: true },
    tag: { type: String, default: 'section' },
});

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
