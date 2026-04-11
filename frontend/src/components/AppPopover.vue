<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    align?: 'left' | 'right';
    side?: 'top' | 'bottom';
    offset?: number;
    minWidth?: string;
    maxWidth?: string;
    panelClass?: string | string[] | Record<string, boolean>;
  }>(),
  {
    align: 'left',
    side: 'bottom',
    offset: 6,
    minWidth: '',
    maxWidth: '',
    panelClass: '',
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  open: [];
  close: [];
}>();

const rootRef = ref<HTMLElement | null>(null);

const panelStyle = computed(() => {
  const sideProp = props.side === 'bottom' ? 'top' : 'bottom';
  const alignProp = props.align === 'right' ? 'right' : 'left';
  return {
    [sideProp]: `calc(100% + ${props.offset}px)`,
    [alignProp]: '0',
    minWidth: props.minWidth || undefined,
    maxWidth: props.maxWidth || undefined,
  };
});

function setOpen(value: boolean) {
  emit('update:modelValue', value);
  if (value) {
    emit('open');
  } else {
    emit('close');
  }
}

function toggle() {
  setOpen(!props.modelValue);
}

function close() {
  if (!props.modelValue) {
    return;
  }
  setOpen(false);
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target as Node | null;
  if (!props.modelValue || !rootRef.value || (target && rootRef.value.contains(target))) {
    return;
  }
  close();
}

function handleKeydown(event: KeyboardEvent) {
  if (props.modelValue && event.key === 'Escape') {
    close();
  }
}

onMounted(() => {
  window.addEventListener('click', handleDocumentClick);
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleDocumentClick);
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div ref="rootRef" class="app-popover">
    <slot name="trigger" :open="modelValue" :toggle="toggle" :close="close" />

    <Transition name="app-popover">
      <div
        v-if="modelValue"
        class="app-popover-panel"
        :class="panelClass"
        :style="panelStyle"
        @click.stop
      >
        <slot :close="close" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.app-popover {
  position: relative;
  display: inline-flex;
}

.app-popover-panel {
  position: absolute;
  z-index: 100;
}

.app-popover-enter-active,
.app-popover-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.app-popover-enter-from,
.app-popover-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
