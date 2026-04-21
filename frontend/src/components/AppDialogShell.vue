<script setup>
import { computed, useSlots } from 'vue';
import UEDDialog from './common/UEDDialog.vue';

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  title: { type: String, required: true },
  eyebrow: { type: String, default: '' },
  maxWidth: { type: String, default: '560px' },
  maxHeight: { type: String, default: 'min(840px, calc(100dvh - 64px))' },
  width: { type: String, default: '100%' },
  bodyClass: { type: [String, Array, Object], default: '' },
  footerClass: { type: [String, Array, Object], default: '' },
  closeOnBackdrop: { type: Boolean, default: true },
  closeOnEscape: { type: Boolean, default: true },
  showClose: { type: Boolean, default: true },
  embedded: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'close']);

const slots = useSlots();
const hasFooter = computed(() => Boolean(slots.footer));

function close() {
  emit('update:modelValue', false);
  emit('close');
}

function handleDialogClose() {
  emit('close');
}
</script>

<template>
  <section v-if="props.embedded" class="dialog-shell-embedded">
    <div class="dialog-shell-embedded__header">
      <div class="dialog-shell-embedded__copy">
        <span v-if="props.eyebrow">{{ props.eyebrow }}</span>
        <h1>{{ props.title }}</h1>
      </div>
      <slot name="header-extra" :close="close" />
    </div>

    <div :class="['dialog-shell-embedded__body', props.bodyClass]">
      <slot :close="close" />
    </div>

    <div v-if="hasFooter" :class="['dialog-shell-embedded__footer', props.footerClass]">
      <slot name="footer" :close="close" />
    </div>
  </section>

  <UEDDialog
    v-else
    :visible="props.modelValue"
    :title="props.title"
    :kicker="props.eyebrow"
    :width="props.width"
    :max-width="props.maxWidth"
    :max-height="props.maxHeight"
    :close-on-scrim="props.closeOnBackdrop"
    :close-on-esc="props.closeOnEscape"
    :show-close="props.showClose"
    surface-class="dialog-shell-panel"
    :body-class="['dialog-shell__body', props.bodyClass]"
    :footer-class="['dialog-shell__footer', props.footerClass]"
    @update:visible="(value) => emit('update:modelValue', value)"
    @close="handleDialogClose"
  >
    <template #header-extra>
      <slot name="header-extra" :close="close" />
    </template>

    <slot :close="close" />

    <template v-if="hasFooter" #footer>
      <slot name="footer" :close="close" />
    </template>
  </UEDDialog>
</template>

<style scoped>
.dialog-shell-embedded {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--ued-bg-window);
}

.dialog-shell-embedded__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.15rem 0.8rem;
  border-bottom: 1px solid var(--ued-border-subtle);
  background: var(--ued-bg-panel);
}

.dialog-shell-embedded__copy {
  display: grid;
  gap: 0.18rem;
  min-width: 0;
}

.dialog-shell-embedded__copy span {
  color: var(--ued-text-muted);
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
}

.dialog-shell-embedded__copy h1 {
  margin: 0;
  color: var(--ued-text-primary);
  font-size: var(--ued-text-title-2);
  line-height: var(--ued-line-title-2);
}

.dialog-shell-embedded__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.dialog-shell-embedded__footer {
  flex-shrink: 0;
  border-top: 1px solid var(--ued-border-subtle);
  background: var(--ued-bg-panel);
}

:deep(.dialog-shell-panel) {
  max-height: 100%;
}

:deep(.ued-modal__title) {
  font-size: var(--ued-text-title-2);
  line-height: var(--ued-line-title-2);
}

:deep(.dialog-shell__body) {
  background: var(--ued-bg-panel);
}

:deep(.dialog-shell__footer) {
  background: var(--ued-bg-panel);
}
</style>
