<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from '../../lib/i18n';
import {
  commitWorkspaceFiles,
  generateGitCommitMessageForFiles,
  getGitStatus,
} from '../../lib/wails';
import AppConfirmDialog from '../../components/AppConfirmDialog.vue';
import UEDButton from '../../components/common/UEDButton.vue';
import UEDInput from '../../components/common/UEDInput.vue';

const props = defineProps({
  cwd: { type: String, default: '' },
});

const emit = defineEmits(['notify', 'committed']);

const { t } = useI18n();

const status = ref(null);
const subject = ref('');
const body = ref('');
const isLoading = ref(false);
const isGenerating = ref(false);
const isCommitting = ref(false);
const errorMessage = ref('');
const showConfirm = ref(false);
const selectedPaths = ref(new Set());

const isRepo = computed(() => status.value?.isRepo === true);
const files = computed(() => Array.isArray(status.value?.files) ? status.value.files : []);
const hasChanges = computed(() => files.value.length > 0);
const selectedFilePaths = computed(() => files.value
  .map((file) => file.path)
  .filter((path) => selectedPaths.value.has(path))
);
const selectedFiles = computed(() => files.value.filter((file) => selectedPaths.value.has(file.path)));
const allFilesSelected = computed(() => hasChanges.value && selectedFilePaths.value.length === files.value.length);
const someFilesSelected = computed(() => selectedFilePaths.value.length > 0);
const canCommit = computed(() =>
  isRepo.value &&
  hasChanges.value &&
  someFilesSelected.value &&
  !status.value?.mergeInProgress &&
  subject.value.trim().length > 0 &&
  !isCommitting.value
);
const commitMessage = computed(() => {
  const nextSubject = subject.value.trim();
  const nextBody = body.value.trim();
  return nextBody ? `${nextSubject}\n\n${nextBody}` : nextSubject;
});
const branchLabel = computed(() => status.value?.branch || 'HEAD');

watch(
  () => props.cwd,
  async (cwd) => {
    clearDraft();
    if (cwd) {
      await refreshStatus();
    } else {
      status.value = null;
    }
  },
  { immediate: true }
);

function notify(message, tone = 'success') {
  emit('notify', { message, tone });
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function clearDraft() {
  subject.value = '';
  body.value = '';
  errorMessage.value = '';
  showConfirm.value = false;
}

function syncSelectedPaths(nextFiles) {
  const nextPaths = nextFiles.map((file) => file.path).filter(Boolean);
  const previous = selectedPaths.value;
  const nextSelected = new Set(nextPaths.filter((path) => previous.has(path)));
  if (nextSelected.size === 0) {
    nextPaths.forEach((path) => nextSelected.add(path));
  }
  selectedPaths.value = nextSelected;
}

async function refreshStatus() {
  if (!props.cwd) return;
  isLoading.value = true;
  errorMessage.value = '';
  try {
    status.value = await getGitStatus(props.cwd);
    syncSelectedPaths(Array.isArray(status.value?.files) ? status.value.files : []);
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
    status.value = null;
  } finally {
    isLoading.value = false;
  }
}

async function generateDraft() {
  if (!props.cwd) return;
  isGenerating.value = true;
  errorMessage.value = '';
  try {
    const draft = await generateGitCommitMessageForFiles(props.cwd, selectedFilePaths.value);
    subject.value = draft.subject || '';
    body.value = draft.body || '';
    if (Array.isArray(draft.files) && draft.files.length > 0) {
      status.value = {
        ...(status.value || {}),
        isRepo: true,
        files: draft.files,
      };
    }
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
    notify(errorMessage.value, 'danger');
  } finally {
    isGenerating.value = false;
  }
}

function requestCommit() {
  if (!canCommit.value) {
    return;
  }
  showConfirm.value = true;
}

async function confirmCommit() {
  showConfirm.value = false;
  isCommitting.value = true;
  errorMessage.value = '';
  try {
    const result = await commitWorkspaceFiles(props.cwd, commitMessage.value, selectedFilePaths.value);
    notify(t('git.commitSuccess', { hash: String(result.hash || '').slice(0, 8) }), 'success');
    emit('committed', result);
    clearDraft();
    await refreshStatus();
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
    notify(errorMessage.value, 'danger');
  } finally {
    isCommitting.value = false;
  }
}

function cancelCommit() {
  showConfirm.value = false;
}

function statusLabel(file) {
  return String(file.status || '').trim() || 'M';
}

function toggleFile(path, checked) {
  const next = new Set(selectedPaths.value);
  if (checked) {
    next.add(path);
  } else {
    next.delete(path);
  }
  selectedPaths.value = next;
}

function toggleAllFiles(checked) {
  selectedPaths.value = checked
    ? new Set(files.value.map((file) => file.path).filter(Boolean))
    : new Set();
}
</script>

<template>
  <section class="git-panel">
    <header class="git-panel__header">
      <div>
        <span class="git-panel__eyebrow">{{ t('git.eyebrow') }}</span>
        <h3>{{ t('git.title') }}</h3>
      </div>
      <UEDButton variant="secondary" size="sm" :disabled="isLoading || !cwd" @click="refreshStatus">
        {{ isLoading ? t('git.refreshing') : t('git.refresh') }}
      </UEDButton>
    </header>

    <div v-if="!cwd" class="git-empty">{{ t('git.noWorkspace') }}</div>
    <div v-else-if="errorMessage" class="git-error">{{ errorMessage }}</div>
    <div v-else-if="isLoading && !status" class="git-empty">{{ t('git.loading') }}</div>
    <div v-else-if="status && !isRepo" class="git-empty">{{ t('git.notRepo') }}</div>
    <template v-else-if="status">
      <div class="git-summary">
        <span><strong>{{ t('git.branch') }}</strong> {{ branchLabel }}</span>
        <span><strong>{{ t('git.changedFiles') }}</strong> {{ files.length }}</span>
        <span><strong>{{ t('git.selectedFiles') }}</strong> {{ selectedFilePaths.length }}</span>
        <span v-if="status.ahead"><strong>{{ t('git.ahead') }}</strong> {{ status.ahead }}</span>
        <span v-if="status.behind"><strong>{{ t('git.behind') }}</strong> {{ status.behind }}</span>
      </div>

      <div v-if="status.mergeInProgress" class="git-warning">
        {{ t('git.mergeInProgress') }}
      </div>

      <div v-if="files.length === 0" class="git-empty git-empty--compact">
        {{ t('git.noChanges') }}
      </div>
      <div v-else class="git-files">
        <label class="git-file git-file--all">
          <input
            type="checkbox"
            :checked="allFilesSelected"
            :aria-checked="allFilesSelected ? 'true' : (someFilesSelected ? 'mixed' : 'false')"
            @change="toggleAllFiles($event.target.checked)"
          />
          <span class="git-file__path">{{ t('git.selectAll') }}</span>
        </label>
        <label v-for="file in files" :key="`${file.status}-${file.path}`" class="git-file">
          <input
            type="checkbox"
            :checked="selectedPaths.has(file.path)"
            @change="toggleFile(file.path, $event.target.checked)"
          />
          <span class="git-file__status">{{ statusLabel(file) }}</span>
          <span class="git-file__path">{{ file.path }}</span>
        </label>
      </div>

      <div class="git-draft">
        <label class="git-field">
          <span>{{ t('git.subject') }}</span>
          <UEDInput
            :model-value="subject"
            :placeholder="t('git.subjectPlaceholder')"
            @update:modelValue="subject = $event"
          />
        </label>
        <label class="git-field">
          <span>{{ t('git.body') }}</span>
          <UEDInput
            as="textarea"
            :rows="5"
            :model-value="body"
            :placeholder="t('git.bodyPlaceholder')"
            @update:modelValue="body = $event"
          />
        </label>
      </div>

      <div class="git-actions">
        <UEDButton
          variant="secondary"
          size="sm"
          :disabled="isGenerating || !isRepo || !hasChanges || !someFilesSelected"
          @click="generateDraft"
        >
          {{ isGenerating ? t('git.generating') : t('git.generateDraft') }}
        </UEDButton>
        <UEDButton
          variant="primary"
          size="sm"
          :disabled="!canCommit"
          @click="requestCommit"
        >
          {{ isCommitting ? t('git.committing') : t('git.commit') }}
        </UEDButton>
      </div>
    </template>

    <AppConfirmDialog
      :model-value="showConfirm"
      :title="t('git.confirmTitle')"
      :message="t('git.confirmMessage', { count: selectedFiles.length, branch: branchLabel, subject })"
      :confirm-label="t('git.commit')"
      :cancel-label="t('common.cancel')"
      tone="warning"
      @update:modelValue="(value) => { if (!value) cancelCommit(); }"
      @confirm="confirmCommit"
      @cancel="cancelCommit"
    />
  </section>
</template>

<style scoped>
.git-panel {
  flex-shrink: 0;
  display: grid;
  gap: 0.85rem;
  background: transparent;
}

.git-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.git-panel__eyebrow {
  display: block;
  margin-bottom: 0.15rem;
  color: var(--ued-text-muted);
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
}

.git-panel h3 {
  margin: 0;
  color: var(--ued-text-primary);
  font-size: 0.95rem;
}

.git-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.8rem;
  color: var(--ued-text-secondary);
  font-size: 0.76rem;
}

.git-summary strong {
  color: var(--ued-text-primary);
}

.git-files {
  max-height: min(280px, 32dvh);
  overflow-y: auto;
  display: grid;
  gap: 0.25rem;
  padding: 0.45rem;
  border: 1px solid var(--ued-border-subtle);
  border-radius: 6px;
  background: var(--ued-bg-panel-muted);
}

.git-file {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--ued-text-secondary);
  font-family: var(--ued-font-mono);
  font-size: 0.74rem;
}

.git-file input {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  accent-color: var(--ued-accent);
}

.git-file--all {
  padding-bottom: 0.28rem;
  border-bottom: 1px solid var(--ued-border-subtle);
  font-family: var(--ued-font-ui);
  font-weight: 700;
}

.git-file__status {
  width: 2rem;
  flex-shrink: 0;
  color: var(--ued-accent);
  font-weight: 700;
}

.git-file__path {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.git-draft {
  display: grid;
  gap: 0.65rem;
}

.git-field {
  display: grid;
  gap: 0.32rem;
  color: var(--ued-text-secondary);
  font-size: 0.74rem;
  font-weight: 600;
}

.git-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.git-empty,
.git-error,
.git-warning {
  padding: 0.7rem 0.8rem;
  border-radius: 6px;
  color: var(--ued-text-secondary);
  background: var(--ued-bg-panel-muted);
  font-size: 0.8rem;
}

.git-empty--compact {
  padding: 0.55rem 0.7rem;
}

.git-error {
  color: var(--ued-danger);
  background: var(--ued-danger-soft);
}

.git-warning {
  color: color-mix(in srgb, var(--ued-warning) 78%, black);
  background: color-mix(in srgb, var(--ued-warning-soft) 70%, white);
}
</style>
