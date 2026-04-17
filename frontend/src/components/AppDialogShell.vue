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
  <UEDDialog
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
