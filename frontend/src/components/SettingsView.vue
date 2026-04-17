<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useConfigStore } from '../stores/config';
import { addAgent, removeAgent, updateAgent } from '../lib/wails';
import { useI18n } from '../lib/i18n';
import AppDialogShell from './AppDialogShell.vue';
import AppConfirmDialog from './AppConfirmDialog.vue';
import EnvVarEditor from './EnvVarEditor.vue';
import UEDButton from './common/UEDButton.vue';
import UEDCard from './common/UEDCard.vue';
import UEDInput from './common/UEDInput.vue';
import UEDStatus from './common/UEDStatus.vue';

const props = defineProps({
  startInAddMode: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'notify']);

const configStore = useConfigStore();
const { t, locale } = useI18n();

const CREATE_ROW_KEY = '__new__';

const agents = computed(() =>
  Object.entries(configStore.config.agents).map(([name, config]) => ({
    name,
    command: config.command,
    args: config.args.join(' '),
    env: config.env || {},
  }))
);

const editingKey = ref('');
const expandedEnvKey = ref('');
const draft = ref(createDraft());
const formError = ref('');
const actionError = ref('');
const isSubmitting = ref(false);
const showDeleteConfirm = ref(false);
const pendingDeleteAgentName = ref('');
const isDeleting = ref(false);

const isCreating = computed(() => editingKey.value === CREATE_ROW_KEY);
const hasAgents = computed(() => agents.value.length > 0);

function createDraft(agent) {
  return {
    name: agent?.name ?? '',
    command: agent?.command ?? '',
    args: agent?.args ?? '',
    env: { ...(agent?.env || {}) },
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
  expandedEnvKey.value = '';
  draft.value = createDraft();
  formError.value = '';
}

function startCreate() {
  actionError.value = '';
  formError.value = '';
  editingKey.value = CREATE_ROW_KEY;
  expandedEnvKey.value = CREATE_ROW_KEY;
  draft.value = createDraft();
}

function startEdit(agent) {
  actionError.value = '';
  formError.value = '';
  editingKey.value = agent.name;
  expandedEnvKey.value = agent.name;
  draft.value = createDraft(agent);
}

function startEnvEdit(agent) {
  if (isEditingRow(agent.name)) {
    toggleEnvEditor(agent.name);
    return;
  }
  startEdit(agent);
}

function isEditingRow(name) {
  return editingKey.value === name;
}

function isEnvExpanded(name) {
  return expandedEnvKey.value === name;
}

function toggleEnvEditor(name) {
  expandedEnvKey.value = expandedEnvKey.value === name ? '' : name;
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
        draft.value.env
      );
      configStore.updateFromEvent(newConfig);
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
        draft.value.env
      );
      configStore.updateFromEvent(newConfig);
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
  }
});

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
    :title="t('settings.title')"
    :eyebrow="t('app.settings')"
    max-width="980px"
    body-class="settings-body"
    @update:modelValue="(value) => { if (!value) emit('close'); }"
    @close="emit('close')"
  >
    <div class="settings-content">
      <UEDCard tag="section" class="agents-section" :padded="false">
        <div class="section-header">
          <div class="section-copy">
            <h3 class="ued-title-2">{{ t('settings.agents') }}</h3>
            <p class="ued-meta">{{ t('settings.argsHint') }}</p>
          </div>
          <UEDButton
            variant="primary"
            @click="startCreate"
            :disabled="isSubmitting || isDeleting || isCreating"
          >
            {{ t('settings.addAgent') }}
          </UEDButton>
        </div>

        <div v-if="actionError" class="action-error ued-meta">
          {{ actionError }}
        </div>

        <div class="agent-table-shell">
          <div class="agent-table-scroll">
            <table class="agent-table">
              <thead>
                <tr>
                  <th>{{ t('settings.name') }}</th>
                  <th>{{ t('settings.command') }}</th>
                  <th>{{ t('settings.arguments') }}</th>
                  <th>{{ t('env.title') }}</th>
                  <th class="actions-column">Actions</th>
                </tr>
              </thead>
              <tbody>
                <template v-if="isCreating">
                  <tr class="agent-row is-editing is-new">
                    <td>
                      <UEDInput
                        :model-value="draft.name"
                        :placeholder="t('settings.placeholder.agentName')"
                        :error="!!formError && !draft.name.trim()"
                        @update:modelValue="updateDraftField('name', $event)"
                      />
                    </td>
                    <td>
                      <UEDInput
                        :model-value="draft.command"
                        placeholder="npx"
                        :error="!!formError && !draft.command.trim()"
                        @update:modelValue="updateDraftField('command', $event)"
                      />
                    </td>
                    <td>
                      <UEDInput
                        :model-value="draft.args"
                        placeholder="-y @example/agent"
                        @update:modelValue="updateDraftField('args', $event)"
                      />
                    </td>
                    <td>
                      <button
                        class="env-toggle ued-btn ued-btn--secondary ued-btn--sm"
                        type="button"
                        @click="toggleEnvEditor(CREATE_ROW_KEY)"
                      >
                        {{ getEnvSummary(draft.env) }}
                      </button>
                    </td>
                    <td class="actions-column">
                      <div class="row-actions">
                        <UEDButton
                          variant="primary"
                          size="sm"
                          :disabled="isSubmitting || isDeleting"
                          @click="saveDraft"
                        >
                          {{ isSubmitting ? t('settings.saving') : t('settings.save') }}
                        </UEDButton>
                        <UEDButton
                          variant="secondary"
                          size="sm"
                          :disabled="isSubmitting || isDeleting"
                          @click="resetEditor"
                        >
                          {{ t('common.cancel') }}
                        </UEDButton>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="isEnvExpanded(CREATE_ROW_KEY)" class="env-detail-row">
                    <td colspan="5">
                      <EnvVarEditor :model-value="draft.env" @update:modelValue="updateDraftEnv" />
                    </td>
                  </tr>
                  <tr v-if="formError" class="error-row">
                    <td colspan="5" class="ued-error-text">{{ formError }}</td>
                  </tr>
                </template>

                <template v-if="hasAgents">
                  <template v-for="agent in agents" :key="agent.name">
                    <tr class="agent-row" :class="{ 'is-editing': isEditingRow(agent.name) }">
                      <td>
                        <template v-if="isEditingRow(agent.name)">
                          <div class="name-cell">
                            <UEDInput :model-value="draft.name" disabled />
                            <UEDStatus kind="badge" tone="info">ACP</UEDStatus>
                          </div>
                        </template>
                        <template v-else>
                          <div class="name-display">
                            <strong>{{ agent.name }}</strong>
                            <UEDStatus kind="badge">ACP</UEDStatus>
                          </div>
                        </template>
                      </td>

                      <td>
                        <template v-if="isEditingRow(agent.name)">
                          <UEDInput
                            :model-value="draft.command"
                            placeholder="npx"
                            :error="!!formError && !draft.command.trim()"
                            @update:modelValue="updateDraftField('command', $event)"
                          />
                        </template>
                        <template v-else>
                          <code class="ued-code agent-code">{{ agent.command }}</code>
                        </template>
                      </td>

                      <td>
                        <template v-if="isEditingRow(agent.name)">
                          <UEDInput
                            :model-value="draft.args"
                            placeholder="-y @example/agent"
                            @update:modelValue="updateDraftField('args', $event)"
                          />
                        </template>
                        <template v-else>
                          <span class="args-text">{{ agent.args || '-' }}</span>
                        </template>
                      </td>

                      <td>
                        <button
                          class="env-toggle ued-btn ued-btn--secondary ued-btn--sm"
                          type="button"
                          @click="startEnvEdit(agent)"
                        >
                          {{ getEnvSummary(isEditingRow(agent.name) ? draft.env : agent.env) }}
                        </button>
                      </td>

                      <td class="actions-column">
                        <div class="row-actions">
                          <template v-if="isEditingRow(agent.name)">
                            <UEDButton
                              variant="primary"
                              size="sm"
                              :disabled="isSubmitting || isDeleting"
                              @click="saveDraft"
                            >
                              {{ isSubmitting ? t('settings.saving') : t('settings.save') }}
                            </UEDButton>
                            <UEDButton
                              variant="secondary"
                              size="sm"
                              :disabled="isSubmitting || isDeleting"
                              @click="resetEditor"
                            >
                              {{ t('common.cancel') }}
                            </UEDButton>
                          </template>
                          <template v-else>
                            <UEDButton
                              variant="secondary"
                              size="sm"
                              :disabled="isSubmitting || isDeleting || isCreating"
                              @click="startEdit(agent)"
                            >
                              {{ t('settings.edit') }}
                            </UEDButton>
                            <UEDButton
                              variant="danger"
                              size="sm"
                              :disabled="isSubmitting || isDeleting"
                              @click="handleDelete(agent.name)"
                            >
                              {{ t('settings.delete') }}
                            </UEDButton>
                          </template>
                        </div>
                      </td>
                    </tr>

                    <tr v-if="isEditingRow(agent.name) && isEnvExpanded(agent.name)" class="env-detail-row">
                      <td colspan="5">
                        <EnvVarEditor
                          :model-value="draft.env"
                          @update:modelValue="updateDraftEnv"
                        />
                      </td>
                    </tr>

                    <tr v-if="isEditingRow(agent.name) && formError" class="error-row">
                      <td colspan="5" class="ued-error-text">{{ formError }}</td>
                    </tr>
                  </template>
                </template>

                <tr v-if="!hasAgents && !isCreating">
                  <td colspan="5" class="empty-row">
                    <div class="ued-empty">
                      <div class="ued-title-2">{{ t('settings.noAgents') }}</div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </UEDCard>
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

.settings-content {
}

.agents-section,
.config-section {
  min-width: 0;
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1rem 0;
}

.section-copy {
  display: grid;
  gap: 0.2rem;
}

.action-error {
  margin: 1rem 1rem 0;
  padding: 0.75rem 0.85rem;
  border-radius: var(--ued-radius-md);
  border: 1px solid color-mix(in srgb, var(--ued-danger) 18%, var(--ued-border-default));
  background: var(--ued-danger-soft);
  color: var(--ued-danger);
  font-size: 0.84rem;
  line-height: 1.5;
}

.agent-table-shell {
  padding: 1rem;
}

.agent-table-scroll {
  overflow: auto;
  border: 1px solid var(--ued-border-default);
  border-radius: var(--ued-radius-md);
  background: var(--ued-bg-panel);
}

.agent-table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
}

.agent-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 0.78rem 0.85rem;
  background: var(--ued-bg-panel-muted);
  border-bottom: 1px solid var(--ued-border-default);
  color: var(--ued-text-muted);
  font-size: var(--ued-text-caption);
  font-weight: 700;
  text-align: left;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.agent-table tbody td {
  padding: 0.8rem 0.85rem;
  border-top: 1px solid var(--ued-border-subtle);
  vertical-align: top;
}

.agent-row.is-editing {
  background: color-mix(in srgb, var(--ued-accent-soft) 46%, white);
}

.agent-row.is-new {
  background: color-mix(in srgb, var(--ued-success-soft) 52%, white);
}

.name-display,
.name-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.name-display strong {
  color: var(--ued-text-primary);
}

.agent-code,
.args-text {
  display: inline-block;
  color: var(--ued-text-secondary);
  word-break: break-all;
}

.env-toggle {
  min-width: 84px;
}

.actions-column {
  width: 1%;
  white-space: nowrap;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.45rem;
}

.env-detail-row td {
  padding: 0.7rem 0.85rem 0.95rem;
  background: color-mix(in srgb, var(--ued-bg-panel-muted) 72%, white);
}

.error-row td {
  padding-top: 0;
  background: color-mix(in srgb, var(--ued-danger-soft) 40%, white);
}

.empty-row {
  padding: 1.5rem;
}

.config-section {
  align-self: start;
}

.config-path {
  font-size: 0.8rem;
  color: var(--ued-text-secondary);
  background: var(--ued-bg-panel-muted);
  padding: 0.75rem;
  border-radius: var(--ued-radius-md);
  word-break: break-all;
  margin: 0.75rem 0 0.35rem;
}

@media (max-width: 900px) {
  .settings-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 780px) {
  .section-header {
    flex-direction: column;
    align-items: stretch;
  }

  .agent-table {
    min-width: 860px;
  }
}
</style>
