<script setup>
import { computed, nextTick, ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  items: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: 'md' },
  fullWidth: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'change']);

const tabRefs = ref({});

const normalizedItems = computed(() =>
  props.items
    .filter((item) => item && item.id !== undefined && item.id !== null)
    .map((item) => ({
      ...item,
      disabled: props.disabled || item.disabled === true,
    }))
);

const enabledItems = computed(() =>
  normalizedItems.value.filter((item) => !item.disabled)
);

const activeItem = computed(() => {
  const direct = normalizedItems.value.find((item) => item.id === props.modelValue);
  if (direct && !direct.disabled) return direct;
  return enabledItems.value[0] ?? null;
});

const activeId = computed(() => activeItem.value?.id ?? '');

const classes = computed(() => [
  'ued-tabs',
  props.size !== 'md' ? `ued-tabs--${props.size}` : '',
  props.fullWidth ? 'ued-tabs--full-width' : '',
  props.disabled ? 'is-disabled' : '',
]);

const tabPanelId = computed(() => `ued-tabs-panel-${String(activeId.value).replace(/[^a-zA-Z0-9_-]/g, '-')}`);

function getTabId(item) {
  return `ued-tabs-tab-${String(item.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function setTabRef(id, element) {
  if (element) {
    tabRefs.value = { ...tabRefs.value, [id]: element };
    return;
  }

  const nextRefs = { ...tabRefs.value };
  delete nextRefs[id];
  tabRefs.value = nextRefs;
}

function selectItem(item) {
  if (!item || item.disabled || item.id === activeId.value) return;

  const previousId = activeId.value;
  emit('update:modelValue', item.id);
  emit('change', item.id, previousId, item);
}

function focusItem(item) {
  if (!item) return;
  nextTick(() => {
    tabRefs.value[item.id]?.focus?.();
  });
}

function selectRelativeItem(direction) {
  const items = enabledItems.value;
  if (items.length === 0) return;

  const currentIndex = Math.max(0, items.findIndex((item) => item.id === activeId.value));
  const nextIndex = (currentIndex + direction + items.length) % items.length;
  const nextItem = items[nextIndex];

  selectItem(nextItem);
  focusItem(nextItem);
}

function selectEdgeItem(edge) {
  const items = enabledItems.value;
  if (items.length === 0) return;

  const nextItem = edge === 'first' ? items[0] : items[items.length - 1];
  selectItem(nextItem);
  focusItem(nextItem);
}

function handleKeydown(event) {
  if (props.disabled) return;

  if (event.key === 'ArrowRight') {
    event.preventDefault();
    selectRelativeItem(1);
    return;
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    selectRelativeItem(-1);
    return;
  }

  if (event.key === 'Home') {
    event.preventDefault();
    selectEdgeItem('first');
    return;
  }

  if (event.key === 'End') {
    event.preventDefault();
    selectEdgeItem('last');
  }
}

watch(
  () => [props.modelValue, normalizedItems.value],
  () => {
    if (!activeItem.value || props.modelValue === activeId.value) return;
    emit('update:modelValue', activeId.value);
  },
  { immediate: true }
);
</script>

<template>
  <div :class="classes">
    <div class="ued-tab-list ued-tabs__list" role="tablist" @keydown="handleKeydown">
      <button
        v-for="item in normalizedItems"
        :id="getTabId(item)"
        :key="item.id"
        :ref="(element) => setTabRef(item.id, element)"
        class="ued-tab ued-tabs__tab"
        :class="{
          'is-active': item.id === activeId,
          'is-disabled': item.disabled,
        }"
        type="button"
        role="tab"
        :disabled="item.disabled"
        :tabindex="item.id === activeId ? 0 : -1"
        :title="item.title || item.label"
        :aria-selected="item.id === activeId"
        :aria-controls="item.id === activeId ? tabPanelId : undefined"
        @click="selectItem(item)"
      >
        <slot name="tab" :item="item" :active="item.id === activeId" :disabled="item.disabled">
          <span v-if="item.icon" class="ued-tabs__tab-icon">{{ item.icon }}</span>
          <span class="ued-tabs__tab-label">{{ item.label }}</span>
          <span v-if="item.badge !== undefined && item.badge !== null && item.badge !== ''" class="ued-tabs__tab-badge">
            {{ item.badge }}
          </span>
        </slot>
      </button>
    </div>

    <div
      :id="tabPanelId"
      class="ued-tabs__panel"
      role="tabpanel"
      :aria-labelledby="activeItem ? getTabId(activeItem) : undefined"
    >
      <slot :active-id="activeId" :active-item="activeItem" />
    </div>
  </div>
</template>

<style scoped>
.ued-tabs {
  display: flex;
  flex-direction: column;
  gap: var(--ued-space-8);
  min-width: 0;
  min-height: 0;
}

.ued-tabs__list {
  min-width: 0;
}

.ued-tabs--full-width .ued-tabs__list {
  flex-wrap: nowrap;
  width: 100%;
}

.ued-tabs--full-width .ued-tabs__tab {
  flex: 1 1 0;
  min-width: 0;
}

.ued-tabs__tab {
  gap: var(--ued-space-6);
  max-width: 100%;
  font: inherit;
}

.ued-tabs--sm .ued-tabs__tab {
  min-height: var(--ued-control-height-sm);
  padding: 0 var(--ued-space-8);
  font-size: var(--ued-text-body-small);
}

.ued-tabs__tab.is-disabled,
.ued-tabs.is-disabled .ued-tabs__tab {
  color: var(--ued-text-disabled);
  cursor: not-allowed;
  opacity: 0.72;
}

.ued-tabs__tab-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ued-tabs__tab-icon,
.ued-tabs__tab-badge {
  flex-shrink: 0;
}

.ued-tabs__tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25em;
  height: 1.25em;
  padding: 0 var(--ued-space-4);
  border-radius: var(--ued-radius-pill);
  background: color-mix(in srgb, var(--ued-accent) 12%, transparent);
  color: var(--ued-accent);
  font-size: 0.78em;
  font-weight: 600;
  line-height: 1;
}

.ued-tabs__panel {
  min-width: 0;
  min-height: 0;
}
</style>
