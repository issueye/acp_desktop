<script setup>
import { computed, nextTick, onBeforeUnmount, ref, useSlots, watch } from 'vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  kicker: {
    type: String,
    default: '',
  },
  width: {
    type: String,
    default: '100%',
  },
  maxWidth: {
    type: String,
    default: '560px',
  },
  maxHeight: {
    type: String,
    default: 'min(840px, calc(100dvh - 64px))',
  },
  closeOnScrim: {
    type: Boolean,
    default: true,
  },
  closeOnEsc: {
    type: Boolean,
    default: true,
  },
  persistent: {
    type: Boolean,
    default: false,
  },
  showClose: {
    type: Boolean,
    default: true,
  },
  closeLabel: {
    type: String,
    default: 'Close dialog',
  },
  surfaceClass: {
    type: [String, Array, Object],
    default: '',
  },
  bodyClass: {
    type: [String, Array, Object],
    default: '',
  },
  footerClass: {
    type: [String, Array, Object],
    default: '',
  },
});

const emit = defineEmits(['close', 'update:visible']);

const slots = useSlots();
const surfaceRef = ref(null);

const dialogStyle = computed(() => ({
  width: props.width,
  maxWidth: props.maxWidth,
  maxHeight: props.maxHeight,
}));

const hasHeader = computed(() =>
  Boolean(props.kicker || props.title || props.description || props.showClose || slots['header-extra'])
);

const hasFooter = computed(() => Boolean(slots.footer));

function handleClose() {
  emit('close');
  emit('update:visible', false);
}

function handleScrimClick() {
  if (!props.persistent && props.closeOnScrim) {
    handleClose();
  }
}

function handleWindowKeydown(event) {
  if (!props.visible || props.persistent || !props.closeOnEsc || event.key !== 'Escape') {
    return;
  }
  handleClose();
}

watch(
  () => props.visible,
  async (visible) => {
    if (visible) {
      window.addEventListener('keydown', handleWindowKeydown);
      await nextTick();
      surfaceRef.value?.focus();
      return;
    }

    window.removeEventListener('keydown', handleWindowKeydown);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="ued-dialog-fade">
      <div v-if="visible" class="ued-modal">
        <div class="ued-modal__scrim" @click="handleScrimClick"></div>

        <div class="ued-modal__positioner" role="presentation">
          <section
            ref="surfaceRef"
            class="ued-modal__surface"
            :class="surfaceClass"
            :style="dialogStyle"
            role="dialog"
            aria-modal="true"
            :aria-label="title || closeLabel"
            tabindex="-1"
            @click.stop
          >
            <header v-if="hasHeader" class="ued-modal__header">
              <div class="ued-modal__heading">
                <h3 v-if="title" class="ued-modal__title">{{ title }}</h3>
                <p v-if="description" class="ued-modal__description">{{ description }}</p>
              </div>

              <div class="ued-modal__actions">
                <slot name="header-extra" />
                <button
                  v-if="showClose"
                  class="ued-icon-btn ued-modal__close"
                  type="button"
                  :aria-label="closeLabel"
                  @click="handleClose"
                >
                  ×
                </button>
              </div>
            </header>

            <div v-if="$slots.summary" class="ued-modal__summary">
              <slot name="summary" />
            </div>

            <div class="ued-modal__body" :class="bodyClass">
              <slot :close="handleClose" />
            </div>

            <footer v-if="hasFooter" class="ued-modal__footer" :class="footerClass">
              <slot name="footer" :close="handleClose" />
            </footer>
          </section>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ued-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.ued-modal__scrim {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(2px);
}

.ued-modal__positioner {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  overflow: auto;
}

.ued-modal__surface {
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: var(--ued-radius-lg);
  border: 1px solid var(--ued-border-default);
  background: var(--ued-bg-panel);
  box-shadow: var(--ued-shadow-dialog);
  overflow: hidden;
  outline: none;
}

.ued-modal__header {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ued-space-12, 0.75rem);
  padding: var(--ued-dialog-padding, 16px);
  border-bottom: 1px solid var(--ued-border-default);
  background: var(--ued-bg-panel);
}

.ued-modal__heading {
  min-width: 0;
}

.ued-modal__title {
  margin: 0;
  font-size: var(--ued-text-title-2);
  line-height: var(--ued-line-title-2);
  color: var(--ued-text-primary);
}

.ued-modal__description {
  margin: 0.4rem 0 0;
  color: var(--ued-text-secondary);
  font-size: var(--ued-text-body);
  line-height: 1.6;
}

.ued-modal__actions {
  display: flex;
  align-items: center;
  gap: var(--ued-space-8, 0.5rem);
}

.ued-modal__close {
  font-size: 0.95rem;
}

.ued-modal__summary {
  flex-shrink: 0;
  padding: 0 16px 16px;
}

.ued-modal__body {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding: 16px;
}

.ued-modal__footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--ued-space-8, 0.5rem);
  padding: 12px 16px 16px;
  border-top: 1px solid var(--ued-border-default);
  background: var(--ued-bg-panel);
}

.ued-dialog-fade-enter-active,
.ued-dialog-fade-leave-active {
  transition: opacity 0.18s ease;
}

.ued-dialog-fade-enter-active .ued-modal__surface,
.ued-dialog-fade-leave-active .ued-modal__surface {
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.ued-dialog-fade-enter-from,
.ued-dialog-fade-leave-to {
  opacity: 0;
}

.ued-dialog-fade-enter-from .ued-modal__surface,
.ued-dialog-fade-leave-to .ued-modal__surface {
  transform: translateY(8px) scale(0.985);
  opacity: 0;
}
</style>
