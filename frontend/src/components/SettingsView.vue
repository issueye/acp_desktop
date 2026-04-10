<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useConfigStore } from '../stores/config';
import { addAgent, removeAgent, updateAgent } from '../lib/wails';
import { useI18n } from '../lib/i18n';
import EnvVarEditor from './EnvVarEditor.vue';

const props = withDefaults(
  defineProps<{
    startInAddMode?: boolean;
  }>(),
  {
    startInAddMode: false,
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
}>();

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
const editingAgent = ref<string | null>(null);
const formName = ref('');
const formCommand = ref('');
const formArgs = ref('');
const formEnv = ref<Record<string, string>>({});
const formError = ref('');
const isSubmitting = ref(false);

function resetForm() {
  formName.value = '';
  formCommand.value = '';
  formArgs.value = '';
  formEnv.value = {};
  formError.value = '';
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

function startEdit(agent: { name: string; command: string; args: string; env: Record<string, string> }) {
  resetForm();
  editingAgent.value = agent.name;
  formName.value = agent.name;
  formCommand.value = agent.command;
  formArgs.value = agent.args;
  formEnv.value = { ...agent.env };
}

function parseArgs(argsString: string): string[] {
  // Simple arg parsing - split on spaces but respect quotes
  const args: string[] = [];
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
    } else {
      // Check for duplicates
      if (configStore.config.agents[formName.value]) {
        formError.value = t('settings.duplicate');
        isSubmitting.value = false;
        return;
      }
      const newConfig = await addAgent(formName.value, formCommand.value, args, formEnv.value);
      configStore.updateFromEvent(newConfig);
    }
    resetForm();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e);
  } finally {
    isSubmitting.value = false;
  }
}

async function handleDelete(name: string) {
  if (!confirm(t('settings.confirmDeleteAgent', { name }))) return;
  
  try {
    const newConfig = await removeAgent(name);
    configStore.updateFromEvent(newConfig);
  } catch (e) {
    console.error('Failed to delete agent:', e);
  }
}
</script>

<template>
  <div class="settings-overlay" @click.self="emit('close')">
    <div class="settings-panel">
      <div class="settings-header">
        <div>
          <p class="eyebrow">{{ t('app.settings') }}</p>
          <h2>{{ t('settings.title') }}</h2>
        </div>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>

      <div class="settings-content">
        <section class="agents-section">
          <div class="section-header">
            <h3>{{ t('settings.agents') }}</h3>
            <button class="add-btn" @click="startAdd" :disabled="showAddForm">
              {{ t('settings.addAgent') }}
            </button>
          </div>

          <!-- Add/Edit Form -->
          <div v-if="showAddForm || editingAgent" class="agent-form">
            <h4>{{ editingAgent ? t('settings.editAgent') : t('settings.addNewAgent') }}</h4>
            
            <div class="form-group">
              <label>{{ t('settings.name') }}</label>
              <input 
                v-model="formName" 
                type="text" 
                :placeholder="t('settings.placeholder.agentName')"
                :disabled="!!editingAgent"
              />
            </div>

            <div class="form-group">
              <label>{{ t('settings.command') }}</label>
              <input 
                v-model="formCommand" 
                type="text" 
                placeholder="npx"
              />
            </div>

            <div class="form-group">
              <label>{{ t('settings.arguments') }}</label>
              <input 
                v-model="formArgs" 
                type="text" 
                placeholder="-y @example/agent"
              />
              <small>{{ t('settings.argsHint') }}</small>
            </div>

            <div class="form-group">
              <EnvVarEditor v-model="formEnv" />
            </div>

            <div v-if="formError" class="form-error">
              {{ formError }}
            </div>

            <div class="form-actions">
              <button 
                class="save-btn" 
                @click="handleSubmit"
                :disabled="isSubmitting"
              >
                {{ isSubmitting ? t('settings.saving') : t('settings.save') }}
              </button>
              <button class="cancel-btn" @click="resetForm">
                {{ t('common.cancel') }}
              </button>
            </div>
          </div>

          <!-- Agent List -->
          <div class="agents-list">
            <div 
              v-for="agent in agents" 
              :key="agent.name"
              class="agent-item"
            >
              <div class="agent-info">
                <div class="agent-name-row">
                  <div class="agent-name">{{ agent.name }}</div>
                  <span class="agent-badge">ACP</span>
                </div>
                <div class="agent-command">
                  <code>{{ agent.command }} {{ agent.args }}</code>
                </div>
              </div>
              <div class="agent-actions">
                <button class="edit-btn" @click="startEdit(agent)">
                  {{ t('settings.edit') }}
                </button>
                <button class="delete-btn" @click="handleDelete(agent.name)">
                  {{ t('settings.delete') }}
                </button>
              </div>
            </div>

            <div v-if="agents.length === 0" class="no-agents">
              {{ t('settings.noAgents') }}
            </div>
          </div>
        </section>

        <section class="config-section">
          <h3>{{ t('settings.configFile') }}</h3>
          <p class="config-path">{{ configStore.configPath }}</p>
          <small>{{ t('settings.configReloadHint') }}</small>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1.5rem;
}

.settings-panel {
  background: #ffffff;
  border-radius: 8px;
  width: min(880px, 100%);
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.12);
  border: 1px solid var(--border-color);
}

.settings-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.35rem 1.5rem 1rem;
  border-bottom: 1px solid var(--border-color);
}

.settings-header h2 {
  margin: 0.3rem 0 0;
  font-size: 1.35rem;
  color: var(--text-primary);
}

.eyebrow {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.close-btn {
  width: 38px;
  height: 38px;
  border: 1px solid var(--border-color);
  background: #ffffff;
  border-radius: 8px;
  font-size: 1.15rem;
  cursor: pointer;
  color: var(--text-secondary);
}

.close-btn:hover {
  color: var(--text-primary);
  background: #f8fafc;
  border-color: rgba(148,163,184,.34);
}

.settings-content {
  padding: 1.25rem 1.5rem 1.5rem;
  overflow-y: auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 1rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.section-header h3 {
  margin: 0;
  color: var(--text-primary);
}

.add-btn {
  padding: 0.55rem 0.9rem;
  border: 1px solid rgba(37, 99, 235, 0.16);
  background: rgba(37, 99, 235, 0.08);
  color: var(--bg-primary);
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
}

.add-btn:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.14);
}

.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.agent-form {
  background: #f8fafc;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  border: 1px solid var(--border-color);
  box-shadow: none;
}

.agent-form h4 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
}

.form-group {
  margin-bottom: 0.75rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.form-group input {
  width: 100%;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.9rem;
  background: #ffffff;
  color: var(--text-primary);
}

.form-group input:focus {
  outline: none;
  border-color: rgba(37,99,235,.32);
  box-shadow: 0 0 0 3px rgba(37,99,235,.08);
}

.form-group small {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.form-error {
  color: var(--bg-danger);
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
}

.save-btn {
  padding: 0.7rem 1rem;
  background: var(--bg-primary);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.save-btn:hover:not(:disabled) {
  background: var(--bg-primary-hover);
  color: white;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-btn {
  padding: 0.7rem 1rem;
  background: #ffffff;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
}

.cancel-btn:hover {
  background: #f8fafc;
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
  padding: 0.95rem 1rem;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  box-shadow: none;
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

.agent-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.45rem;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 700;
  color: var(--text-accent);
  background: rgba(37, 99, 235, 0.1);
}

.agent-command {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.agent-command code {
  display: inline-block;
  background: #f8fafc;
  padding: 0.22rem 0.45rem;
  border-radius: 8px;
  word-break: break-all;
}

.agent-actions {
  display: flex;
  gap: 0.5rem;
  margin-left: 1rem;
}

.edit-btn,
.delete-btn {
  padding: 0.45rem 0.7rem;
  border-radius: 8px;
  font-size: 0.8rem;
  cursor: pointer;
}

.edit-btn {
  background: #ffffff;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.edit-btn:hover {
  background: #f8fafc;
}

.delete-btn {
  background: rgba(220, 38, 38, 0.06);
  border: 1px solid rgba(220, 38, 38, 0.14);
  color: var(--bg-danger);
}

.delete-btn:hover {
  background: rgba(220, 38, 38, 0.1);
}

.no-agents {
  text-align: center;
  padding: 2rem;
  color: var(--text-muted);
}

.config-section {
  padding: 1rem;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid var(--border-color);
  align-self: start;
}

.config-section h3 {
  margin: 0 0 0.5rem 0;
}

.config-path {
  font-family: monospace;
  font-size: 0.8rem;
  color: var(--text-secondary);
  background: #ffffff;
  padding: 0.75rem;
  border-radius: 8px;
  word-break: break-all;
  margin: 0.75rem 0 0.35rem;
}

.config-section small {
  font-size: 0.75rem;
  color: var(--text-muted);
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
