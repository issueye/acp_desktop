<script setup lang="ts">
import { useI18n } from '../lib/i18n';

defineProps<{
  hasAgents: boolean;
  selectedAgentLabel: string;
  workspaceLabel: string;
  savedSessionCount: number;
  isConnecting: boolean;
}>();

const emit = defineEmits<{
  openWorkspace: [];
  openAddAgent: [];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="welcome-screen">
    <div class="welcome-card">
      <p class="eyebrow">{{ t('app.welcomeEyebrow') }}</p>
      <h2>{{ t('app.welcomeTitle') }}</h2>
      <p class="welcome-text">{{ t('app.welcomeDesc') }}</p>

      <div class="welcome-actions">
        <button class="primary-button" :disabled="isConnecting" @click="emit('openWorkspace')">
          {{ t('app.newSession') }}
        </button>
        <button class="secondary-button" @click="emit('openAddAgent')">
          {{ t('settings.addAgent') }}
        </button>
      </div>

      <div class="welcome-grid">
        <div class="welcome-stat">
          <span>{{ t('agent.label') }}</span>
          <strong>{{ selectedAgentLabel }}</strong>
        </div>
        <div class="welcome-stat">
          <span>{{ t('app.workspace') }}</span>
          <strong>{{ workspaceLabel }}</strong>
        </div>
        <div class="welcome-stat">
          <span>{{ t('app.savedSessions') }}</span>
          <strong>{{ savedSessionCount }}</strong>
        </div>
      </div>

      <p v-if="!hasAgents" class="hint-text">{{ t('app.configureAgentsHint') }}</p>
    </div>
  </div>
</template>

<style scoped>
.welcome-screen {
  height: 100%;
  display: grid;
  place-items: center;
  padding: 2rem;
  background: linear-gradient(180deg, #ffffff 0%, #fcfaf6 100%);
}

.welcome-card {
  width: min(760px, 100%);
  padding: 2rem;
  border-radius: 8px;
  background: #fffdfa;
  border: 1px solid rgba(15, 23, 42, 0.06);
  box-shadow: var(--shadow-md);
}

.eyebrow {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

h2 {
  margin-top: 0.35rem;
  font-size: 1.15rem;
  color: var(--text-primary);
}

.welcome-text,
.hint-text {
  margin-top: 0.65rem;
  line-height: 1.7;
  color: var(--text-secondary);
}

.welcome-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.4rem;
}

.primary-button,
.secondary-button {
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
}

.primary-button {
  padding: 0.72rem 1rem;
  background: var(--bg-primary);
  color: white;
  border-color: rgba(37, 99, 235, 0.18);
  box-shadow: 0 1px 2px rgba(37, 99, 235, 0.16);
}

.primary-button:hover:not(:disabled) {
  transform: translateY(-1px);
  background: var(--bg-primary-hover);
  border-color: rgba(37, 99, 235, 0.22);
}

.secondary-button {
  padding: 0.68rem 0.95rem;
  background: #fffdfa;
  color: var(--text-secondary);
  border-color: rgba(15, 23, 42, 0.08);
}

.secondary-button:hover {
  color: var(--text-accent);
  border-color: rgba(37, 99, 235, 0.14);
  background: #ffffff;
}

.welcome-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
  margin-top: 1.6rem;
}

.welcome-stat {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 1rem;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.welcome-stat span {
  font-size: 0.76rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.welcome-stat strong {
  font-size: 0.98rem;
  color: var(--text-primary);
}

@media (max-width: 900px) {
  .welcome-grid {
    grid-template-columns: 1fr;
  }

  .welcome-actions {
    flex-direction: column;
  }
}
</style>
