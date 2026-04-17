<script setup lang="ts">
import { computed } from 'vue';
import type { ToolCallInfo } from '../lib/types';

const props = defineProps<{
  toolCall: ToolCallInfo;
}>();

const statusClass = computed(() => {
  switch (props.toolCall.status) {
    case 'pending': return 'status-pending';
    case 'in_progress': return 'status-running';
    case 'completed': return 'status-completed';
    case 'failed': return 'status-failed';
    default: return '';
  }
});

const statusIcon = computed(() => {
  switch (props.toolCall.status) {
    case 'pending': return '⏳';
    case 'in_progress': return '⚙️';
    case 'completed': return '✅';
    case 'failed': return '❌';
    default: return '🔧';
  }
});

const kindIcon = computed(() => {
  switch (props.toolCall.kind) {
    case 'read': return '📖';
    case 'edit': return '✏️';
    case 'write': return '📝';
    case 'execute': return '▶️';
    default: return '🔧';
  }
});
</script>

<template>
  <div class="tool-call-card" :class="statusClass">
    <div class="tool-header">
      <span class="kind-icon">{{ kindIcon }}</span>
      <span class="tool-title">{{ toolCall.title }}</span>
      <span class="status-icon">{{ statusIcon }}</span>
    </div>
    
    <div v-if="toolCall.locations?.length" class="tool-locations">
      <div 
        v-for="(loc, index) in toolCall.locations" 
        :key="index"
        class="location"
      >
        📁 {{ loc.path }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.tool-call-card {
  padding: 0.75rem;
  border-radius: var(--ued-radius-md);
  margin: 0.5rem 0;
  border-left: 3px solid var(--ued-border-default);
  background: var(--ued-bg-panel-muted);
}

.status-pending {
  border-left-color: var(--ued-warning);
  background: var(--ued-warning-soft);
}

.status-running {
  border-left-color: var(--ued-info);
  background: var(--ued-info-soft);
}

.status-completed {
  border-left-color: var(--ued-success);
  background: var(--ued-success-soft);
}

.status-failed {
  border-left-color: var(--ued-danger);
  background: var(--ued-danger-soft);
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.kind-icon {
  font-size: 1rem;
}

.tool-title {
  flex: 1;
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--ued-text-primary);
}

.status-icon {
  font-size: 0.875rem;
}

.tool-locations {
  margin-top: 0.5rem;
  padding-left: 1.5rem;
}

.location {
  font-family: var(--ued-font-mono);
  font-size: 0.8rem;
  color: var(--ued-text-muted);
  padding: 0.125rem 0;
}
</style>
