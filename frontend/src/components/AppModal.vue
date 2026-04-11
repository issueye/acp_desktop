<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    maxWidth?: string;
    width?: string;
    panelClass?: string | string[] | Record<string, boolean>;
  }>(),
  {
    closeOnBackdrop: true,
    closeOnEscape: true,
    maxWidth: '560px',
    width: '100%',
    panelClass: '',
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const panelStyle = computed(() => ({
  width: props.width,
  maxWidth: props.maxWidth,
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

function handleKeydown(event: KeyboardEvent) {
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
  background: rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(10px);
}

.app-modal-panel {
  width: 100%;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: #fffdfa;
  box-shadow: 0 20px 44px rgba(15, 23, 42, 0.12);
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
