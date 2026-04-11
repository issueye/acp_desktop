<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SessionMode } from '../lib/types';
import AppPopover from './AppPopover.vue';

const props = defineProps<{
  modes: SessionMode[];
  currentModeId: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  change: [modeId: string];
}>();

const isOpen = ref(false);

const currentMode = computed(() => 
  props.modes.find(m => m.id === props.currentModeId)
);

function getModeIcon(modeId: string): string {
  switch (modeId.toLowerCase()) {
    case 'ask': return '🎯';
    case 'architect': 
    case 'plan': return '📐';
    case 'code': 
    case 'auto': return '💻';
    case 'debug': return '🐛';
    case 'review': return '👀';
    default: return '⚙️';
  }
}

function toggleDropdown() {
  if (!props.disabled) {
    isOpen.value = !isOpen.value;
  }
}

function selectMode(modeId: string) {
  if (modeId !== props.currentModeId) {
    emit('change', modeId);
  }
  isOpen.value = false;
}
</script>

<template>
  <AppPopover
    v-model="isOpen"
    align="right"
    min-width="292px"
    max-width="336px"
  >
    <template #trigger>
      <div class="mode-picker" :class="{ disabled }">
        <button 
          class="mode-button"
          :disabled="disabled"
          @click.stop="toggleDropdown"
        >
          <span class="mode-icon">{{ getModeIcon(currentModeId) }}</span>
          <span class="mode-name">{{ currentMode?.name || currentModeId }}</span>
          <span class="dropdown-arrow">{{ isOpen ? '▲' : '▼' }}</span>
        </button>
      </div>
    </template>

    <template #default>
      <div class="dropdown-menu">
        <div 
          v-for="mode in modes"
          :key="mode.id"
          :class="['dropdown-item', { selected: mode.id === currentModeId }]"
          @click="selectMode(mode.id)"
        >
          <span class="item-icon">{{ getModeIcon(mode.id) }}</span>
          <div class="item-content">
            <span class="item-name">{{ mode.name }}</span>
            <span v-if="mode.description" class="item-description">
              {{ mode.description }}
            </span>
          </div>
          <span v-if="mode.id === currentModeId" class="check-mark">✓</span>
        </div>
      </div>
    </template>
  </AppPopover>
</template>

<style scoped>
.mode-picker {
  position: relative;
  display: inline-flex;
  min-width: 172px;
}

.mode-picker.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.mode-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  min-height: 38px;
  padding: 0.44rem 0.72rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: #fffdfa;
  color: var(--text-primary);
  font-size: 0.79rem;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  box-shadow: none;
}

.mode-button:hover:not(:disabled) {
  background: #ffffff;
  border-color: rgba(37, 99, 235, 0.18);
}

.mode-button:disabled {
  cursor: not-allowed;
}

.mode-icon {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  font-size: 0.82rem;
  flex-shrink: 0;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
}

.mode-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-arrow {
  font-size: 0.58rem;
  color: var(--text-muted);
  margin-left: auto;
  flex-shrink: 0;
}

.dropdown-menu {
  background: #fffdfa;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.12);
  overflow: hidden;
}

.dropdown-item {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 18px;
  align-items: start;
  column-gap: 0.7rem;
  padding: 0.82rem 0.9rem;
  cursor: pointer;
  transition: background 0.12s ease;
}

.dropdown-item:hover {
  background: #f7f3ea;
}

.dropdown-item.selected {
  background: rgba(37, 99, 235, 0.08);
}

.dropdown-item + .dropdown-item {
  border-top: 1px solid rgba(121, 151, 176, 0.14);
}

.item-icon {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  font-size: 0.9rem;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.12);
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-name {
  display: block;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.85rem;
  line-height: 1.25;
}

.item-description {
  display: block;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.2rem;
  line-height: 1.42;
  word-break: break-word;
}

.check-mark {
  color: var(--text-accent);
  font-weight: 700;
  align-self: center;
  justify-self: end;
}

/* Dropdown animation */
</style>
