<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from '../lib/i18n';
import {
  killAgent,
  listRunningAgentDetails,
  onAgentClosed,
  onAgentStarted,
  sendToAgent,
} from '../lib/wails';
import AppConfirmDialog from './AppConfirmDialog.vue';
import AppDialogShell from './AppDialogShell.vue';
import UEDButton from './common/UEDButton.vue';
import UEDCard from './common/UEDCard.vue';
import UEDEmptyState from './common/UEDEmptyState.vue';
import UEDInput from './common/UEDInput.vue';

const props = defineProps({
  modelValue: { type: Boolean, required: true },
});

const emit = defineEmits(['update:modelValue', 'notify']);

const { locale, t } = useI18n();

const processes = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');
const lastUpdatedAt = ref('');
const pendingActionById = ref({});
const expandedProcessId = ref('');
const inputDraftById = ref({});
const confirmKillTarget = ref(null);

let unlistenStarted = null;
let unlistenClosed = null;

const localeName = computed(() => (locale.value === 'zh-CN' ? 'zh-CN' : 'en-US'));
const lastUpdatedLabel = computed(() => {
  if (!lastUpdatedAt.value) {
    return '';
  }
  return t('process.lastUpdated', { time: formatDateTime(lastUpdatedAt.value) });
});

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      await openDialog();
      return;
    }
    cleanupDialogState();
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  cleanupEventListeners();
});

async function openDialog() {
  cleanupEventListeners();
  await registerEventListeners();
  await refreshProcesses();
}

function cleanupDialogState() {
  cleanupEventListeners();
  confirmKillTarget.value = null;
  expandedProcessId.value = '';
}

function cleanupEventListeners() {
  if (typeof unlistenStarted === 'function') {
    unlistenStarted();
  }
  if (typeof unlistenClosed === 'function') {
    unlistenClosed();
  }
  unlistenStarted = null;
  unlistenClosed = null;
}

async function registerEventListeners() {
  unlistenStarted = await onAgentStarted((processInfo) => {
    upsertProcess(processInfo);
    errorMessage.value = '';
    lastUpdatedAt.value = new Date().toISOString();
  });

  unlistenClosed = await onAgentClosed((payload) => {
    const processId = payload.id || payload.agentID;
    if (!processId) {
      return;
    }
    removeProcess(processId);
    clearPendingAction(processId);
    if (confirmKillTarget.value?.id === processId) {
      confirmKillTarget.value = null;
    }
    lastUpdatedAt.value = new Date().toISOString();
  });
}

async function refreshProcesses(showFailureToast = false) {
  isLoading.value = true;
  try {
    const items = await listRunningAgentDetails();
    processes.value = sortProcesses(items);
    errorMessage.value = '';
    lastUpdatedAt.value = new Date().toISOString();
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
    if (showFailureToast) {
      notify(errorMessage.value, 'danger');
    }
  } finally {
    isLoading.value = false;
  }
}

function notify(message, tone = 'success') {
  emit('notify', { message, tone });
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function sortProcesses(items) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.startedAt || '');
    const rightTime = Date.parse(right.startedAt || '');
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });
}

function upsertProcess(processInfo) {
  const next = [...processes.value];
  const index = next.findIndex((item) => item.id === processInfo.id);
  if (index >= 0) {
    next[index] = { ...next[index], ...processInfo };
  } else {
    next.push(processInfo);
  }
  processes.value = sortProcesses(next);
}

function removeProcess(processId) {
  processes.value = processes.value.filter((item) => item.id !== processId);
  if (expandedProcessId.value === processId) {
    expandedProcessId.value = '';
  }
}

function isExpanded(processId) {
  return expandedProcessId.value === processId;
}

function toggleExpanded(processId) {
  expandedProcessId.value = expandedProcessId.value === processId ? '' : processId;
}

function getPendingAction(processId) {
  return pendingActionById.value[processId] ?? '';
}

function setPendingAction(processId, action) {
  pendingActionById.value = {
    ...pendingActionById.value,
    [processId]: action,
  };
}

function clearPendingAction(processId) {
  const next = { ...pendingActionById.value };
  delete next[processId];
  pendingActionById.value = next;
}

function updateLocalStatus(processId, status) {
  processes.value = processes.value.map((item) =>
    item.id === processId ? { ...item, status } : item
  );
}

function getStatusLabel(status) {
  if (status === 'stopping') {
    return t('process.status.stopping');
  }
  return t('process.status.running');
}

function getStatusClass(status) {
  return status === 'stopping' ? 'is-stopping' : 'is-running';
}

function getCommandLine(processInfo) {
  if (processInfo.commandLine) {
    return processInfo.commandLine;
  }
  return [processInfo.command, ...(processInfo.args ?? [])].filter(Boolean).join(' ');
}

function getCommandSummary(processInfo) {
  const commandLine = getCommandLine(processInfo);
  if (!commandLine) {
    return t('process.none');
  }
  return commandLine;
}

function formatDateTime(value) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(localeName.value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function getEnvOverrideLabel(processInfo) {
  if (!Array.isArray(processInfo.envOverrideKeys) || processInfo.envOverrideKeys.length === 0) {
    return t('process.none');
  }
  return processInfo.envOverrideKeys.join(', ');
}

function getArgumentsLabel(processInfo) {
  if (!Array.isArray(processInfo.args) || processInfo.args.length === 0) {
    return t('process.none');
  }
  return processInfo.args.join(' ');
}

function updateInputDraft(processId, value) {
  inputDraftById.value = {
    ...inputDraftById.value,
    [processId]: value,
  };
}

function getInputDraft(processId) {
  return inputDraftById.value[processId] ?? '';
}

async function handleCopy(value, message) {
  try {
    if (!navigator?.clipboard?.writeText) {
      throw new Error('Clipboard API unavailable');
    }
    await navigator.clipboard.writeText(String(value));
    notify(message, 'success');
  } catch (error) {
    notify(getErrorMessage(error), 'danger');
  }
}

function requestKill(processInfo) {
  confirmKillTarget.value = processInfo;
}

function cancelKill() {
  confirmKillTarget.value = null;
}

async function confirmKill() {
  const target = confirmKillTarget.value;
  if (!target?.id) {
    return;
  }

  setPendingAction(target.id, 'kill');
  updateLocalStatus(target.id, 'stopping');
  confirmKillTarget.value = null;

  try {
    await killAgent(target.id);
    notify(t('process.killRequested', { name: target.name || target.id }), 'info');
  } catch (error) {
    clearPendingAction(target.id);
    updateLocalStatus(target.id, 'running');
    notify(getErrorMessage(error), 'danger');
  }
}

async function handleSendInput(processInfo) {
  const draft = getInputDraft(processInfo.id);
  if (!draft.trim()) {
    notify(t('process.inputRequired'), 'warning');
    return;
  }

  setPendingAction(processInfo.id, 'send');
  try {
    await sendToAgent(processInfo.id, draft);
    updateInputDraft(processInfo.id, '');
    notify(t('process.inputSent', { name: processInfo.name || processInfo.id }), 'success');
  } catch (error) {
    notify(getErrorMessage(error), 'danger');
  } finally {
    clearPendingAction(processInfo.id);
  }
}

function closeDialog() {
  emit('update:modelValue', false);
}
</script>

<template>
  <AppDialogShell
      :model-value="modelValue"
      :title="t('process.title')"
      :eyebrow="t('app.processManager')"
      max-width="1100px"
      body-class="process-dialog-body"
      @update:modelValue="(value) => emit('update:modelValue', value)"
      @close="closeDialog"
    >
      <div class="process-toolbar">
        <div class="process-toolbar__copy">
          <p v-if="lastUpdatedLabel" class="ued-meta">{{ lastUpdatedLabel }}</p>
          <p v-if="errorMessage" class="process-toolbar__error">{{ errorMessage }}</p>
        </div>
        <UEDButton variant="secondary" :disabled="isLoading" @click="refreshProcesses(true)">
          {{ isLoading ? t('process.refreshing') : t('process.refresh') }}
        </UEDButton>
      </div>

      <UEDEmptyState
        v-if="isLoading && processes.length === 0"
        class="process-empty"
        :title="t('process.loading')"
        :text="t('process.loadingHint')"
      />

      <UEDEmptyState
        v-else-if="processes.length === 0"
        class="process-empty"
        :title="t('process.empty')"
        :text="t('process.emptyHint')"
      />

      <div v-else class="process-list">
        <UEDCard
          v-for="process in processes"
          :key="process.id"
          class="process-card"
          :class="{ 'is-expanded': isExpanded(process.id) }"
          raised
        >
          <div class="process-summary">
            <div class="process-summary__main">
              <div class="process-summary__title-row">
                <div class="process-summary__title-copy">
                  <strong>{{ process.name || process.id }}</strong>
                  <span class="process-status-pill" :class="getStatusClass(process.status)">
                    {{ getStatusLabel(process.status) }}
                  </span>
                </div>
                <button
                  class="process-expand-button ued-icon-btn ued-icon-btn--ghost"
                  :title="isExpanded(process.id) ? t('process.hideDetails') : t('process.details')"
                  :aria-label="isExpanded(process.id) ? t('process.hideDetails') : t('process.details')"
                  @click="toggleExpanded(process.id)"
                >
                  {{ isExpanded(process.id) ? '▾' : '▸' }}
                </button>
              </div>

              <div class="process-meta-grid">
                <span><strong>{{ t('process.id') }}</strong> {{ process.id }}</span>
                <span><strong>{{ t('process.pid') }}</strong> {{ process.pid || '—' }}</span>
                <span><strong>{{ t('process.startedAt') }}</strong> {{ formatDateTime(process.startedAt) }}</span>
              </div>

              <div class="process-command-summary" :title="getCommandLine(process)">
                {{ getCommandSummary(process) }}
              </div>
            </div>

            <div class="process-summary__actions">
              <UEDButton
                variant="secondary"
                size="sm"
                :disabled="getPendingAction(process.id) === 'kill'"
                @click="handleCopy(process.id, t('process.copiedId'))"
              >
                {{ t('process.copyId') }}
              </UEDButton>
              <UEDButton
                variant="secondary"
                size="sm"
                :disabled="!process.pid || getPendingAction(process.id) === 'kill'"
                @click="handleCopy(process.pid, t('process.copiedPid'))"
              >
                {{ t('process.copyPid') }}
              </UEDButton>
              <UEDButton
                variant="secondary"
                size="sm"
                :disabled="getPendingAction(process.id) === 'kill'"
                @click="handleCopy(getCommandLine(process), t('process.copiedCommand'))"
              >
                {{ t('process.copyCommand') }}
              </UEDButton>
              <UEDButton
                variant="danger"
                size="sm"
                :disabled="process.status === 'stopping' || !!getPendingAction(process.id)"
                @click="requestKill(process)"
              >
                {{ t('process.kill') }}
              </UEDButton>
            </div>
          </div>

          <div v-if="isExpanded(process.id)" class="process-details">
            <div class="process-detail-grid">
              <div class="process-detail-item">
                <span class="process-detail-item__label">{{ t('process.command') }}</span>
                <code class="process-detail-item__value">{{ process.command || t('process.none') }}</code>
              </div>
              <div class="process-detail-item">
                <span class="process-detail-item__label">{{ t('process.arguments') }}</span>
                <code class="process-detail-item__value">{{ getArgumentsLabel(process) }}</code>
              </div>
              <div class="process-detail-item">
                <span class="process-detail-item__label">{{ t('app.workingDirectory') }}</span>
                <code class="process-detail-item__value">{{ process.workingDir || t('process.none') }}</code>
              </div>
              <div class="process-detail-item">
                <span class="process-detail-item__label">{{ t('process.envOverrideKeys') }}</span>
                <code class="process-detail-item__value">{{ getEnvOverrideLabel(process) }}</code>
              </div>
            </div>

            <div class="process-stdin-panel">
              <div class="process-stdin-panel__header">
                <strong>{{ t('process.sendInput') }}</strong>
                <span class="ued-meta">{{ t('process.stdinWarning') }}</span>
              </div>
              <UEDInput
                as="textarea"
                :rows="4"
                :model-value="getInputDraft(process.id)"
                :disabled="!!getPendingAction(process.id)"
                :placeholder="t('process.inputPlaceholder')"
                @update:modelValue="updateInputDraft(process.id, $event)"
              />
              <div class="process-stdin-panel__actions">
                <UEDButton
                  variant="primary"
                  size="sm"
                  :disabled="!!getPendingAction(process.id)"
                  @click="handleSendInput(process)"
                >
                  {{ t('process.sendInput') }}
                </UEDButton>
              </div>
            </div>
          </div>
        </UEDCard>
      </div>

      <template #footer>
        <UEDButton variant="secondary" @click="closeDialog">
          {{ t('app.close') }}
        </UEDButton>
      </template>
    </AppDialogShell>

    <AppConfirmDialog
      :model-value="!!confirmKillTarget"
      :title="t('process.confirmKill')"
      :message="confirmKillTarget ? t('process.confirmKillMessage', { name: confirmKillTarget.name || confirmKillTarget.id, pid: confirmKillTarget.pid || '—' }) : t('process.confirmKill')"
      :confirm-label="t('process.kill')"
      :cancel-label="t('common.cancel')"
      tone="danger"
      @update:modelValue="(value) => { if (!value) cancelKill(); }"
      @confirm="confirmKill"
      @cancel="cancelKill"
    />
</template>

<style scoped>
:deep(.process-dialog-body) {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: linear-gradient(180deg, var(--ued-bg-window) 0%, var(--ued-bg-canvas) 100%);
}

.process-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.process-toolbar__copy {
  min-width: 0;
  display: grid;
  gap: 0.3rem;
}

.process-toolbar__error {
  color: var(--ued-danger);
  font-size: 0.82rem;
  line-height: 1.5;
}

.process-empty {
  min-height: 240px;
}

.process-list {
  display: grid;
  gap: 0.9rem;
}

.process-card {
  overflow: hidden;
}

.process-summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.process-summary__main {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 0.7rem;
}

.process-summary__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.process-summary__title-copy {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.process-summary__title-copy strong {
  font-size: 0.95rem;
  color: var(--ued-text-primary);
}

.process-status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 0.62rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
}

.process-status-pill.is-running {
  background: color-mix(in srgb, var(--ued-accent) 12%, white);
  color: var(--ued-accent);
}

.process-status-pill.is-stopping {
  background: color-mix(in srgb, var(--ued-warning) 18%, white);
  color: color-mix(in srgb, var(--ued-warning) 82%, black);
}

.process-expand-button {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
}

.process-meta-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  color: var(--ued-text-secondary);
  font-size: 0.8rem;
}

.process-meta-grid strong {
  color: var(--ued-text-primary);
  font-weight: 600;
  margin-right: 0.2rem;
}

.process-command-summary {
  padding: 0.72rem 0.82rem;
  border: 1px solid var(--ued-border-subtle);
  border-radius: var(--ued-radius-md);
  background: var(--ued-bg-panel-muted);
  color: var(--ued-text-secondary);
  font-family: var(--ued-font-mono);
  font-size: 0.8rem;
  line-height: 1.55;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.process-summary__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.55rem;
  flex-shrink: 0;
}

.process-details {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--ued-border-subtle);
  display: grid;
  gap: 1rem;
}

.process-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.process-detail-item {
  min-width: 0;
  display: grid;
  gap: 0.32rem;
}

.process-detail-item__label {
  color: var(--ued-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.process-detail-item__value {
  display: block;
  padding: 0.72rem 0.8rem;
  border-radius: var(--ued-radius-md);
  background: var(--ued-bg-panel-muted);
  color: var(--ued-text-primary);
  font-family: var(--ued-font-mono);
  font-size: 0.78rem;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.process-stdin-panel {
  display: grid;
  gap: 0.7rem;
  padding: 0.92rem;
  border: 1px solid var(--ued-border-subtle);
  border-radius: var(--ued-radius-lg);
  background: color-mix(in srgb, var(--ued-bg-panel) 92%, white);
}

.process-stdin-panel__header {
  display: grid;
  gap: 0.22rem;
}

.process-stdin-panel__header strong {
  color: var(--ued-text-primary);
}

.process-stdin-panel__actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 900px) {
  .process-toolbar,
  .process-summary {
    flex-direction: column;
  }

  .process-summary__actions {
    justify-content: flex-start;
  }

  .process-detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
