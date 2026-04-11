<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    width?: string;
    maxWidth?: string;
    bottom?: string;
    right?: string;
    left?: string;
    panelClass?: string | string[] | Record<string, boolean>;
  }>(),
  {
    width: 'min(860px, calc(100vw - 360px))',
    maxWidth: 'calc(100vw - 24px)',
    bottom: '16px',
    right: '16px',
    left: 'auto',
    panelClass: '',
  }
);

const panelStyle = computed(() => ({
  width: props.width,
  maxWidth: props.maxWidth,
  bottom: props.bottom,
  right: props.right,
  left: props.left,
}));
</script>

<template>
  <Teleport to="body">
    <Transition name="floating-panel">
      <div v-if="modelValue" class="floating-panel-layer">
        <div class="floating-panel" :class="panelClass" :style="panelStyle">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.floating-panel-layer {
  position: fixed;
  inset: 0;
  z-index: 70;
  pointer-events: none;
}

.floating-panel {
  position: absolute;
  pointer-events: auto;
}

.floating-panel-enter-active,
.floating-panel-leave-active {
  transition: opacity 0.18s ease;
}

.floating-panel-enter-active .floating-panel,
.floating-panel-leave-active .floating-panel {
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.floating-panel-enter-from,
.floating-panel-leave-to {
  opacity: 0;
}

.floating-panel-enter-from .floating-panel,
.floating-panel-leave-to .floating-panel {
  transform: translateY(10px);
  opacity: 0;
}
</style>
