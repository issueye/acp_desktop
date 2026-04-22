<script setup>
import { computed } from 'vue';
import { useSessionStore } from '../stores/session';
import { useConfigStore } from '../stores/config';
import { useI18n } from '../lib/i18n';

const props = defineProps({
  activeRoute: { type: String, default: 'chat' },
  selectedAgent: { type: String, default: '' },
  selectedCwd: { type: String, default: '' },
});

const sessionStore = useSessionStore();
const configStore = useConfigStore();
const { t } = useI18n();

const isConnected = computed(() => sessionStore.isConnected);
const isConnecting = computed(() => sessionStore.isConnecting);
const currentSession = computed(() => sessionStore.currentSession);
const savedSessionCount = computed(() => sessionStore.savedSessions.length);
const agentCount = computed(() => configStore.agentNames.length);

const statusDotClass = computed(() => {
  if (isConnecting.value) return 'status-dot--connecting';
  if (isConnected.value) return 'status-dot--connected';
  return 'status-dot--idle';
});

const statusText = computed(() => {
  if (isConnecting.value) return t('app.statusConnecting');
  if (isConnected.value) return t('app.statusConnected');
  return t('app.statusIdle');
});

const routeLabel = computed(() => {
  if (props.activeRoute === 'agents') return t('settings.agents');
  if (props.activeRoute === 'workspaces') return t('workspace.title');
  if (props.activeRoute === 'settings') return t('app.settings');
  return t('chat.titleFallback');
});
</script>

<template>
  <footer class="app-footer no-drag">
    <div class="app-footer__left">
      <span class="status-dot" :class="statusDotClass" />
      <span class="status-text">{{ statusText }}</span>
      <span v-if="isConnected && currentSession" class="footer-sep" />
      <span v-if="isConnected && currentSession" class="footer-item" :title="currentSession.title">
        {{ currentSession.title }}
      </span>
    </div>

    <div class="app-footer__center">
      <span class="footer-item">{{ routeLabel }}</span>
      <span class="footer-sep" />
      <span class="footer-item">{{ t('settings.agents') }}: {{ agentCount }}</span>
      <span class="footer-sep" />
      <span class="footer-item">{{ t('workspace.sessionUnit') }}: {{ savedSessionCount }}</span>
    </div>

    <div class="app-footer__right">
      <span v-if="selectedAgent" class="footer-item" :title="selectedAgent">
        {{ selectedAgent }}
      </span>
      <span v-if="selectedCwd" class="footer-item" :title="selectedCwd">
        {{ selectedCwd }}
      </span>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  height: 26px;
  min-height: 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0 0.75rem;
  background: var(--ued-bg-window);
  border-top: 1px solid var(--ued-border-subtle);
  color: var(--ued-text-muted);
  font-size: 0.7rem;
  user-select: none;
}

.app-footer__left,
.app-footer__center,
.app-footer__right {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.app-footer__center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.app-footer__right {
  justify-content: flex-end;
}

.app-footer__right .footer-item {
  max-width: 120px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--ued-text-muted);
}

.status-dot--idle {
  background: var(--ued-text-muted);
}

.status-dot--connecting {
  background: var(--ued-warning);
  animation: footer-pulse 1.2s ease-in-out infinite;
}

.status-dot--connected {
  background: var(--ued-success);
}

@keyframes footer-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.status-text {
  color: var(--ued-text-secondary);
  font-weight: 500;
}

.footer-sep {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--ued-border-default);
  flex-shrink: 0;
}

.footer-item {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .app-footer__center {
    display: none;
  }
}
</style>
