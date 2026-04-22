<script setup>
import { computed } from 'vue';

const props = defineProps({
  name: { type: String, required: true },
});

const modules = import.meta.glob('../../assets/svgs/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const icons = Object.fromEntries(
  Object.entries(modules).map(([path, content]) => {
    const match = path.match(/\/([^/]+)\.svg$/);
    return [match?.[1] || path, content];
  })
);

const svg = computed(() => icons[props.name] || '');
</script>

<template>
  <span class="svg-icon" aria-hidden="true" v-html="svg" />
</template>

<style scoped>
.svg-icon {
  width: 1em;
  height: 1em;
  display: inline-grid;
  place-items: center;
  line-height: 0;
}

.svg-icon :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
  flex-shrink: 0;
}
</style>
