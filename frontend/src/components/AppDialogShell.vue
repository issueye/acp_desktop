<script setup lang="ts">
import { computed, useSlots } from 'vue';
import AppModal from './AppModal.vue';

type ClassValue = string | string[] | Record<string, boolean> | Array<string | Record<string, boolean>>;

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    eyebrow?: string;
    maxWidth?: string;
    maxHeight?: string;
    width?: string;
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    showClose?: boolean;
    bodyClass?: ClassValue;
    footerClass?: ClassValue;
  }>(),
  {
    eyebrow: '',
    maxWidth: '560px',
    maxHeight: 'min(840px, calc(100dvh - 64px))',
    width: '100%',
    closeOnBackdrop: true,
    closeOnEscape: true,
    showClose: true,
    bodyClass: '',
    footerClass: '',
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const slots = useSlots();

const hasFooter = computed(() => Boolean(slots.footer));

function close() {
  emit('update:modelValue', false);
  emit('close');
}
</script>

<template>
  <AppModal
    :model-value="props.modelValue"
    :max-width="props.maxWidth"
    :max-height="props.maxHeight"
    :width="props.width"
    :close-on-backdrop="props.closeOnBackdrop"
    :close-on-escape="props.closeOnEscape"
    panel-class="dialog-shell-panel"
    @update:modelValue="(value) => emit('update:modelValue', value)"
    @close="close"
  >
    <section class="dialog-shell">
      <header class="dialog-shell__header">
        <h2 class="dialog-shell__title">{{ props.title }}</h2>
        <div class="dialog-shell__header-actions">
          <slot name="header-extra" :close="close" />
          <button
            v-if="props.showClose"
            class="dialog-shell__close"
            type="button"
            @click="close"
          >
            ×
          </button>
        </div>
      </header>

      <div class="dialog-shell__body" :class="props.bodyClass">
        <slot :close="close" />
      </div>

      <footer v-if="hasFooter" class="dialog-shell__footer" :class="props.footerClass">
        <slot name="footer" :close="close" />
      </footer>
    </section>
  </AppModal>
</template>

<style scoped>
:deep(.dialog-shell-panel) {
  max-height: 100%;
  display: flex;
  flex-direction: column;
}

.dialog-shell {
  width: 100%;
  max-height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fffdfa;
}

.dialog-shell__header {
  flex-shrink: 0;
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem;
  background: var(--bg-header);
  border-bottom: 1px solid var(--border-color);
}

.dialog-shell__title-block {
  min-width: 0;
}

.dialog-shell__eyebrow {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.dialog-shell__title {
  margin: 0;
  font-size: 1rem;
  line-height: 1.2;
  color: var(--text-primary);
}

.dialog-shell__header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dialog-shell__close {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: #ffffff;
  color: var(--text-secondary);
  font-size: 0.95rem;
  cursor: pointer;
}

.dialog-shell__close:hover {
  color: var(--text-primary);
  background: #f8fafc;
  border-color: rgba(148, 163, 184, 0.34);
}

.dialog-shell__body {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding: 0.5rem;
}

.dialog-shell__footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.55rem;
  padding: 0.5rem;
  border-top: 1px solid var(--border-color);
  background: #ffffff;
}
</style>
