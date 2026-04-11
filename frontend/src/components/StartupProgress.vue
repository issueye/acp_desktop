<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../lib/i18n';

const props = defineProps<{
  agentName: string;
  phase: string;
  logs: string[];
  elapsedSeconds: number;
  showDetails: boolean;
}>();

const emit = defineEmits<{
  cancel: [];
  toggleDetails: [];
}>();
const { t } = useI18n();

const phaseIcon = computed(() => {
  switch (props.phase) {
    case 'starting': return '🚀';
    case 'downloading': return '📥';
    case 'installing': return '📦';
    case 'building': return '🔨';
    case 'initializing': return '⚙️';
    case 'connecting': return '🔗';
    default: return '⏳';
  }
});

const phaseText = computed(() => {
  switch (props.phase) {
    case 'starting': return t('startup.phase.starting');
    case 'downloading': return t('startup.phase.downloading');
    case 'installing': return t('startup.phase.installing');
    case 'building': return t('startup.phase.building');
    case 'initializing': return t('startup.phase.initializing');
    case 'connecting': return t('startup.phase.connecting');
    default: return t('startup.phase.waiting');
  }
});

const formattedTime = computed(() => {
  const mins = Math.floor(props.elapsedSeconds / 60);
  const secs = props.elapsedSeconds % 60;
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
});

const isLongWait = computed(() => props.elapsedSeconds > 10);
</script>

<template>
  <div class="startup-progress">
    <div class="progress-header">
      <span class="agent-name">{{ t('startup.connectingTo', { agent: agentName }) }}</span>
      <span class="elapsed-time">{{ formattedTime }}</span>
    </div>
    
    <div class="progress-status">
      <span class="phase-icon">{{ phaseIcon }}</span>
      <span class="phase-text">{{ phaseText }}</span>
    </div>
    
    <div v-if="isLongWait && !showDetails" class="first-run-hint">
      {{ t('startup.firstRunHint') }}
    </div>
    
    <div class="progress-actions">
      <button 
        class="details-btn"
        @click="emit('toggleDetails')"
      >
        {{ showDetails ? t('startup.hideDetails') : t('startup.showDetails') }}
      </button>
      <button 
        class="cancel-btn"
        @click="emit('cancel')"
      >
        {{ t('common.cancel') }}
      </button>
    </div>
    
    <div v-if="showDetails" class="logs-container">
      <div class="logs-header">{{ t('startup.output') }}</div>
      <div class="logs-content">
        <div 
          v-for="(log, index) in logs.slice(-50)" 
          :key="index"
          class="log-line"
        >
          {{ log }}
        </div>
        <div v-if="logs.length === 0" class="no-logs">
          {{ t('startup.waitingOutput') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.startup-progress {
  padding: 1rem;
  background: #fbfbfc;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 8px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.agent-name {
  font-weight: 600;
  color: var(--text-primary);
}

.elapsed-time {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-family: monospace;
}

.progress-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0.8rem;
  background: #ffffff;
  border-radius: 8px;
  margin-bottom: 0.75rem;
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.phase-icon {
  font-size: 1.2rem;
}

.phase-text {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.first-run-hint {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 0.75rem;
  padding: 0.65rem 0.75rem;
  background: #fff8e8;
  border-radius: 8px;
}

.progress-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: space-between;
}

.details-btn {
  padding: 0.48rem 0.85rem;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: #ffffff;
  color: var(--text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
}

.details-btn:hover {
  background: #f8fafc;
}

.cancel-btn {
  padding: 0.48rem 0.85rem;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: #ffffff;
  color: var(--text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
}

.cancel-btn:hover {
  background: #f8fafc;
  border-color: var(--bg-danger);
  color: var(--bg-danger);
}

.logs-container {
  margin-top: 0.75rem;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 8px;
  overflow: hidden;
}

.logs-header {
  padding: 0.5rem 0.65rem;
  background: #ffffff;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.logs-content {
  max-height: 150px;
  overflow-y: auto;
  padding: 0.7rem;
  background: #f6f7f9;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 0.7rem;
}

.log-line {
  color: var(--text-code);
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.4;
}

.no-logs {
  color: var(--text-muted);
  font-style: italic;
}
</style>
