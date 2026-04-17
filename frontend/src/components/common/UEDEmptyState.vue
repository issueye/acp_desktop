<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    text?: string;
  }>(),
  {
    text: '',
  }
);
</script>

<template>
  <div class="ued-empty">
    <slot name="icon" />
    <div class="ued-title-2">{{ title }}</div>
    <div v-if="text || $slots.text" class="ued-meta">
      <slot name="text">
        {{ text }}
      </slot>
    </div>
    <slot />
  </div>
</template>
