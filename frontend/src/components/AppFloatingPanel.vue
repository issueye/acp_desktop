<script setup>
import { computed } from 'vue';

const props = defineProps({
    modelValue: { type: Boolean, required: true },
    width: { type: String, default: 'min(860px, calc(100vw - 360px))' },
    maxWidth: { type: String, default: 'calc(100vw - 24px)' },
    bottom: { type: String, default: '16px' },
    right: { type: String, default: '16px' },
    left: { type: String, default: 'auto' },
    panelClass: { type: [String, Array, Object], default: '' },
});

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
