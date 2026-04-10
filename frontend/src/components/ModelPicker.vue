<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { ModelInfo } from '../lib/types';

const props = defineProps<{
  models: ModelInfo[];
  currentModelId: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  change: [modelId: string];
}>();

const isOpen = ref(false);

const currentModel = computed(() => 
  props.models.find(m => m.modelId === props.currentModelId)
);

function getModelIcon(modelId: string): string {
  const lower = modelId.toLowerCase();
  if (lower.includes('claude')) return '🟣';
  if (lower.includes('gpt') || lower.includes('openai')) return '🟢';
  if (lower.includes('gemini') || lower.includes('google')) return '🔵';
  if (lower.includes('llama') || lower.includes('meta')) return '🟠';
  if (lower.includes('mistral')) return '🔴';
  if (lower.includes('deepseek')) return '🟤';
  return '🤖';
}

function toggleDropdown() {
  if (!props.disabled) {
    isOpen.value = !isOpen.value;
  }
}

function selectModel(modelId: string) {
  if (modelId !== props.currentModelId) {
    emit('change', modelId);
  }
  isOpen.value = false;
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest('.model-picker')) {
    isOpen.value = false;
  }
}

onMounted(() => {
  window.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div class="model-picker" :class="{ disabled }">
    <button 
      class="model-button"
      :disabled="disabled"
      @click.stop="toggleDropdown"
      :title="currentModel?.name || currentModelId"
    >
      <span class="model-icon">{{ getModelIcon(currentModelId) }}</span>
      <span class="model-name">{{ currentModel?.name || currentModelId }}</span>
      <span class="dropdown-arrow">{{ isOpen ? '▲' : '▼' }}</span>
    </button>
    
    <Transition name="dropdown">
      <div v-if="isOpen" class="dropdown-menu" @click.stop>
        <div 
          v-for="model in models"
          :key="model.modelId"
          :class="['dropdown-item', { selected: model.modelId === currentModelId }]"
          @click="selectModel(model.modelId)"
        >
          <span class="item-icon">{{ getModelIcon(model.modelId) }}</span>
          <div class="item-content">
            <span class="item-name">{{ model.name }}</span>
            <span v-if="model.description" class="item-description">
              {{ model.description }}
            </span>
          </div>
          <span v-if="model.modelId === currentModelId" class="check-mark">✓</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.model-picker {
  position: relative;
  display: inline-flex;
  min-width: 220px;
}

.model-picker.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.model-button {
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

.model-button:hover:not(:disabled) {
  background: #ffffff;
  border-color: rgba(37, 99, 235, 0.18);
}

.model-button:disabled {
  cursor: not-allowed;
}

.model-icon {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  font-size: 0.82rem;
  flex-shrink: 0;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
}

.model-name {
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
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 348px;
  max-width: 420px;
  max-height: 360px;
  overflow-y: auto;
  background: #fffdfa;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.12);
  z-index: 100;
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
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
