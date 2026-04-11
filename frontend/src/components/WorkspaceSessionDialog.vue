<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../lib/i18n';
import AppDialogShell from './AppDialogShell.vue';
import AgentSelector from './AgentSelector.vue';
import StartupProgress from './StartupProgress.vue';

const props = defineProps<{
  modelValue: boolean;
  hasAgents: boolean;
  isConnecting: boolean;
  isLoading: boolean;
  isSelectingFolder: boolean;
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

type ValidationTone = 'warning' | 'danger';

type ValidationItem = {
  id: string;
  message: string;
  tone?: ValidationTone;
};

const selectedAgentModel = computed({
  get: () => props.selectedAgent,
  set: (value: string) => emit('update:selectedAgent', value),
});

function isValidProxyUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return ['http:', 'https:', 'socks:', 'socks4:', 'socks5:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

const validationItems = computed<ValidationItem[]>(() => {
  const items: ValidationItem[] = [];

  if (!props.selectedAgent) {
    items.push({
      id: 'agent-required',
      message: t('app.validationAgentRequired'),
      tone: 'warning',
    });
  }

  if (props.proxyEnabled) {
    const hasAnyProxyValue =
      !!props.httpProxy.trim() || !!props.httpsProxy.trim() || !!props.allProxy.trim();

    if (!hasAnyProxyValue) {
      items.push({
        id: 'proxy-required',
        message: t('app.validationProxyRequired'),
        tone: 'warning',
      });
    }

    if (!isValidProxyUrl(props.httpProxy)) {
      items.push({
        id: 'proxy-http-invalid',
        message: t('app.validationProxyHttpInvalid'),
        tone: 'danger',
      });
    }

    if (!isValidProxyUrl(props.httpsProxy)) {
      items.push({
        id: 'proxy-https-invalid',
        message: t('app.validationProxyHttpsInvalid'),
        tone: 'danger',
      });
    }

    if (!isValidProxyUrl(props.allProxy)) {
      items.push({
        id: 'proxy-all-invalid',
        message: t('app.validationProxyAllInvalid'),
        tone: 'danger',
      });
    }
  }

  return items;
});

const hasValidationError = computed(() =>
  validationItems.value.some((item) => item.tone === 'danger')
);

const canCreateSession = computed(
  () =>
    !props.isConnecting &&
    !props.isLoading &&
    !props.isSelectingFolder &&
    validationItems.value.length === 0
);

function closeDialog() {
  if (props.isConnecting) {
    return;
  }
  emit('update:modelValue', false);
}
</script>

<template>
  <AppDialogShell
    :model-value="modelValue"
    :title="t('app.sessionSetupTitle')"
    :eyebrow="t('app.sessionLauncher')"
    max-width="1080px"
    :close-on-backdrop="!isConnecting"
    :close-on-escape="!isConnecting"
    :show-close="!isConnecting"
    body-class="workspace-dialog"
    @update:modelValue="(value) => emit('update:modelValue', value)"
    @close="closeDialog"
  >
    <template #header-extra>
    </template>

    <div v-if="!hasAgents" class="empty-workspace panel-card">
      <h3>{{ t('app.noAgentTitle') }}</h3>
      <p>{{ t('app.noAgentDesc') }}</p>
      <button class="primary-button" @click="emit('openAddAgent')">{{ t('settings.addAgent') }}</button>
    </div>

    <template v-else>
      <div class="workspace-layout">
        <div class="dialog-main">
          <section class="workspace-hero">
            <p class="eyebrow">{{ t('app.sessionLauncher') }}</p>
            <div class="hero-copy">
              <h3>{{ t('app.sessionSetupTitle') }}</h3>
              <p class="hero-text">{{ t('app.sessionSetupDesc') }}</p>
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

          <section class="dialog-section">
            <AgentSelector v-model:selected="selectedAgentModel" />
          </section>

          <section class="dialog-section">
            <div class="section-headline">
              <div>
                <h3>{{ t('app.workingDirectory') }}</h3>
              </div>
              <button
                class="icon-ghost-button"
                :disabled="props.isSelectingFolder || props.isConnecting"
                :title="props.isSelectingFolder ? t('app.selectingFolder') : t('app.selectFolder')"
                :aria-label="props.isSelectingFolder ? t('app.selectingFolder') : t('app.selectFolder')"
                @click="emit('selectFolder')"
              >
                <svg
                  class="folder-picker-icon"
                  :class="{ spinning: props.isSelectingFolder }"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2.5 6.5a1.5 1.5 0 0 1 1.5-1.5h3.3l1.3 1.6H16a1.5 1.5 0 0 1 1.5 1.5v5.9a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 14V6.5Z"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M10 8.4v4.2M7.9 10.5h4.2"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>
            <div class="cwd-card" :title="selectedCwd || t('app.currentDirectory')">
              <div class="cwd-badge">#</div>
              <div class="cwd-copy">
                <strong>{{ selectedCwdLabel }}</strong>
                <span>{{ selectedCwd || '.' }}</span>
              </div>
            </div>
            <p class="section-hint">
              {{ t('app.validationWorkspaceHint') }}
            </p>
          </section>

          <section class="dialog-section">
            <div class="section-headline">
              <div>
                <h3>{{ t('app.proxy') }}</h3>
              </div>
              <label class="proxy-switch" :class="{ enabled: proxyEnabled }">
                <input
                  :checked="proxyEnabled"
                  type="checkbox"
                  :disabled="isConnecting"
                  @change="emit('update:proxyEnabled', ($event.target as HTMLInputElement).checked)"
                />
                <span class="switch-track"><span class="switch-thumb"></span></span>
                <span>{{ proxyEnabled ? t('app.proxyEnable') : t('app.proxyDisabled') }}</span>
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
            <div v-if="validationItems.some((item) => item.id.startsWith('proxy-'))" class="validation-list">
              <div
                v-for="item in validationItems.filter((entry) => entry.id.startsWith('proxy-'))"
                :key="item.id"
                class="validation-item"
                :class="item.tone || 'warning'"
              >
                {{ item.message }}
              </div>
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
            <div class="launch-note">
              <span class="launch-note-mark">i</span>
              <p>{{ validationItems.length === 0 ? t('app.validationReady') : t('app.sessionSetupDesc') }}</p>
            </div>
            <div v-if="validationItems.length > 0" class="validation-panel">
              <strong>
                {{
                  hasValidationError
                    ? t('app.validationProxyIssueTitle')
                    : t('app.validationActionRequired')
                }}
              </strong>
              <div class="validation-list compact">
                <div
                  v-for="item in validationItems"
                  :key="item.id"
                  class="validation-item"
                  :class="item.tone || 'warning'"
                >
                  {{ item.message }}
                </div>
              </div>
            </div>
            <div v-if="!isConnecting" class="dialog-actions launch-actions">
              <button class="primary-button" :disabled="!canCreateSession" @click="emit('createSession')">
                {{
                  props.isSelectingFolder
                    ? t('app.selectingFolder')
                    : isLoading
                      ? t('app.connecting')
                      : t('app.newSession')
                }}
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
  </AppDialogShell>
</template>

<style scoped>
.workspace-dialog {
  padding: 1rem;
  background: linear-gradient(180deg, #f9f7f2 0%, #f6f4ef 100%);
}

.workspace-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.88fr);
  gap: 1rem;
  align-items: start;
}

.summary-line,
.section-headline,
.dialog-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.eyebrow {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.header-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.summary-chip {
  max-width: 180px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  padding: 0 0.72rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(15, 23, 42, 0.06);
  color: var(--text-primary);
  font-size: 0.76rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.summary-chip.muted {
  color: var(--text-secondary);
}

.workspace-hero {
  display: flex;
  flex-direction: column;
  gap: 0.95rem;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
}

.hero-copy h3 {
  font-size: 1.08rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.hero-text {
  margin-top: 0.4rem;
  font-size: 0.86rem;
  line-height: 1.65;
  color: var(--text-secondary);
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

.dialog-main,
.dialog-side,
.launch-card,
.launch-copy,
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
  padding: 0.95rem 1rem 1rem;
  border-radius: 8px;
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
  min-height: 36px;
  padding: 0.6rem 0.9rem;
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

.ghost-button:disabled,
.secondary-button:disabled,
.primary-button:disabled {
  opacity: 0.58;
  cursor: not-allowed;
}

.icon-ghost-button {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: #fffdfa;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.icon-ghost-button:hover {
  color: var(--text-accent);
  border-color: rgba(37, 99, 235, 0.14);
  background: #ffffff;
}

.icon-ghost-button:disabled {
  opacity: 0.58;
  cursor: not-allowed;
}

.folder-picker-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.folder-picker-icon.spinning {
  animation: folder-picker-spin 0.9s linear infinite;
}

.primary-button {
  min-height: 38px;
  padding: 0.68rem 1rem;
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
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: #f9fbff;
}

.cwd-badge {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: var(--text-accent);
  background: rgba(37, 99, 235, 0.1);
  font-weight: 700;
}

.cwd-copy {
  min-width: 0;
}

.cwd-card strong {
  display: block;
  font-size: 1rem;
  color: var(--text-primary);
}

.cwd-card span {
  display: block;
  margin-top: 0.18rem;
  color: var(--text-secondary);
}

.section-hint {
  margin-top: 0.7rem;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--text-muted);
}

.summary-line {
  color: var(--text-secondary);
}

.proxy-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  cursor: pointer;
  color: var(--text-secondary);
  user-select: none;
}

.proxy-switch input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.switch-track {
  width: 38px;
  height: 22px;
  padding: 2px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.5);
  border: 1px solid rgba(15, 23, 42, 0.08);
  transition: background 0.18s ease, border-color 0.18s ease;
}

.switch-thumb {
  width: 16px;
  height: 16px;
  display: block;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.15);
  transition: transform 0.18s ease;
}

.proxy-switch.enabled .switch-track {
  background: rgba(37, 99, 235, 0.9);
  border-color: rgba(37, 99, 235, 0.16);
}

.proxy-switch.enabled .switch-thumb {
  transform: translateX(16px);
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

.validation-panel {
  padding: 0.9rem 0.95rem;
  border-radius: 8px;
  background: #fffdfa;
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.validation-panel strong {
  display: block;
  margin-bottom: 0.7rem;
  font-size: 0.84rem;
  color: var(--text-primary);
}

.validation-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.85rem;
}

.validation-list.compact {
  margin-top: 0;
}

.validation-item {
  padding: 0.68rem 0.75rem;
  border-radius: 8px;
  font-size: 0.78rem;
  line-height: 1.5;
  border: 1px solid rgba(217, 119, 6, 0.12);
  background: rgba(245, 158, 11, 0.08);
  color: #b45309;
}

.validation-item.danger {
  border-color: rgba(220, 38, 38, 0.14);
  background: rgba(220, 38, 38, 0.06);
  color: var(--bg-danger);
}

.proxy-field span {
  font-size: 0.76rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.proxy-field input {
  width: 100%;
  height: 38px;
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
  padding: 1rem;
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
  padding: 0.9rem 1rem;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.summary-line {
  margin-top: 0.72rem;
}

.summary-line:first-child {
  margin-top: 0;
}

.summary-line strong {
  color: var(--text-primary);
  text-align: right;
}

.launch-note {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.85rem 0.95rem;
  border-radius: 8px;
  background: rgba(37, 99, 235, 0.06);
  color: var(--text-secondary);
}

.launch-note-mark {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 50%;
  background: rgba(37, 99, 235, 0.12);
  color: var(--text-accent);
  font-size: 0.72rem;
  font-weight: 700;
}

.launch-note p {
  font-size: 0.8rem;
  line-height: 1.55;
}

.launch-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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

@keyframes folder-picker-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1180px) {
  .workspace-layout {
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

  .header-summary {
    display: none;
  }
}
</style>
