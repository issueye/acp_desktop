<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import AppPopover from '../AppPopover.vue';
import UEDInput from './UEDInput.vue';

const props = defineProps({
    items: { type: Array, required: true },
    currentId: { type: String, required: true },
    disabled: { type: Boolean, default: false },
    minWidth: { type: String, default: '292px' },
    maxWidth: { type: String, default: '420px' },
    triggerMinWidth: { type: String, default: '172px' },
    searchable: { type: Boolean, default: false },
    searchPlaceholder: { type: String, default: 'Search...' },
    emptySearchText: { type: String, default: 'No matching results.' },
});

const emit = defineEmits(['change']);

const isOpen = ref(false);
const searchQuery = ref('');
const searchInputRef = ref(null);

const currentItem = computed(() =>
  props.items.find((item) => item.id === props.currentId) ?? null
);

const filteredItems = computed(() => {
  const normalizedQuery = String(searchQuery.value ?? '').trim().toLowerCase();
  if (!props.searchable || !normalizedQuery) {
    return props.items;
  }
  return props.items.filter((item) => {
    const haystack = `${item.name ?? ''} ${item.description ?? ''} ${item.id ?? ''}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
});

function toggleDropdown() {
  if (!props.disabled) {
    isOpen.value = !isOpen.value;
  }
}

function selectItem(id) {
  if (id !== props.currentId) {
    emit('change', id);
  }
  isOpen.value = false;
}

watch(isOpen, async (open) => {
  if (open && props.searchable) {
    await nextTick();
    searchInputRef.value?.focus();
    return;
  }
  searchQuery.value = '';
});
</script>

<template>
  <AppPopover v-model="isOpen" align="right" :min-width="minWidth" :max-width="maxWidth">
    <template #trigger>
      <div class="ued-menu-picker" :class="{ disabled }" :style="{ minWidth: triggerMinWidth }">
        <button
          class="ued-menu-picker__trigger ued-btn ued-btn--secondary"
          :disabled="disabled"
          :title="currentItem?.name || currentId"
          @click.stop="toggleDropdown"
        >
          <span v-if="currentItem?.icon" class="ued-menu-picker__trigger-icon">{{ currentItem.icon }}</span>
          <span class="ued-menu-picker__trigger-name">{{ currentItem?.name || currentId }}</span>
          <span class="ued-menu-picker__arrow">{{ isOpen ? '▲' : '▼' }}</span>
        </button>
      </div>
    </template>

    <template #default>
      <div class="ued-menu-picker__menu">
        <div v-if="searchable" class="ued-menu-picker__search">
          <UEDInput
            ref="searchInputRef"
            :model-value="searchQuery"
            :placeholder="searchPlaceholder"
            class="ued-menu-picker__search-input"
            @update:modelValue="searchQuery = $event"
          />
        </div>

        <div class="ued-menu-picker__list">
          <div
            v-if="filteredItems.length === 0"
            class="ued-menu-picker__empty ued-meta"
          >
            {{ emptySearchText }}
          </div>

          <div
            v-for="item in filteredItems"
            :key="item.id"
            :class="['ued-menu-picker__item', { 'is-selected': item.id === currentId }]"
            @click="selectItem(item.id)"
          >
            <span v-if="item.icon" class="ued-menu-picker__item-icon">{{ item.icon }}</span>
            <div class="ued-menu-picker__item-content">
              <span class="ued-menu-picker__item-name">{{ item.name }}</span>
              <span v-if="item.description" class="ued-menu-picker__item-description">
                {{ item.description }}
              </span>
            </div>
            <span v-if="item.id === currentId" class="ued-menu-picker__check">✓</span>
          </div>
        </div>
      </div>
    </template>
  </AppPopover>
</template>

<style scoped>
.ued-menu-picker {
  position: relative;
  display: inline-flex;
}

.ued-menu-picker.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.ued-menu-picker__trigger {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  min-height: 38px;
  padding: 0.44rem 0.72rem;
  border-radius: var(--ued-radius-md);
  color: var(--ued-text-primary);
  font-size: 0.79rem;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

.ued-menu-picker__trigger:hover:not(:disabled) {
  background: var(--ued-bg-panel-hover);
  border-color: color-mix(in srgb, var(--ued-accent) 18%, var(--ued-border-default));
  transform: translateY(-1px);
}

.ued-menu-picker__trigger:disabled {
  cursor: not-allowed;
}

.ued-menu-picker__trigger-icon,
.ued-menu-picker__item-icon {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ued-accent) 8%, transparent);
}

.ued-menu-picker__trigger-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ued-menu-picker__arrow {
  font-size: 0.58rem;
  color: var(--ued-text-muted);
  margin-left: auto;
  flex-shrink: 0;
}

.ued-menu-picker__menu {
  display: flex;
  flex-direction: column;
  max-height: 360px;
  background: var(--ued-bg-panel);
  border: 1px solid var(--ued-border-default);
  border-radius: var(--ued-radius-md);
  box-shadow: var(--ued-shadow-dialog);
  overflow: hidden;
}

.ued-menu-picker__search {
  padding: 0.65rem;
  border-bottom: 1px solid var(--ued-border-subtle);
  background: color-mix(in srgb, var(--ued-bg-panel) 92%, white);
}

.ued-menu-picker__search-input {
  width: 100%;
}

.ued-menu-picker__list {
  overflow-y: auto;
}

.ued-menu-picker__empty {
  padding: 1rem 0.9rem;
  text-align: center;
}

.ued-menu-picker__item {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 18px;
  align-items: start;
  column-gap: 0.7rem;
  padding: 0.82rem 0.9rem;
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.ued-menu-picker__item:hover {
  background: var(--ued-bg-panel-hover);
}

.ued-menu-picker__item.is-selected {
  background: var(--ued-accent-soft);
}

.ued-menu-picker__item + .ued-menu-picker__item {
  border-top: 1px solid var(--ued-border-subtle);
}

.ued-menu-picker__item-content {
  min-width: 0;
}

.ued-menu-picker__item-name {
  display: block;
  font-weight: 600;
  color: var(--ued-text-primary);
  font-size: 0.85rem;
  line-height: 1.25;
}

.ued-menu-picker__item-description {
  display: block;
  font-size: 0.75rem;
  color: var(--ued-text-muted);
  margin-top: 0.2rem;
  line-height: 1.42;
  word-break: break-word;
}

.ued-menu-picker__check {
  color: var(--ued-accent);
  font-weight: 700;
  align-self: center;
  justify-self: end;
}
</style>
