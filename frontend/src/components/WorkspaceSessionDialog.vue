<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../lib/i18n';
import AppModal from './AppModal.vue';
import AgentSelector from './AgentSelector.vue';
import StartupProgress from './StartupProgress.vue';

const props = defineProps<{
  modelValue: boolean;
  hasAgents: boolean;
  isConnecting: boolean;
  isLoading: boolean;
  selectedAgent: string;
  selectedCwd: string;
  selectedCwdLabel: string;
  proxyEnabled: boolean;
  httpProxy: string;
  httpsProxy: string;
  allProxy: string;
  noProxy: string;
  startupPhase: string;
  startupLogs: string[];
  startupElapsed: number;
  showStartupDetails: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'update:selectedAgent': [value: string];
  'update:proxyEnabled': [value: boolean];
  'update:httpProxy': [value: string];
  'update:httpsProxy': [value: string];
  'update:allProxy': [value: string];
  'update:noProxy': [value: string];
  'update:showStartupDetails': [value: boolean];
  selectFolder: [];
  createSession: [];
  openAddAgent: [];
  cancelConnection: [];
}>();

const { t } = useI18n();

const selectedAgentModel = computed({
  get: () => props.selectedAgent,
  set: (value: string) => emit('update:selectedAgent', value),
});

function closeDialog() {
  if (props.isConnecting) {
    return;
  }
  emit('update:modelValue', false);
}
</script>

<template>
  <AppModal
    :model-value="modelValue"
    max-width="1080px"
    :close-on-backdrop="!isConnecting"
    @update:modelValue="(value) => emit('update:modelValue', value)"
    @close="closeDialog"
  >
    <div class="workspace-dialog">
      <div class="dialog-header workspace-header">
        <div class="header-copy">
          <p class="eyebrow">{{ t('app.workspace') }}</p>
          <h2>{{ t('app.sessionSetupTitle') }}</h2>
        </div>
        <button class="icon-button" :disabled="isConnecting" @click="closeDialog">×</button>
      </div>

      <div v-if="!hasAgents" class="empty-workspace panel-card">
        <h3>{{ t('app.noAgentTitle') }}</h3>
        <p>{{ t('app.noAgentDesc') }}</p>
        <button class="primary-button" @click="emit('openAddAgent')">{{ t('settings.addAgent') }}</button>
      </div>

      <template v-else>
        <section class="workspace-hero">
          <div class="hero-copy">
            <p class="eyebrow">{{ t('app.sessionLauncher') }}</p>
            <h3>{{ t('app.sessionSetupDesc') }}</h3>
          </div>
          <div class="hero-metrics">
            <div class="hero-metric">
              <span>{{ t('agent.label') }}</span>
              <strong>{{ selectedAgent || t('agent.select') }}</strong>
            </div>
            <div class="hero-metric">
              <span>{{ t('app.workspace') }}</span>
              <strong :title="selectedCwd || '.'">{{ selectedCwdLabel }}</strong>
            </div>
            <div class="hero-metric">
              <span>{{ t('app.proxy') }}</span>
              <strong>{{ proxyEnabled ? t('app.proxyEnable') : t('app.proxyDisabled') }}</strong>
            </div>
          </div>
        </section>

        <div class="dialog-grid">
          <div class="dialog-main">
            <section class="dialog-section">
              <div class="dialog-section-head">
                <div>
                  <p class="eyebrow">{{ t('agent.label') }}</p>
                  <h3>{{ t('agent.label') }}</h3>
                </div>
              </div>
              <AgentSelector v-model:selected="selectedAgentModel" />
            </section>

            <section class="dialog-section">
              <div class="section-headline">
                <div>
                  <p class="eyebrow">{{ t('app.workspace') }}</p>
                  <h3>{{ t('app.workingDirectory') }}</h3>
                </div>
                <button class="ghost-button" @click="emit('selectFolder')">{{ t('app.selectFolder') }}</button>
              </div>
              <div class="cwd-card" :title="selectedCwd || t('app.currentDirectory')">
                <strong>{{ selectedCwdLabel }}</strong>
                <span>{{ selectedCwd || '.' }}</span>
              </div>
            </section>

            <section class="dialog-section">
              <div class="section-headline">
                <div>
                  <p class="eyebrow">{{ t('app.proxy') }}</p>
                  <h3>{{ t('app.proxy') }}</h3>
                </div>
                <label class="proxy-switch">
                  <input
                    :checked="proxyEnabled"
                    type="checkbox"
                    :disabled="isConnecting"
                    @change="emit('update:proxyEnabled', ($event.target as HTMLInputElement).checked)"
                  />
                  <span>{{ t('app.proxyEnable') }}</span>
                </label>
              </div>
              <div class="proxy-grid" :class="{ disabled: !proxyEnabled }">
                <label class="proxy-field">
                  <span>{{ t('app.proxyHttp') }}</span>
                  <input
                    :value="httpProxy"
                    type="text"
                    :placeholder="t('app.proxySampleHost')"
                    :disabled="!proxyEnabled || isConnecting"
                    @input="emit('update:httpProxy', ($event.target as HTMLInputElement).value)"
                  />
                </label>
                <label class="proxy-field">
                  <span>{{ t('app.proxyHttps') }}</span>
                  <input
                    :value="httpsProxy"
                    type="text"
                    :placeholder="t('app.proxySampleHost')"
                    :disabled="!proxyEnabled || isConnecting"
                    @input="emit('update:httpsProxy', ($event.target as HTMLInputElement).value)"
                  />
                </label>
                <label class="proxy-field">
                  <span>{{ t('app.proxyAll') }}</span>
                  <input
                    :value="allProxy"
                    type="text"
                    :placeholder="t('app.proxySampleHost')"
                    :disabled="!proxyEnabled || isConnecting"
                    @input="emit('update:allProxy', ($event.target as HTMLInputElement).value)"
                  />
                </label>
                <label class="proxy-field">
                  <span>{{ t('app.proxyNo') }}</span>
                  <input
                    :value="noProxy"
                    type="text"
                    :placeholder="t('app.proxySampleNo')"
                    :disabled="!proxyEnabled || isConnecting"
                    @input="emit('update:noProxy', ($event.target as HTMLInputElement).value)"
                  />
                </label>
              </div>
            </section>
          </div>

          <aside class="dialog-side">
            <div class="launch-card">
              <div class="launch-copy">
                <p class="eyebrow">{{ t('app.workspaceSummary') }}</p>
                <h3>{{ t('app.newSession') }}</h3>
                <p class="launch-text">{{ t('app.sessionSetupDesc') }}</p>
              </div>
              <div class="summary-card">
                <div class="summary-line">
                  <span>{{ t('agent.label') }}</span>
                  <strong>{{ selectedAgent || '--' }}</strong>
                </div>
                <div class="summary-line">
                  <span>{{ t('app.workspace') }}</span>
                  <strong :title="selectedCwd || '.'">{{ selectedCwdLabel }}</strong>
                </div>
                <div class="summary-line">
                  <span>{{ t('app.proxy') }}</span>
                  <strong>{{ proxyEnabled ? t('app.proxyEnable') : t('app.proxyDisabled') }}</strong>
                </div>
              </div>
              <div v-if="!isConnecting" class="dialog-actions launch-actions">
                <button class="primary-button" :disabled="!selectedAgent || isLoading" @click="emit('createSession')">
                  {{ isLoading ? t('app.connecting') : t('app.newSession') }}
                </button>
                <button class="secondary-button" @click="closeDialog">{{ t('common.cancel') }}</button>
              </div>
            </div>

            <StartupProgress
              v-if="isConnecting"
              :agent-name="selectedAgent"
              :phase="startupPhase"
              :logs="startupLogs"
              :elapsed-seconds="startupElapsed"
              :show-details="showStartupDetails"
              @cancel="emit('cancelConnection')"
              @toggle-details="emit('update:showStartupDetails', !showStartupDetails)"
            />
          </aside>
        </div>
      </template>
    </div>
  </AppModal>
</template>

<style scoped>
.workspace-dialog {
  width: min(1080px, 100%);
  max-height: calc(100vh - 64px);
  overflow: auto;
  padding: 1.25rem;
  background: #f9f7f2;
}

.workspace-header,
.dialog-header,
.summary-line,
.section-headline,
.dialog-section-head,
.proxy-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.workspace-header {
  margin-bottom: 0.8rem;
  padding: 0 0 0.5rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  min-height: 0;
}

.eyebrow {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.header-copy h2 {
  margin-top: 0.12rem;
  font-size: 1.16rem;
  line-height: 1.2;
}

.icon-button {
  width: 30px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: #ffffff;
  color: var(--text-secondary);
  border: 1px solid rgba(15, 23, 42, 0.06);
  cursor: pointer;
}

.icon-button:hover {
  border-color: rgba(15, 23, 42, 0.1);
  color: var(--text-primary);
}

.workspace-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(360px, 0.95fr);
  gap: 0.9rem;
  padding: 1rem 1.05rem;
  margin-bottom: 0.95rem;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: linear-gradient(180deg, #ffffff 0%, #fcfbf8 100%);
}

.hero-copy h3 {
  font-size: 1.03rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.55;
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.7rem;
}

.hero-metric {
  padding: 0.9rem 0.95rem;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: #ffffff;
}

.hero-metric span {
  display: block;
  font-size: 0.72rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.hero-metric strong {
  display: block;
  margin-top: 0.32rem;
  font-size: 0.95rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dialog-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.92fr);
  gap: 0.85rem;
  align-items: start;
}

.dialog-main,
.dialog-side,
.launch-card,
.launch-copy,
.dialog-actions,
.proxy-field {
  display: flex;
  flex-direction: column;
}

.dialog-main,
.dialog-side,
.launch-card {
  gap: 0.75rem;
}

.dialog-section {
  padding: 1rem 1.05rem;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: #ffffff;
}

.dialog-section-head {
  margin-bottom: 0.7rem;
}

.dialog-section h3,
.section-headline h3,
.launch-copy h3 {
  font-size: 0.98rem;
  font-weight: 600;
  color: var(--text-primary);
}

.ghost-button,
.secondary-button,
.primary-button {
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
}

.ghost-button,
.secondary-button {
  padding: 0.68rem 0.95rem;
  background: #fffdfa;
  color: var(--text-secondary);
  border-color: rgba(15, 23, 42, 0.08);
}

.ghost-button:hover,
.secondary-button:hover {
  color: var(--text-accent);
  border-color: rgba(37, 99, 235, 0.14);
  background: #ffffff;
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

.cwd-card {
  gap: 0.35rem;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: #f9fbff;
}

.cwd-card strong {
  font-size: 1rem;
  color: var(--text-primary);
}

.cwd-card span,
.summary-line,
.proxy-switch {
  color: var(--text-secondary);
}

.proxy-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 0.9rem;
  gap: 0.75rem;
}

.proxy-grid.disabled {
  opacity: 0.58;
}

.proxy-field span {
  font-size: 0.76rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.proxy-field input {
  width: 100%;
  height: 40px;
  margin-top: 0.35rem;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: #fffdfa;
  color: var(--text-primary);
  padding: 0 0.9rem;
}

.proxy-field input:focus {
  outline: none;
  border-color: rgba(37, 99, 235, 0.32);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

.launch-card {
  padding: 1rem 1.05rem;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: #ffffff;
  position: sticky;
  top: 0;
}

.launch-text {
  font-size: 0.88rem;
  line-height: 1.65;
  color: var(--text-secondary);
}

.summary-card {
  padding: 0.15rem 0;
  background: transparent;
}

.summary-line {
  margin-top: 0.8rem;
}

.summary-line:first-child {
  margin-top: 0;
}

.summary-line strong {
  color: var(--text-primary);
  text-align: right;
}

.launch-actions {
  gap: 0.75rem;
  margin-top: 0.35rem;
}

.empty-workspace {
  display: grid;
  place-items: center;
  gap: 0.75rem;
  padding: 3rem 1.5rem;
  text-align: center;
  border-radius: 8px;
  background: #fffdfa;
  border: 1px solid rgba(15, 23, 42, 0.06);
}

@media (max-width: 1180px) {
  .workspace-hero,
  .dialog-grid {
    grid-template-columns: 1fr;
  }

  .launch-card {
    position: static;
  }
}

@media (max-width: 900px) {
  .hero-metrics,
  .proxy-grid {
    grid-template-columns: 1fr;
  }

  .workspace-dialog {
    padding: 1rem;
  }
}
</style>
