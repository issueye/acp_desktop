<script setup>
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';
import { useConfigStore } from '../../stores/config';
import { addAgent, getDefaultSessionScanScript, removeAgent, scanAgentSessions, updateAgent } from '../../lib/wails';
import { useI18n } from '../../lib/i18n';
import AppDialogShell from '../../components/AppDialogShell.vue';
import AppConfirmDialog from '../../components/AppConfirmDialog.vue';
import EnvVarEditor from './EnvVarEditor.vue';
import UEDButton from '../../components/common/UEDButton.vue';
import UEDCard from '../../components/common/UEDCard.vue';
import UEDInput from '../../components/common/UEDInput.vue';
import UEDStatus from '../../components/common/UEDStatus.vue';

const props = defineProps({
  startInAddMode: { type: Boolean, default: false },
  embedded: { type: Boolean, default: false },
  title: { type: String, default: '' },
  eyebrow: { type: String, default: '' },
});

const emit = defineEmits(['close', 'notify']);

const configStore = useConfigStore();
const { t, locale } = useI18n();
const CodeEditor = defineAsyncComponent(() => import('../../components/common/CodeEditor.vue'));

const CREATE_ROW_KEY = '__new__';

const agents = computed(() =>
  Object.entries(configStore.config.agents).map(([name, config]) => ({
    name,
    command: config.command,
    args: config.args.join(' '),
    env: config.env || {},
    sessionScan: normalizeSessionScan(config.sessionScan),
  }))
);

const selectedAgentName = ref('');
const editingKey = ref('');
const draft = ref(createDraft());
const formError = ref('');
const actionError = ref('');
const isSubmitting = ref(false);
const showDeleteConfirm = ref(false);
const pendingDeleteAgentName = ref('');
const isDeleting = ref(false);
const scanResults = ref([]);
const scanError = ref('');
const isScanning = ref(false);

const isCreating = computed(() => editingKey.value === CREATE_ROW_KEY);
const isEditing = computed(() => !!editingKey.value && !isCreating.value);
const hasAgents = computed(() => agents.value.length > 0);
const selectedAgent = computed(() =>
  agents.value.find((agent) => agent.name === selectedAgentName.value) ?? agents.value[0] ?? null
);
const detailAgent = computed(() => {
  if (isCreating.value || isEditing.value) {
    return draft.value;
  }
  return selectedAgent.value;
});

function createDraft(agent) {
  return {
    name: agent?.name ?? '',
    command: agent?.command ?? '',
    args: agent?.args ?? '',
    env: { ...(agent?.env || {}) },
    sessionScan: normalizeSessionScan(agent?.sessionScan),
  };
}

function normalizeSessionScan(value) {
  return {
    enabled: !!value?.enabled,
    script: typeof value?.script === 'string' ? value.script : '',
  };
}

function parseArgs(argsString) {
  const args = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (const char of argsString) {
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuotes) {
      if (current.trim()) {
        args.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

function resetEditor() {
  editingKey.value = '';
  draft.value = createDraft();
  formError.value = '';
}

function startCreate() {
  actionError.value = '';
  formError.value = '';
  scanResults.value = [];
  scanError.value = '';
  editingKey.value = CREATE_ROW_KEY;
  draft.value = createDraft();
}

function startEdit(agent) {
  if (!agent) {
    return;
  }
  actionError.value = '';
  formError.value = '';
  scanResults.value = [];
  scanError.value = '';
  editingKey.value = agent.name;
  draft.value = createDraft(agent);
}

function selectAgent(name) {
  selectedAgentName.value = name;
  scanResults.value = [];
  scanError.value = '';
  resetEditor();
}

function updateDraftField(field, value) {
  draft.value = {
    ...draft.value,
    [field]: value,
  };
}

function updateDraftEnv(value) {
  draft.value = {
    ...draft.value,
    env: value,
  };
}

function updateDraftSessionScan(field, value) {
  draft.value = {
    ...draft.value,
    sessionScan: {
      ...normalizeSessionScan(draft.value.sessionScan),
      [field]: value,
    },
  };
}

function getEnvCount(env) {
  return Object.keys(env || {}).length;
}

function getEnvSummary(env) {
  const count = getEnvCount(env);
  if (count === 0) {
    return locale.value === 'zh-CN' ? '0 项' : '0 vars';
  }
  return locale.value === 'zh-CN' ? `${count} 项` : `${count} vars`;
}

async function saveDraft() {
  formError.value = '';
  actionError.value = '';

  if (!draft.value.name.trim()) {
    formError.value = t('settings.nameRequired');
    return;
  }

  if (!draft.value.command.trim()) {
    formError.value = t('settings.commandRequired');
    return;
  }

  if (/^\d+$/.test(draft.value.name)) {
    formError.value = t('settings.nameNumeric');
    return;
  }

  if (isCreating.value && configStore.config.agents[draft.value.name.trim()]) {
    formError.value = t('settings.duplicate');
    return;
  }

  isSubmitting.value = true;
  try {
    const args = parseArgs(draft.value.args);
    if (isCreating.value) {
      const newConfig = await addAgent(
        draft.value.name.trim(),
        draft.value.command.trim(),
        args,
        draft.value.env,
        normalizeSessionScan(draft.value.sessionScan)
      );
      configStore.updateFromEvent(newConfig);
      selectedAgentName.value = draft.value.name.trim();
      emit('notify', {
        message: `${t('settings.addAgent')}: ${draft.value.name.trim()}`,
        tone: 'success',
      });
    } else {
      const currentName = editingKey.value;
      const newConfig = await updateAgent(
        currentName,
        draft.value.command.trim(),
        args,
        draft.value.env,
        normalizeSessionScan(draft.value.sessionScan)
      );
      configStore.updateFromEvent(newConfig);
      selectedAgentName.value = currentName;
      emit('notify', {
        message: `${t('settings.edit')} Agent: ${currentName}`,
        tone: 'success',
      });
    }
    resetEditor();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e);
    emit('notify', {
      message: formError.value,
      tone: 'danger',
    });
  } finally {
    isSubmitting.value = false;
  }
}

async function applyDefaultSessionScanScript() {
  const script = await getDefaultSessionScanScript(draft.value.name || selectedAgentName.value);
  updateDraftSessionScan('script', script);
  if (script) {
    updateDraftSessionScan('enabled', true);
  }
}

async function handleScan(agent = detailAgent.value) {
  if (!agent?.name || isCreating.value) {
    return;
  }
  scanError.value = '';
  scanResults.value = [];
  isScanning.value = true;
  try {
    const results = await scanAgentSessions(agent.name);
    scanResults.value = Array.isArray(results) ? results : [];
  } catch (e) {
    scanError.value = e instanceof Error ? e.message : String(e);
  } finally {
    isScanning.value = false;
  }
}

function handleDelete(name) {
  actionError.value = '';
  pendingDeleteAgentName.value = name;
  showDeleteConfirm.value = true;
}

function cancelDelete() {
  pendingDeleteAgentName.value = '';
  showDeleteConfirm.value = false;
}

async function confirmDelete() {
  if (!pendingDeleteAgentName.value) {
    return;
  }

  isDeleting.value = true;
  try {
    const deletingName = pendingDeleteAgentName.value;
    const newConfig = await removeAgent(deletingName);
    configStore.updateFromEvent(newConfig);
    if (editingKey.value === deletingName) {
      resetEditor();
    }
    if (selectedAgentName.value === deletingName) {
      const remainingNames = Object.keys(newConfig.agents || {});
      selectedAgentName.value = remainingNames[0] || '';
    }
    cancelDelete();
    emit('notify', {
      message: `${t('settings.delete')}: ${deletingName}`,
      tone: 'success',
    });
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e);
    emit('notify', {
      message: actionError.value,
      tone: 'danger',
    });
  } finally {
    isDeleting.value = false;
  }
}

onMounted(() => {
  if (props.startInAddMode) {
    startCreate();
    return;
  }
  selectedAgentName.value = agents.value[0]?.name || '';
});

watch(
  agents,
  (list) => {
    if (isCreating.value) {
      return;
    }
    if (!selectedAgentName.value || !list.some((agent) => agent.name === selectedAgentName.value)) {
      selectedAgentName.value = list[0]?.name || '';
    }
  },
  { immediate: true }
);

watch(
  selectedAgent,
  (agent) => {
    if (agent && isEditing.value && editingKey.value === agent.name) {
      draft.value = createDraft(agent);
    }
  }
);

watch(
  () => props.startInAddMode,
  (enabled) => {
    if (enabled) {
      startCreate();
    }
  }
);
</script>

<template>
  <AppDialogShell
    :model-value="true"
    :title="title || t('settings.title')"
    :eyebrow="eyebrow || t('app.settings')"
    max-width="980px"
    body-class="settings-body"
    :embedded="embedded"
    @update:modelValue="(value) => { if (!value) emit('close'); }"
    @close="emit('close')"
  >
    <div class="settings-content agent-split">
      <aside class="agent-list-pane">
        <div class="agent-list-head">
          <div>
            <h3>{{ t('settings.agents') }}</h3>
            <p>{{ agents.length }} ACP</p>
          </div>
          <button
            class="agent-add-button ued-icon-btn ued-icon-btn--ghost"
            type="button"
            :disabled="isSubmitting || isDeleting || isCreating"
            :title="t('settings.addAgent')"
            :aria-label="t('settings.addAgent')"
            @click="startCreate"
          >
            +
          </button>
        </div>

        <div v-if="actionError" class="action-error ued-meta">
          {{ actionError }}
        </div>

        <div v-if="!hasAgents && !isCreating" class="agent-empty">
          <strong>{{ t('settings.noAgents') }}</strong>
          <UEDButton variant="primary" size="sm" @click="startCreate">
            {{ t('settings.addAgent') }}
          </UEDButton>
        </div>

        <div v-else class="agent-list">
          <button
            v-if="isCreating"
            class="agent-list-item active new-agent"
            type="button"
          >
            <span class="agent-avatar">+</span>
            <span class="agent-list-copy">
              <strong>{{ t('settings.addNewAgent') }}</strong>
              <small>{{ t('settings.command') }}</small>
            </span>
          </button>

          <button
            v-for="agent in agents"
            :key="agent.name"
            class="agent-list-item"
            :class="{ active: !isCreating && selectedAgentName === agent.name }"
            type="button"
            @click="selectAgent(agent.name)"
          >
            <span class="agent-avatar">{{ agent.name.slice(0, 1).toUpperCase() }}</span>
            <span class="agent-list-copy">
              <strong>{{ agent.name }}</strong>
              <small>{{ agent.command }} {{ agent.args }}</small>
            </span>
            <UEDStatus kind="badge">ACP</UEDStatus>
          </button>
        </div>
      </aside>

      <section class="agent-detail-pane">
        <UEDCard v-if="detailAgent" class="agent-detail-card" :padded="false">
          <div class="detail-header">
            <div class="detail-title">
              <span class="agent-avatar large">
                {{ isCreating ? '+' : detailAgent.name.slice(0, 1).toUpperCase() }}
              </span>
              <div>
                <h3>
                  {{ isCreating ? t('settings.addNewAgent') : detailAgent.name }}
                </h3>
                <p>{{ isCreating ? t('settings.addAgent') : 'ACP' }}</p>
              </div>
            </div>
            <div v-if="!isCreating && !isEditing" class="detail-actions">
              <UEDButton
                variant="secondary"
                size="sm"
                :disabled="isSubmitting || isDeleting"
                @click="startEdit(detailAgent)"
              >
                {{ t('settings.edit') }}
              </UEDButton>
              <UEDButton
                variant="danger"
                size="sm"
                :disabled="isSubmitting || isDeleting"
                @click="handleDelete(detailAgent.name)"
              >
                {{ t('settings.delete') }}
              </UEDButton>
            </div>
          </div>

          <div v-if="isCreating || isEditing" class="agent-form">
            <label class="form-field">
              <span>{{ t('settings.name') }}</span>
              <UEDInput
                :model-value="draft.name"
                :disabled="isEditing"
                :placeholder="t('settings.placeholder.agentName')"
                :error="!!formError && !draft.name.trim()"
                @update:modelValue="updateDraftField('name', $event)"
              />
            </label>

            <label class="form-field">
              <span>{{ t('settings.command') }}</span>
              <UEDInput
                :model-value="draft.command"
                placeholder="npx"
                :error="!!formError && !draft.command.trim()"
                @update:modelValue="updateDraftField('command', $event)"
              />
            </label>

            <label class="form-field">
              <span>{{ t('settings.arguments') }}</span>
              <UEDInput
                :model-value="draft.args"
                placeholder="-y @example/agent"
                @update:modelValue="updateDraftField('args', $event)"
              />
            </label>

            <EnvVarEditor
              :model-value="draft.env"
              @update:modelValue="updateDraftEnv"
            />

            <section class="scan-editor">
              <div class="scan-editor-head">
                <label class="scan-toggle">
                  <input
                    type="checkbox"
                    :checked="draft.sessionScan.enabled"
                    @change="updateDraftSessionScan('enabled', $event.target.checked)"
                  />
                  <span>{{ t('scan.enabled') }}</span>
                </label>
                <UEDButton type="button" variant="secondary" size="sm" @click="applyDefaultSessionScanScript">
                  {{ t('scan.useClaudeDefault') }}
                </UEDButton>
              </div>
              <label class="form-field">
                <span>{{ t('scan.script') }}</span>
                <CodeEditor
                  :model-value="draft.sessionScan.script"
                  language="javascript"
                  min-height="280px"
                  @update:modelValue="updateDraftSessionScan('script', $event)"
                />
              </label>
            </section>

            <div v-if="formError" class="ued-error-text form-error">
              {{ formError }}
            </div>

            <div class="form-actions">
              <UEDButton
                variant="secondary"
                :disabled="isSubmitting || isDeleting"
                @click="resetEditor"
              >
                {{ t('common.cancel') }}
              </UEDButton>
              <UEDButton
                variant="primary"
                :disabled="isSubmitting || isDeleting"
                @click="saveDraft"
              >
                {{ isSubmitting ? t('settings.saving') : t('settings.save') }}
              </UEDButton>
            </div>
          </div>

          <div v-else class="agent-detail-body">
            <div class="detail-grid">
              <div class="detail-field">
                <span>{{ t('settings.command') }}</span>
                <code class="ued-code">{{ detailAgent.command }}</code>
              </div>
              <div class="detail-field">
                <span>{{ t('settings.arguments') }}</span>
                <code class="ued-code">{{ detailAgent.args || '-' }}</code>
              </div>
              <div class="detail-field">
                <span>{{ t('env.title') }}</span>
                <strong>{{ getEnvSummary(detailAgent.env) }}</strong>
              </div>
            </div>

            <div class="env-readonly">
              <div class="env-readonly-head">
                <span>{{ t('env.title') }}</span>
              </div>
              <div v-if="getEnvCount(detailAgent.env) > 0" class="env-readonly-list">
                <div v-for="(value, key) in detailAgent.env" :key="key" class="env-readonly-row">
                  <code>{{ key }}</code>
                  <span>{{ value }}</span>
                </div>
              </div>
              <div v-else class="env-empty ued-meta">
                {{ t('env.empty') }}
              </div>
            </div>

            <section class="scan-readonly">
              <div class="env-readonly-head scan-readonly-head">
                <span>{{ t('scan.title') }}</span>
                <UEDButton
                  variant="secondary"
                  size="sm"
                  :disabled="isScanning || !detailAgent.sessionScan?.enabled"
                  @click="handleScan(detailAgent)"
                >
                  {{ isScanning ? t('scan.scanning') : t('scan.test') }}
                </UEDButton>
              </div>
              <div class="scan-status">
                <strong>{{ detailAgent.sessionScan?.enabled ? t('scan.enabled') : t('scan.disabled') }}</strong>
                <span>{{ detailAgent.sessionScan?.script ? t('scan.scriptConfigured') : t('scan.scriptMissing') }}</span>
              </div>
              <div v-if="scanError" class="scan-error">{{ scanError }}</div>
              <div v-if="scanResults.length > 0" class="scan-result-list">
                <div v-for="item in scanResults" :key="item.id || item.path" class="scan-result-row">
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.path }}</span>
                </div>
              </div>
            </section>
          </div>
        </UEDCard>

        <div v-else class="agent-detail-empty">
          <strong>{{ t('settings.noAgents') }}</strong>
          <p class="ued-meta">{{ t('settings.argsHint') }}</p>
          <UEDButton variant="primary" @click="startCreate">
            {{ t('settings.addAgent') }}
          </UEDButton>
        </div>
      </section>
    </div>

    <AppConfirmDialog
      :model-value="showDeleteConfirm"
      :title="t('settings.delete')"
      :message="t('settings.confirmDeleteAgent', { name: pendingDeleteAgentName })"
      :confirm-label="t('settings.delete')"
      :cancel-label="t('common.cancel')"
      tone="danger"
      @update:modelValue="(value) => { if (!value) cancelDelete(); }"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </AppDialogShell>
</template>

<style scoped>
.settings-body {
  padding: 0;
  background: linear-gradient(180deg, var(--ued-bg-window) 0%, var(--ued-bg-canvas) 100%);
}

.agent-split {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: 0;
}

.agent-list-pane {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--ued-border-subtle);
  background: color-mix(in srgb, var(--ued-bg-panel-muted) 44%, var(--ued-bg-panel));
}

.agent-list-head {
  flex-shrink: 0;
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 0.85rem 0.7rem;
  border-bottom: 1px solid var(--ued-border-subtle);
}

.agent-list-head h3,
.detail-title h3 {
  margin: 0;
  color: var(--ued-text-primary);
  font-size: 0.98rem;
  line-height: 1.25;
}

.agent-list-head p,
.detail-title p {
  margin: 0.15rem 0 0;
  color: var(--ued-text-muted);
  font-size: 0.74rem;
}

.agent-add-button {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
}

.agent-list {
  min-height: 0;
  overflow: auto;
  padding: 0.45rem;
}

.agent-list-item {
  width: 100%;
  min-height: 52px;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.5rem 0.55rem;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--ued-text-secondary);
  cursor: pointer;
  text-align: left;
}

.agent-list-item:hover,
.agent-list-item.active {
  background: rgba(255, 255, 255, 0.72);
  border-color: var(--ued-border-subtle);
  color: var(--ued-text-primary);
}

.agent-list-item.new-agent {
  border-style: dashed;
}

.agent-avatar {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 7px;
  background: var(--ued-accent-soft);
  color: var(--ued-accent);
  font-weight: 700;
  font-size: 0.82rem;
}

.agent-avatar.large {
  width: 42px;
  height: 42px;
  font-size: 1rem;
}

.agent-list-copy {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0.12rem;
}

.agent-list-copy strong,
.agent-list-copy small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-list-copy strong {
  color: var(--ued-text-primary);
  font-size: 0.86rem;
}

.agent-list-copy small {
  color: var(--ued-text-muted);
  font-size: 0.72rem;
}

.agent-empty,
.agent-detail-empty {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 0.65rem;
  min-height: 220px;
  padding: 1rem;
  color: var(--ued-text-muted);
  text-align: center;
}

.agent-empty strong,
.agent-detail-empty strong {
  color: var(--ued-text-primary);
}

.agent-detail-pane {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 1rem;
  background: var(--ued-bg-window);
}

.agent-detail-card {
  min-height: 100%;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--ued-border-subtle);
}

.detail-title {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-width: 0;
}

.detail-title > div {
  min-width: 0;
}

.detail-actions,
.form-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.scan-editor,
.scan-readonly {
  display: grid;
  gap: 0.75rem;
  padding: 0.85rem;
  border: 1px solid var(--ued-border-subtle);
  border-radius: var(--ued-radius-md);
  background: var(--ued-bg-panel-muted);
}

.scan-editor-head,
.scan-readonly-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.scan-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--ued-text-primary);
  font-size: 0.84rem;
  cursor: pointer;
}

.scan-toggle input {
  width: 16px;
  height: 16px;
}

.scan-readonly {
  padding: 0;
  overflow: hidden;
}

.scan-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem;
  color: var(--ued-text-secondary);
}

.scan-status strong {
  color: var(--ued-text-primary);
}

.scan-error {
  margin: 0 0.85rem 0.85rem;
  padding: 0.65rem 0.75rem;
  border-radius: var(--ued-radius-md);
  background: var(--ued-danger-soft);
  color: var(--ued-danger);
  font-size: 0.82rem;
}

.scan-result-list {
  display: grid;
  border-top: 1px solid var(--ued-border-subtle);
}

.scan-result-row {
  display: grid;
  gap: 0.2rem;
  padding: 0.72rem 0.85rem;
  border-top: 1px solid var(--ued-border-subtle);
}

.scan-result-row:first-child {
  border-top: none;
}

.scan-result-row strong,
.scan-result-row span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scan-result-row span {
  color: var(--ued-text-muted);
  font-size: 0.76rem;
}

.action-error {
  margin: 0.6rem 0.65rem 0;
  padding: 0.65rem 0.7rem;
  border-radius: var(--ued-radius-md);
  border: 1px solid color-mix(in srgb, var(--ued-danger) 18%, var(--ued-border-default));
  background: var(--ued-danger-soft);
  color: var(--ued-danger);
  font-size: 0.84rem;
  line-height: 1.5;
}

.agent-form,
.agent-detail-body {
  padding: 1rem;
  display: grid;
  gap: 0.9rem;
}

.form-field {
  display: grid;
  gap: 0.35rem;
}

.form-field > span,
.detail-field > span,
.env-readonly-head span {
  color: var(--ued-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}

.form-error {
  padding: 0.65rem 0.75rem;
  border-radius: var(--ued-radius-md);
  background: var(--ued-danger-soft);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.detail-field {
  min-width: 0;
  display: grid;
  gap: 0.38rem;
  padding: 0.85rem;
  border-radius: var(--ued-radius-md);
  border: 1px solid var(--ued-border-subtle);
  background: var(--ued-bg-panel-muted);
}

.detail-field code,
.detail-field strong {
  min-width: 0;
  color: var(--ued-text-primary);
  overflow-wrap: anywhere;
}

.env-readonly {
  border: 1px solid var(--ued-border-subtle);
  border-radius: var(--ued-radius-md);
  overflow: hidden;
}

.env-readonly-head {
  padding: 0.72rem 0.85rem;
  background: var(--ued-bg-panel-muted);
  border-bottom: 1px solid var(--ued-border-subtle);
}

.env-readonly-list {
  display: grid;
}

.env-readonly-row {
  display: grid;
  grid-template-columns: minmax(160px, 0.35fr) minmax(0, 1fr);
  gap: 0.75rem;
  padding: 0.7rem 0.85rem;
  border-top: 1px solid var(--ued-border-subtle);
}

.env-readonly-row:first-child {
  border-top: none;
}

.env-readonly-row code,
.env-readonly-row span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.env-empty {
  padding: 0.85rem;
}

@media (max-width: 900px) {
  .agent-split {
    grid-template-columns: 1fr;
  }

  .agent-list-pane {
    max-height: 260px;
    border-right: none;
    border-bottom: 1px solid var(--ued-border-subtle);
  }

  .detail-grid,
  .env-readonly-row {
    grid-template-columns: 1fr;
  }
}
</style>
