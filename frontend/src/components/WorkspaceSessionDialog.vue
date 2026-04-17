<script setup>
import { computed } from 'vue';
import { useI18n } from '../lib/i18n';
import AppDialogShell from './AppDialogShell.vue';
import AgentSelector from './AgentSelector.vue';
import StartupProgress from './StartupProgress.vue';
import UEDButton from './common/UEDButton.vue';
import UEDCard from './common/UEDCard.vue';
import UEDEmptyState from './common/UEDEmptyState.vue';
import UEDField from './common/UEDField.vue';
import UEDInput from './common/UEDInput.vue';
import UEDStatus from './common/UEDStatus.vue';

const props = defineProps({
    modelValue: { type: Boolean, required: true },
    hasAgents: { type: Boolean, required: true },
    isConnecting: { type: Boolean, required: true },
    isLoading: { type: Boolean, required: true },
    isSelectingFolder: { type: Boolean, required: true },
    selectedAgent: { type: String, required: true },
    selectedCwd: { type: String, required: true },
    selectedCwdLabel: { type: String, required: true },
    proxyEnabled: { type: Boolean, required: true },
    httpProxy: { type: String, required: true },
    httpsProxy: { type: String, required: true },
    allProxy: { type: String, required: true },
    noProxy: { type: String, required: true },
    startupPhase: { type: String, required: true },
    startupLogs: { type: Array, required: true },
    startupElapsed: { type: Number, required: true },
    showStartupDetails: { type: Boolean, required: true },
});

const emit = defineEmits(['update:modelValue', 'update:selectedAgent', 'update:proxyEnabled', 'update:httpProxy', 'update:httpsProxy', 'update:allProxy', 'update:noProxy', 'update:showStartupDetails', 'selectFolder', 'createSession', 'openAddAgent', 'cancelConnection']);

const { t } = useI18n();

const selectedAgentModel = computed({
  get: () => props.selectedAgent,
  set: (value) => emit('update:selectedAgent', value),
});

function isValidProxyUrl(value) {
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

const validationItems = computed(() => {
  const items = [];

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
    <template #header-extra></template>

    <UEDEmptyState
      v-if="!hasAgents"
      class="empty-workspace"
      :title="t('app.noAgentTitle')"
      :text="t('app.noAgentDesc')"
    >
      <UEDButton variant="primary" @click="emit('openAddAgent')">{{ t('settings.addAgent') }}</UEDButton>
    </UEDEmptyState>

    <template v-else>
      <div class="workspace-layout">
        <div class="dialog-main">
          <UEDCard class="workspace-hero" raised>
            <div class="hero-copy">
              <h3 class="ued-title-2">{{ t('app.sessionSetupTitle') }}</h3>
              <p class="hero-text ued-body">{{ t('app.sessionSetupDesc') }}</p>
            </div>
            <div class="hero-metrics">
              <UEDCard class="hero-metric">
                <span>{{ t('agent.label') }}</span>
                <strong>{{ selectedAgent || t('agent.select') }}</strong>
              </UEDCard>
              <UEDCard class="hero-metric">
                <span>{{ t('app.workspace') }}</span>
                <strong :title="selectedCwd || '.'">{{ selectedCwdLabel }}</strong>
              </UEDCard>
              <UEDCard class="hero-metric">
                <span>{{ t('app.proxy') }}</span>
                <div class="hero-metric__status">
                  <strong>{{ proxyEnabled ? t('app.proxyEnable') : t('app.proxyDisabled') }}</strong>
                  <UEDStatus kind="badge" :tone="proxyEnabled ? 'info' : 'neutral'">
                    {{ proxyEnabled ? 'ON' : 'OFF' }}
                  </UEDStatus>
                </div>
              </UEDCard>
            </div>
          </UEDCard>

          <UEDCard tag="section" class="dialog-section">
            <AgentSelector v-model:selected="selectedAgentModel" />
          </UEDCard>

          <UEDCard tag="section" class="dialog-section">
            <div class="section-headline">
              <h3 class="ued-title-2">{{ t('app.workingDirectory') }}</h3>
              <button
                class="icon-ghost-button ued-icon-btn ued-icon-btn--ghost"
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
            <UEDCard muted class="cwd-card" :title="selectedCwd || t('app.currentDirectory')">
              <div class="cwd-badge">#</div>
              <div class="cwd-copy">
                <strong>{{ selectedCwdLabel }}</strong>
                <span>{{ selectedCwd || '.' }}</span>
              </div>
            </UEDCard>
            <p class="section-hint ued-meta">
              {{ t('app.validationWorkspaceHint') }}
            </p>
          </UEDCard>

          <UEDCard tag="section" class="dialog-section">
            <div class="section-headline">
              <h3 class="ued-title-2">{{ t('app.proxy') }}</h3>
              <label class="proxy-switch" :class="{ enabled: proxyEnabled }">
                <input
                  :checked="proxyEnabled"
                  type="checkbox"
                  :disabled="isConnecting"
                  @change="emit('update:proxyEnabled', $event.target.checked)"
                />
                <span class="switch-track"><span class="switch-thumb"></span></span>
                <span>{{ proxyEnabled ? t('app.proxyEnable') : t('app.proxyDisabled') }}</span>
              </label>
            </div>
            <div class="proxy-grid" :class="{ disabled: !proxyEnabled }">
              <UEDField class="proxy-field" :label="t('app.proxyHttp')">
                <UEDInput
                  :model-value="httpProxy"
                  :placeholder="t('app.proxySampleHost')"
                  :disabled="!proxyEnabled || isConnecting"
                  :error="validationItems.some((item) => item.id === 'proxy-http-invalid')"
                  @update:modelValue="emit('update:httpProxy', $event)"
                />
              </UEDField>
              <UEDField class="proxy-field" :label="t('app.proxyHttps')">
                <UEDInput
                  :model-value="httpsProxy"
                  :placeholder="t('app.proxySampleHost')"
                  :disabled="!proxyEnabled || isConnecting"
                  :error="validationItems.some((item) => item.id === 'proxy-https-invalid')"
                  @update:modelValue="emit('update:httpsProxy', $event)"
                />
              </UEDField>
              <UEDField class="proxy-field" :label="t('app.proxyAll')">
                <UEDInput
                  :model-value="allProxy"
                  :placeholder="t('app.proxySampleHost')"
                  :disabled="!proxyEnabled || isConnecting"
                  :error="validationItems.some((item) => item.id === 'proxy-all-invalid')"
                  @update:modelValue="emit('update:allProxy', $event)"
                />
              </UEDField>
              <UEDField class="proxy-field" :label="t('app.proxyNo')">
                <UEDInput
                  :model-value="noProxy"
                  :placeholder="t('app.proxySampleNo')"
                  :disabled="!proxyEnabled || isConnecting"
                  @update:modelValue="emit('update:noProxy', $event)"
                />
              </UEDField>
            </div>
          </UEDCard>
        </div>

        <aside class="dialog-side">
          <UEDCard class="launch-card" raised>
            <div class="launch-copy">
              <h3 class="ued-title-2">{{ t('app.newSession') }}</h3>
              <p class="launch-text ued-body">{{ t('app.sessionSetupDesc') }}</p>
            </div>
            <UEDCard muted class="summary-card">
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
            </UEDCard>
          </UEDCard>

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

    <template v-if="!isConnecting" #footer>
      <div class="dialog-footer-actions">
        <UEDButton variant="secondary" size="lg" @click="closeDialog">
          {{ t('common.cancel') }}
        </UEDButton>
        <UEDButton
          v-if="hasAgents"
          variant="primary"
          size="lg"
          :disabled="!canCreateSession"
          @click="emit('createSession')"
        >
          {{
            props.isSelectingFolder
              ? t('app.selectingFolder')
              : isLoading
                ? t('app.connecting')
                : t('app.newSession')
          }}
        </UEDButton>
        <UEDButton v-else variant="primary" size="lg" @click="emit('openAddAgent')">
          {{ t('settings.addAgent') }}
        </UEDButton>
      </div>
    </template>
  </AppDialogShell>
</template>

<style scoped>
.workspace-dialog {
  padding: 0;
  background: linear-gradient(180deg, var(--ued-bg-window) 0%, var(--ued-bg-canvas) 100%);
}

.workspace-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.88fr);
  gap: 1rem;
  align-items: start;
}

.dialog-main,
.dialog-side {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dialog-section {
  min-width: 0;
}

.section-headline,
.summary-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.7rem;
}

.workspace-hero {
  background:
    radial-gradient(circle at top right, rgba(10, 100, 216, 0.12), transparent 32%),
    linear-gradient(145deg, var(--ued-bg-panel) 0%, var(--ued-bg-panel-muted) 100%);
}

.hero-copy {
  display: grid;
  gap: 0.4rem;
}

.hero-text {
  margin: 0;
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.7rem;
}

.hero-metric {
  min-width: 0;
}

.hero-metric span {
  display: block;
  font-size: 0.72rem;
  color: var(--ued-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.hero-metric strong {
  display: block;
  margin-top: 0.32rem;
  font-size: 0.95rem;
  color: var(--ued-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hero-metric__status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.icon-ghost-button {
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background-color 0.15s ease,
    transform 0.15s ease;
}

.icon-ghost-button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.folder-picker-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.folder-picker-icon.spinning {
  animation: folder-picker-spin 0.9s linear infinite;
}

.cwd-card {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.cwd-badge {
  width: 34px;
  height: 34px;
  border-radius: var(--ued-radius-md);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: var(--ued-accent);
  background: color-mix(in srgb, var(--ued-accent) 10%, transparent);
  font-weight: 700;
}

.cwd-copy {
  min-width: 0;
}

.cwd-copy strong,
.cwd-copy span {
  display: block;
}

.cwd-copy strong {
  font-size: 1rem;
  color: var(--ued-text-primary);
}

.cwd-copy span {
  margin-top: 0.18rem;
  color: var(--ued-text-secondary);
  word-break: break-all;
}

.section-hint {
  margin-top: 0.7rem;
}

.proxy-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  cursor: pointer;
  color: var(--ued-text-secondary);
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
  background: color-mix(in srgb, var(--ued-text-muted) 42%, transparent);
  border: 1px solid var(--ued-border-default);
  transition: background 0.18s ease, border-color 0.18s ease;
}

.switch-thumb {
  width: 16px;
  height: 16px;
  display: block;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: var(--ued-shadow-rest);
  transition: transform 0.18s ease;
}

.proxy-switch.enabled .switch-track {
  background: var(--ued-accent);
  border-color: color-mix(in srgb, var(--ued-accent) 24%, var(--ued-border-default));
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

.proxy-field {
  min-width: 0;
}

.validation-panel strong {
  display: block;
  margin-bottom: 0.7rem;
  font-size: 0.84rem;
  color: var(--ued-text-primary);
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
  border-radius: var(--ued-radius-md);
  font-size: 0.78rem;
  line-height: 1.5;
  border: 1px solid color-mix(in srgb, var(--ued-warning) 18%, var(--ued-border-default));
  background: var(--ued-warning-soft);
  color: var(--ued-warning);
}

.validation-item.danger {
  border-color: color-mix(in srgb, var(--ued-danger) 18%, var(--ued-border-default));
  background: var(--ued-danger-soft);
  color: var(--ued-danger);
}

.launch-card {
  position: sticky;
  top: 0;
}

.launch-copy {
  display: grid;
  gap: 0.4rem;
}

.launch-text {
  margin: 0;
}

.summary-card {
  margin-top: 0.7rem;
  margin-bottom: 0.7rem;
}

.summary-line {
  color: var(--ued-text-secondary);
}

.summary-line + .summary-line {
  margin-top: 0.72rem;
}

.summary-line strong {
  color: var(--ued-text-primary);
  text-align: right;
}

.launch-note {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.85rem 0.95rem;
  border-radius: var(--ued-radius-md);
  background: var(--ued-info-soft);
  color: var(--ued-text-secondary);
}

.launch-note-mark {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 50%;
  background: color-mix(in srgb, var(--ued-accent) 12%, transparent);
  color: var(--ued-accent);
  font-size: 0.72rem;
  font-weight: 700;
}

.launch-note p {
  font-size: 0.8rem;
  line-height: 1.55;
}

.dialog-footer-actions {
  display: flex;
  gap: 0.75rem;
  width: 100%;
  justify-content: flex-end;
}

.empty-workspace {
  min-height: 240px;
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

  .dialog-footer-actions {
    flex-wrap: wrap;
  }
}
</style>
