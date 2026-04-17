<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue';


const props = defineProps({
    modelValue: { type: Boolean, required: true },
    closeOnBackdrop: { type: Boolean, default: true },
    closeOnEscape: { type: Boolean, default: true },
    maxWidth: { type: String, default: '560px' },
    maxHeight: { type: String, default: 'calc(100dvh - 64px)' },
    width: { type: String, default: '100%' },
    panelClass: { type: [String, Array, Object], default: '' },
});

const emit = defineEmits(['update:modelValue', 'close']);

const panelStyle = computed(() => ({
  width: props.width,
  maxWidth: props.maxWidth,
  maxHeight: props.maxHeight,
}));

function close() {
  emit('update:modelValue', false);
  emit('close');
}

function handleBackdropClick() {
  if (!props.closeOnBackdrop) {
    return;
  }
  close();
}

function handleKeydown(event) {
  if (!props.modelValue || !props.closeOnEscape || event.key !== 'Escape') {
    return;
  }
  close();
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="app-modal">
      <div v-if="modelValue" class="app-modal-overlay" @click.self="handleBackdropClick">
        <div class="app-modal-panel" :class="panelClass" :style="panelStyle">
          <slot :close="close" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.app-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  overflow: auto;
  background: rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(2px);
}

.app-modal-panel {
  width: 100%;
  min-height: 0;
  border-radius: var(--ued-radius-lg);
  border: 1px solid var(--ued-border-default);
  background: var(--ued-bg-panel);
  box-shadow: var(--ued-shadow-dialog);
  overflow: hidden;
}

.app-modal-enter-active,
.app-modal-leave-active {
  transition: opacity 0.18s ease;
}

.app-modal-enter-active .app-modal-panel,
.app-modal-leave-active .app-modal-panel {
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.app-modal-enter-from,
.app-modal-leave-to {
  opacity: 0;
}

.app-modal-enter-from .app-modal-panel,
.app-modal-leave-to .app-modal-panel {
  transform: translateY(8px) scale(0.985);
  opacity: 0;
}
</style>
