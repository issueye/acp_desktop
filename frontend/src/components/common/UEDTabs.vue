<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  items: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: 'md' },
  fullWidth: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'change']);

const tabRefs = new Map();
const navWrapRef = ref(null);
const navListRef = ref(null);
const navOffset = ref(0);
const maxNavOffset = ref(0);
const hasNavOverflow = ref(false);

let resizeObserver = null;

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
  hasNavOverflow.value ? 'is-scrollable' : '',
  props.disabled ? 'is-disabled' : '',
]);

const tabPanelId = computed(() => `ued-tabs-panel-${String(activeId.value).replace(/[^a-zA-Z0-9_-]/g, '-')}`);
const navListStyle = computed(() => ({
  transform: hasNavOverflow.value ? `translateX(-${navOffset.value}px)` : 'translateX(0)',
}));
const canScrollPrev = computed(() => navOffset.value > 0);
const canScrollNext = computed(() => navOffset.value < maxNavOffset.value);

function getTabId(item) {
  return `ued-tabs-tab-${String(item.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function setTabRef(id, element) {
  if (element) {
    tabRefs.set(id, element);
    return;
  }

  tabRefs.delete(id);
}

function clampOffset(value) {
  return Math.max(0, Math.min(value, maxNavOffset.value));
}

function updateNavState() {
  const wrap = navWrapRef.value;
  const list = navListRef.value;
  if (!wrap || !list || props.fullWidth) {
    maxNavOffset.value = 0;
    hasNavOverflow.value = false;
    navOffset.value = 0;
    return;
  }

  const nextMaxOffset = Math.max(0, list.scrollWidth - wrap.clientWidth);
  maxNavOffset.value = nextMaxOffset;
  hasNavOverflow.value = nextMaxOffset > 1;
  navOffset.value = clampOffset(navOffset.value);
}

function scrollToOffset(value) {
  updateNavState();
  navOffset.value = clampOffset(value);
}

function scrollNav(direction) {
  const wrapWidth = navWrapRef.value?.clientWidth ?? 0;
  const step = Math.max(80, Math.floor(wrapWidth * 0.72));
  scrollToOffset(navOffset.value + direction * step);
}

function scrollActiveTabIntoView() {
  nextTick(() => {
    updateNavState();
    if (!hasNavOverflow.value || !activeId.value) return;

    const wrapWidth = navWrapRef.value?.clientWidth ?? 0;
    const activeTab = tabRefs.get(activeId.value);
    if (!wrapWidth || !activeTab) return;

    const tabStart = activeTab.offsetLeft;
    const tabEnd = tabStart + activeTab.offsetWidth;
    const visibleStart = navOffset.value;
    const visibleEnd = visibleStart + wrapWidth;

    if (tabStart < visibleStart) {
      scrollToOffset(tabStart);
      return;
    }

    if (tabEnd > visibleEnd) {
      scrollToOffset(tabEnd - wrapWidth);
    }
  });
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
    tabRefs.get(item.id)?.focus?.();
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

watch(
  () => [activeId.value, normalizedItems.value.length, props.fullWidth],
  () => {
    scrollActiveTabIntoView();
  },
  { flush: 'post' }
);

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    updateNavState();
    scrollActiveTabIntoView();
  });

  if (navWrapRef.value) resizeObserver.observe(navWrapRef.value);
  if (navListRef.value) resizeObserver.observe(navListRef.value);

  nextTick(() => {
    updateNavState();
    scrollActiveTabIntoView();
  });
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect?.();
  resizeObserver = null;
});
</script>

<template>
  <div :class="classes">
    <div class="ued-tabs__header">
      <button
        v-if="hasNavOverflow"
        class="ued-tabs__scroll-btn ued-tabs__scroll-btn--prev"
        type="button"
        aria-label="Scroll tabs left"
        :disabled="!canScrollPrev"
        @click="scrollNav(-1)"
      >
        ‹
      </button>

      <div ref="navWrapRef" class="ued-tabs__nav-scroll">
        <div
          ref="navListRef"
          class="ued-tab-list ued-tabs__list"
          role="tablist"
          :style="navListStyle"
          @keydown="handleKeydown"
        >
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
      </div>

      <button
        v-if="hasNavOverflow"
        class="ued-tabs__scroll-btn ued-tabs__scroll-btn--next"
        type="button"
        aria-label="Scroll tabs right"
        :disabled="!canScrollNext"
        @click="scrollNav(1)"
      >
        ›
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

.ued-tabs__header {
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 0;
}

.ued-tabs__nav-scroll {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.ued-tabs__list {
  min-width: 0;
  width: max-content;
  flex-wrap: nowrap;
  transition: transform 0.22s ease;
  will-change: transform;
}

.ued-tabs--full-width .ued-tabs__nav-scroll,
.ued-tabs--full-width .ued-tabs__list {
  width: 100%;
}

.ued-tabs--full-width .ued-tabs__list {
  flex-wrap: nowrap;
}

.ued-tabs--full-width .ued-tabs__tab {
  flex: 1 1 0;
  min-width: 0;
}

.ued-tabs__scroll-btn {
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ued-border-default);
  border-radius: var(--ued-radius-sm);
  background: var(--ued-bg-panel);
  color: var(--ued-text-secondary);
  cursor: pointer;
  transition:
    background-color 0.14s ease,
    border-color 0.14s ease,
    color 0.14s ease,
    opacity 0.14s ease;
}

.ued-tabs__scroll-btn:hover:not(:disabled) {
  background: var(--ued-bg-panel-hover);
  color: var(--ued-accent);
  border-color: color-mix(in srgb, var(--ued-accent) 26%, var(--ued-border-default));
}

.ued-tabs__scroll-btn:focus-visible {
  outline: none;
  box-shadow: var(--ued-shadow-focus);
}

.ued-tabs__scroll-btn:disabled {
  color: var(--ued-text-disabled);
  cursor: not-allowed;
  opacity: 0.52;
}

.ued-tabs__scroll-btn--prev {
  margin-right: var(--ued-space-6);
}

.ued-tabs__scroll-btn--next {
  margin-left: var(--ued-space-6);
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

.ued-tabs--sm .ued-tabs__scroll-btn {
  width: var(--ued-control-height-sm);
  height: var(--ued-control-height-sm);
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
