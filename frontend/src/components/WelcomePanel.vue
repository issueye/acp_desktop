<script setup lang="ts">
import { useI18n } from '../lib/i18n';
import UEDButton from './common/UEDButton.vue';
import UEDCard from './common/UEDCard.vue';
import UEDStatus from './common/UEDStatus.vue';

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
    <UEDCard raised class="welcome-card">
      <p class="ued-kicker">{{ t('app.welcomeEyebrow') }}</p>
      <h2 class="ued-title-1">{{ t('app.welcomeTitle') }}</h2>
      <p class="welcome-text ued-body">{{ t('app.welcomeDesc') }}</p>

      <div class="welcome-actions">
        <UEDButton variant="primary" size="lg" :disabled="isConnecting" @click="emit('openWorkspace')">
          {{ t('app.newSession') }}
        </UEDButton>
        <UEDButton variant="secondary" size="lg" @click="emit('openAddAgent')">
          {{ t('settings.addAgent') }}
        </UEDButton>
      </div>

      <div class="welcome-grid">
        <UEDCard class="welcome-stat">
          <span>{{ t('agent.label') }}</span>
          <strong>{{ selectedAgentLabel }}</strong>
        </UEDCard>
        <UEDCard class="welcome-stat">
          <span>{{ t('app.workspace') }}</span>
          <strong>{{ workspaceLabel }}</strong>
        </UEDCard>
        <UEDCard class="welcome-stat">
          <span>{{ t('app.savedSessions') }}</span>
          <div class="welcome-stat__foot">
            <strong>{{ savedSessionCount }}</strong>
            <UEDStatus kind="badge" tone="info">ACP</UEDStatus>
          </div>
        </UEDCard>
      </div>

      <p v-if="!hasAgents" class="hint-text ued-meta">{{ t('app.configureAgentsHint') }}</p>
    </UEDCard>
  </div>
</template>

<style scoped>
.welcome-screen {
  height: 100%;
  display: grid;
  place-items: center;
  padding: 2rem;
  background:
    radial-gradient(circle at top right, rgba(10, 100, 216, 0.08), transparent 28%),
    linear-gradient(180deg, var(--ued-bg-panel) 0%, var(--ued-bg-window) 100%);
}

.welcome-card {
  width: min(760px, 100%);
  overflow: hidden;
}

.welcome-text,
.hint-text {
  margin-top: 0.65rem;
  line-height: 1.7;
}

.welcome-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.4rem;
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
  min-width: 0;
}

.welcome-stat span {
  font-size: 0.76rem;
  color: var(--ued-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.welcome-stat strong {
  font-size: 0.98rem;
  color: var(--ued-text-primary);
}

.welcome-stat__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
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
