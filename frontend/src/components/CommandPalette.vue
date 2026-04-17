<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { SlashCommand } from '../lib/types';

const props = defineProps<{
  commands: SlashCommand[];
  filter: string;
  visible: boolean;
}>();

const emit = defineEmits<{
  select: [command: SlashCommand];
  close: [];
}>();

const selectedIndex = ref(0);

// Filter commands based on input
const filteredCommands = computed(() => {
  const filterText = props.filter.toLowerCase();
  if (!filterText) return props.commands;
  return props.commands.filter(cmd => 
    cmd.name.toLowerCase().startsWith(filterText) ||
    cmd.description.toLowerCase().includes(filterText)
  );
});

// Reset selection when filter or visibility changes
watch([() => props.filter, () => props.visible], () => {
  selectedIndex.value = 0;
});

function handleKeyDown(event: KeyboardEvent) {
  if (!props.visible || filteredCommands.value.length === 0) return;
  
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      selectedIndex.value = (selectedIndex.value + 1) % filteredCommands.value.length;
      break;
    case 'ArrowUp':
      event.preventDefault();
      selectedIndex.value = (selectedIndex.value - 1 + filteredCommands.value.length) % filteredCommands.value.length;
      break;
    case 'Enter':
      event.preventDefault();
      if (filteredCommands.value[selectedIndex.value]) {
        emit('select', filteredCommands.value[selectedIndex.value]);
      }
      break;
    case 'Escape':
      event.preventDefault();
      emit('close');
      break;
    case 'Tab':
      event.preventDefault();
      if (filteredCommands.value[selectedIndex.value]) {
        emit('select', filteredCommands.value[selectedIndex.value]);
      }
      break;
  }
}

// Expose keyboard handler for parent to call
defineExpose({ handleKeyDown });

function selectCommand(cmd: SlashCommand) {
  emit('select', cmd);
}
</script>

<template>
  <div 
    v-if="visible && filteredCommands.length > 0"
    ref="paletteRef"
    class="command-palette"
  >
    <div class="command-list">
      <div 
        v-for="(cmd, index) in filteredCommands"
        :key="cmd.name"
        :class="['command-item', { selected: index === selectedIndex }]"
        @click="selectCommand(cmd)"
        @mouseenter="selectedIndex = index"
      >
        <div class="command-row">
          <span class="command-name">/{{ cmd.name }}</span>
          <span class="command-description">{{ cmd.description }}</span>
        </div>
      </div>
    </div>
    <!-- Tooltip on right side for selected item -->
    <div 
      v-if="filteredCommands[selectedIndex]?.description"
      class="command-tooltip"
    >
      {{ filteredCommands[selectedIndex].description }}
    </div>
  </div>
</template>

<style scoped>
.command-palette {
  position: absolute;
  bottom: 100%;
  left: 0;
  width: min(460px, calc(100vw - 48px));
  margin-bottom: 10px;
  background: var(--ued-bg-panel);
  border: 1px solid var(--ued-border-default);
  border-radius: var(--ued-radius-md);
  box-shadow: var(--ued-shadow-dialog);
  max-height: 320px;
  overflow: visible;
  z-index: 100;
}

.command-list {
  max-height: 320px;
  overflow-y: auto;
}

.command-item {
  padding: 11px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--ued-border-subtle);
  background: transparent;
  display: flex;
  align-items: center;
  transition: background 0.12s;
  position: relative;
}
.command-item:last-child {
  border-bottom: none;
}
.command-item.selected {
  background: var(--ued-accent-soft);
  color: var(--ued-text-primary);
}
.command-item.selected .command-name,
.command-item.selected .command-hint,
.command-item.selected .command-description,
.command-item.selected .command-source {
  color: var(--ued-text-primary);
}

.command-tooltip {
  position: absolute;
  left: calc(100% + 8px);
  top: 0;
  width: 220px;
  background: var(--ued-bg-panel);
  color: var(--ued-text-primary);
  border: 1px solid var(--ued-border-default);
  border-radius: var(--ued-radius-md);
  box-shadow: var(--ued-shadow-panel);
  padding: 10px 12px;
  font-size: 0.9em;
  white-space: normal;
  z-index: 200;
  word-break: break-word;
}
.command-item:hover:not(.selected) {
  background: var(--ued-bg-panel-hover);
}

/* Command row: command and description on same line */
.command-row {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 0;
}
.command-name {
  font-weight: 600;
  color: var(--ued-accent);
  font-family: var(--ued-font-mono);
  font-size: 1em;
  min-width: 110px;
  max-width: 140px;
  flex-shrink: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.command-description {
  color: var(--ued-text-secondary);
  font-size: 0.93em;
  margin-left: 18px;
  flex: 1 1 auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.command-item.selected .command-name,
.command-item.selected .command-description {
  color: var(--ued-text-primary);
}

@media (max-width: 900px) {
  .command-palette {
    left: 0;
    right: 0;
    width: auto;
  }

  .command-tooltip {
    display: none;
  }
}
</style>
