<script setup>
import { computed } from 'vue';
import { useI18n } from '../lib/i18n';
import UEDButton from './common/UEDButton.vue';
import UEDCard from './common/UEDCard.vue';

const props = defineProps({
    agentName: { type: String, required: true },
    phase: { type: String, required: true },
    logs: { type: Array, required: true },
    elapsedSeconds: { type: Number, required: true },
    showDetails: { type: Boolean, required: true },
});

const emit = defineEmits(['cancel', 'toggleDetails']);
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
  <UEDCard class="startup-progress">
    <div class="progress-header">
      <span class="agent-name">{{ t('startup.connectingTo', { agent: agentName }) }}</span>
      <span class="elapsed-time ued-code">{{ formattedTime }}</span>
    </div>
    
    <UEDCard muted class="progress-status">
      <span class="phase-icon">{{ phaseIcon }}</span>
      <span class="phase-text">{{ phaseText }}</span>
    </UEDCard>
    
    <div v-if="isLongWait && !showDetails" class="first-run-hint ued-meta">
      {{ t('startup.firstRunHint') }}
    </div>
    
    <div class="progress-actions">
      <UEDButton variant="secondary" size="sm" @click="emit('toggleDetails')">
        {{ showDetails ? t('startup.hideDetails') : t('startup.showDetails') }}
      </UEDButton>
      <UEDButton variant="secondary" size="sm" @click="emit('cancel')">
        {{ t('common.cancel') }}
      </UEDButton>
    </div>
    
    <UEDCard v-if="showDetails" class="logs-container" :padded="false">
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
    </UEDCard>
  </UEDCard>
</template>

<style scoped>
.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.agent-name {
  font-weight: 600;
  color: var(--ued-text-primary);
}

.elapsed-time {
  font-size: 0.8rem;
}

.progress-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.phase-icon {
  font-size: 1.2rem;
}

.phase-text {
  color: var(--ued-text-secondary);
  font-size: 0.9rem;
}

.first-run-hint {
  font-size: 0.8rem;
  margin-bottom: 0.75rem;
  padding: 0.65rem 0.75rem;
  background: var(--ued-warning-soft);
  border-radius: var(--ued-radius-md);
}

.progress-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: space-between;
}

.logs-container {
  margin-top: 0.75rem;
  overflow: hidden;
}

.logs-header {
  padding: 0.5rem 0.65rem;
  background: var(--ued-bg-panel);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ued-text-secondary);
  border-bottom: 1px solid var(--ued-border-default);
}

.logs-content {
  max-height: 150px;
  overflow-y: auto;
  padding: 0.7rem;
  background: var(--ued-bg-panel-muted);
  font-family: var(--ued-font-mono);
  font-size: 0.7rem;
}

.log-line {
  color: var(--ued-text-primary);
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.4;
}

.no-logs {
  color: var(--ued-text-muted);
  font-style: italic;
}
</style>
