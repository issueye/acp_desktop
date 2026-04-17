<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useConfigStore } from '../stores/config';
import { addAgent, removeAgent, updateAgent } from '../lib/wails';
import { useI18n } from '../lib/i18n';
import AppDialogShell from './AppDialogShell.vue';
import AppConfirmDialog from './AppConfirmDialog.vue';
import EnvVarEditor from './EnvVarEditor.vue';
import UEDButton from './common/UEDButton.vue';
import UEDCard from './common/UEDCard.vue';
import UEDField from './common/UEDField.vue';
import UEDInput from './common/UEDInput.vue';
import UEDStatus from './common/UEDStatus.vue';
import UEDEmptyState from './common/UEDEmptyState.vue';


const props = defineProps({
    startInAddMode: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'notify']);

const configStore = useConfigStore();
const { t } = useI18n();

const agents = computed(() => {
  return Object.entries(configStore.config.agents).map(([name, config]) => ({
    name,
    command: config.command,
    args: config.args.join(' '),
    env: config.env || {},
  }));
});

// Form state
const showAddForm = ref(false);
const editingAgent = ref(null);
const formName = ref('');
const formCommand = ref('');
const formArgs = ref('');
const formEnv = ref({});
const formError = ref('');
const isSubmitting = ref(false);
const actionError = ref('');
const showDeleteConfirm = ref(false);
const pendingDeleteAgentName = ref('');
const isDeleting = ref(false);

function resetForm() {
  formName.value = '';
  formCommand.value = '';
  formArgs.value = '';
  formEnv.value = {};
  formError.value = '';
  actionError.value = '';
  showAddForm.value = false;
  editingAgent.value = null;
}

function startAdd() {
  resetForm();
  showAddForm.value = true;
}

onMounted(() => {
  if (props.startInAddMode) {
    startAdd();
  }
});

watch(
  () => props.startInAddMode,
  (enabled) => {
    if (enabled) {
      startAdd();
    }
  }
);

function startEdit(agent) {
  resetForm();
  editingAgent.value = agent.name;
  formName.value = agent.name;
  formCommand.value = agent.command;
  formArgs.value = agent.args;
  formEnv.value = { ...agent.env };
}

function parseArgs(argsString) {
  // Simple arg parsing - split on spaces but respect quotes
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

async function handleSubmit() {
  formError.value = '';
  actionError.value = '';
  
  if (!formName.value.trim()) {
    formError.value = t('settings.nameRequired');
    return;
  }
  if (!formCommand.value.trim()) {
    formError.value = t('settings.commandRequired');
    return;
  }

  // Validate agent name is not purely numeric (JavaScript object key ordering issue)
  if (/^\d+$/.test(formName.value)) {
    formError.value = t('settings.nameNumeric');
    return;
  }

  const args = parseArgs(formArgs.value);
  isSubmitting.value = true;

  try {
    if (editingAgent.value) {
      const newConfig = await updateAgent(formName.value, formCommand.value, args, formEnv.value);
      configStore.updateFromEvent(newConfig);
      emit('notify', {
        message: `${t('settings.edit')} Agent: ${formName.value}`,
        tone: 'success',
      });
    } else {
      // Check for duplicates
      if (configStore.config.agents[formName.value]) {
        formError.value = t('settings.duplicate');
        isSubmitting.value = false;
        return;
      }
      const newConfig = await addAgent(formName.value, formCommand.value, args, formEnv.value);
      configStore.updateFromEvent(newConfig);
      emit('notify', {
        message: `${t('settings.addAgent')}: ${formName.value}`,
        tone: 'success',
      });
    }
    resetForm();
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

async function handleDelete(name) {
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
    if (editingAgent.value === deletingName) {
      resetForm();
    }
    cancelDelete();
    emit('notify', {
      message: `${t('settings.delete')}: ${deletingName}`,
      tone: 'success',
    });
  } catch (e) {
    console.error('Failed to delete agent:', e);
    actionError.value = e instanceof Error ? e.message : String(e);
    emit('notify', {
      message: actionError.value,
      tone: 'danger',
    });
  } finally {
    isDeleting.value = false;
  }
}
</script>

<template>
  <AppDialogShell
    :model-value="true"
    :title="t('settings.title')"
    :eyebrow="t('app.settings')"
    max-width="880px"
    body-class="settings-body"
    @update:modelValue="(value) => { if (!value) emit('close'); }"
    @close="emit('close')"
  >
    <div class="settings-content">
      <UEDCard tag="section" class="agents-section">
        <div class="section-header">
          <h3 class="ued-title-2">{{ t('settings.agents') }}</h3>
          <UEDButton variant="primary" @click="startAdd" :disabled="showAddForm || isSubmitting || isDeleting">
            {{ t('settings.addAgent') }}
          </UEDButton>
        </div>

        <div v-if="actionError" class="action-error ued-meta">
          {{ actionError }}
        </div>

        <UEDCard v-if="showAddForm || editingAgent" muted class="agent-form">
          <h4 class="ued-title-2">{{ editingAgent ? t('settings.editAgent') : t('settings.addNewAgent') }}</h4>
          
          <UEDField :label="t('settings.name')">
            <UEDInput
              v-model="formName" 
              :placeholder="t('settings.placeholder.agentName')"
              :disabled="!!editingAgent"
              :error="!!formError && !formName.trim()"
            />
          </UEDField>

          <UEDField :label="t('settings.command')">
            <UEDInput
              v-model="formCommand" 
              placeholder="npx"
              :error="!!formError && !formCommand.trim()"
            />
          </UEDField>

          <UEDField :label="t('settings.arguments')" :helper="t('settings.argsHint')">
            <UEDInput
              v-model="formArgs" 
              placeholder="-y @example/agent"
            />
          </UEDField>

          <div class="form-group">
            <EnvVarEditor v-model="formEnv" />
          </div>

          <div v-if="formError" class="form-error ued-error-text">
            {{ formError }}
          </div>

          <div class="form-actions">
            <UEDButton
              variant="primary"
              @click="handleSubmit"
              :disabled="isSubmitting || isDeleting"
            >
              {{ isSubmitting ? t('settings.saving') : t('settings.save') }}
            </UEDButton>
            <UEDButton variant="secondary" @click="resetForm" :disabled="isSubmitting || isDeleting">
              {{ t('common.cancel') }}
            </UEDButton>
          </div>
        </UEDCard>

        <div class="agents-list">
          <UEDCard
            v-for="agent in agents" 
            :key="agent.name"
            class="agent-item"
          >
            <div class="agent-info">
              <div class="agent-name-row">
                <div class="agent-name">{{ agent.name }}</div>
                <UEDStatus kind="badge">ACP</UEDStatus>
              </div>
              <div class="agent-command">
                <code class="ued-code">{{ agent.command }} {{ agent.args }}</code>
              </div>
            </div>
            <div class="agent-actions">
              <UEDButton variant="secondary" size="sm" @click="startEdit(agent)" :disabled="isSubmitting || isDeleting">
                {{ t('settings.edit') }}
              </UEDButton>
              <UEDButton variant="danger" size="sm" @click="handleDelete(agent.name)" :disabled="isSubmitting || isDeleting">
                {{ t('settings.delete') }}
              </UEDButton>
            </div>
          </UEDCard>

          <UEDEmptyState v-if="agents.length === 0" :title="t('settings.noAgents')" />
        </div>
      </UEDCard>

      <UEDCard tag="section" class="config-section">
        <h3 class="ued-title-2">{{ t('settings.configFile') }}</h3>
        <p class="config-path ued-code">{{ configStore.configPath }}</p>
        <small class="ued-meta">{{ t('settings.configReloadHint') }}</small>
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
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 1rem;
}

.agents-section,
.config-section {
  min-width: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.95rem;
}

.action-error {
  margin-bottom: 0.9rem;
  padding: 0.75rem 0.85rem;
  border-radius: var(--ued-radius-md);
  border: 1px solid color-mix(in srgb, var(--ued-danger) 18%, var(--ued-border-default));
  background: var(--ued-danger-soft);
  color: var(--ued-danger);
  font-size: 0.84rem;
  line-height: 1.5;
}

.agent-form {
  margin-bottom: 1rem;
}

.agent-form h4 {
  margin: 0 0 1rem 0;
}

.form-group {
  margin-bottom: 0.75rem;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
}

.agents-list {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.agent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.agent-info {
  flex: 1;
  min-width: 0;
}

.agent-name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.agent-name {
  font-weight: 600;
}

.agent-command {
  font-size: 0.8rem;
  color: var(--ued-text-muted);
}

.agent-command code {
  display: inline-block;
  background: var(--ued-bg-panel-muted);
  padding: 0.22rem 0.45rem;
  border-radius: var(--ued-radius-sm);
  word-break: break-all;
}

.agent-actions {
  display: flex;
  gap: 0.5rem;
  margin-left: 1rem;
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

  .agent-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .agent-actions {
    margin-left: 0;
  }
}
</style>
