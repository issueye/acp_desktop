<script setup>
import { computed, ref } from 'vue';
import { useSessionStore } from '../../stores/session';
import { useI18n } from '../../lib/i18n';
import AppDialogShell from '../../components/AppDialogShell.vue';
import AppConfirmDialog from '../../components/AppConfirmDialog.vue';
import UEDButton from '../../components/common/UEDButton.vue';
import UEDCard from '../../components/common/UEDCard.vue';

const props = defineProps({
  embedded: { type: Boolean, default: false },
  title: { type: String, default: '' },
  eyebrow: { type: String, default: '' },
});

const emit = defineEmits(['close', 'notify', 'addWorkspace', 'deleteWorkspace', 'deleteSession']);

const sessionStore = useSessionStore();
const { t } = useI18n();

const selectedWorkspaceId = ref('');
const showDeleteConfirm = ref(false);
const pendingDeleteTarget = ref(null);
const showSessionDeleteConfirm = ref(false);
const pendingDeleteSessionId = ref('');

const workspaces = computed(() => sessionStore.workspacesWithCounts);
const hasWorkspaces = computed(() => workspaces.value.length > 0);

const selectedWorkspace = computed(() => {
  if (!selectedWorkspaceId.value) return null;
  return workspaces.value.find((w) => w.id === selectedWorkspaceId.value) ?? null;
});

const selectedWorkspaceSessions = computed(() => {
  if (!selectedWorkspace.value) return [];
  return sessionStore.visibleSessions.filter(
    (s) => s.workspaceId === selectedWorkspace.value.id
  );
});

function selectWorkspace(id) {
  selectedWorkspaceId.value = id;
}

function handleAdd() {
  emit('addWorkspace');
}

function handleRemoveWorkspace(workspace) {
  pendingDeleteTarget.value = { type: 'workspace', id: workspace.id, name: workspace.name };
  showDeleteConfirm.value = true;
}

function handleRemoveSession(session) {
  pendingDeleteSessionId.value = session.id;
  showSessionDeleteConfirm.value = true;
}

function cancelDelete() {
  pendingDeleteTarget.value = null;
  showDeleteConfirm.value = false;
}

function cancelSessionDelete() {
  pendingDeleteSessionId.value = '';
  showSessionDeleteConfirm.value = false;
}

async function confirmDelete() {
  if (!pendingDeleteTarget.value) return;
  const target = pendingDeleteTarget.value;
  try {
    emit('deleteWorkspace', target.id);
    if (selectedWorkspaceId.value === target.id) {
      selectedWorkspaceId.value = workspaces.value[0]?.id || '';
    }
    emit('notify', { message: `${t('workspace.removed')}: ${target.name}`, tone: 'success' });
  } catch (e) {
    emit('notify', { message: e instanceof Error ? e.message : String(e), tone: 'danger' });
  }
  cancelDelete();
}

async function confirmSessionDelete() {
  if (!pendingDeleteSessionId.value) return;
  const sessionId = pendingDeleteSessionId.value;
  try {
    emit('deleteSession', sessionId);
    emit('notify', { message: t('session.delete'), tone: 'success' });
  } catch (e) {
    emit('notify', { message: e instanceof Error ? e.message : String(e), tone: 'danger' });
  }
  cancelSessionDelete();
}

function formatDate(timestamp) {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString();
}

function formatCompactPath(path) {
  const normalized = String(path || '').replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : '.';
}

if (workspaces.value.length > 0) {
  selectedWorkspaceId.value = workspaces.value[0].id;
}
</script>

<template>
  <AppDialogShell
    :model-value="true"
    :title="title || t('workspace.title')"
    :eyebrow="eyebrow || t('app.desktopClient')"
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
            <h3>{{ t('workspace.title') }}</h3>
            <p>{{ workspaces.length }} {{ t('workspace.unit') }}</p>
          </div>
          <button
            class="agent-add-button ued-icon-btn ued-icon-btn--ghost"
            type="button"
            :title="t('workspace.add')"
            :aria-label="t('workspace.add')"
            @click="handleAdd"
          >
            +
          </button>
        </div>

        <div v-if="!hasWorkspaces" class="agent-empty">
          <strong>{{ t('workspace.none') }}</strong>
          <UEDButton variant="primary" size="sm" @click="handleAdd">
            {{ t('workspace.add') }}
          </UEDButton>
        </div>

        <div v-else class="agent-list">
          <button
            v-for="workspace in workspaces"
            :key="workspace.id"
            class="agent-list-item"
            :class="{ active: selectedWorkspaceId === workspace.id }"
            type="button"
            @click="selectWorkspace(workspace.id)"
          >
            <span class="agent-avatar">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" width="14" height="14">
                <path d="M2.5 6.5a1.5 1.5 0 0 1 1.5-1.5h3.3l1.3 1.6H16a1.5 1.5 0 0 1 1.5 1.5v5.9a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 14V6.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
              </svg>
            </span>
            <span class="agent-list-copy">
              <strong>{{ workspace.name }}</strong>
              <small>{{ workspace.sessionCount }} {{ t('workspace.sessionUnit') }}</small>
            </span>
            <button
              class="workspace-row-delete ued-icon-btn ued-icon-btn--ghost ued-icon-btn--danger"
              :title="t('workspace.remove')"
              @click.stop="handleRemoveWorkspace(workspace)"
            >
              ×
            </button>
          </button>
        </div>
      </aside>

      <section class="agent-detail-pane">
        <UEDCard v-if="selectedWorkspace" class="agent-detail-card" :padded="false">
          <div class="detail-header">
            <div class="detail-title">
              <span class="agent-avatar large">
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" width="20" height="20">
                  <path d="M2.5 6.5a1.5 1.5 0 0 1 1.5-1.5h3.3l1.3 1.6H16a1.5 1.5 0 0 1 1.5 1.5v5.9a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 14V6.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
                </svg>
              </span>
              <div>
                <h3>{{ selectedWorkspace.name }}</h3>
                <p>{{ selectedWorkspace.sessionCount }} {{ t('workspace.sessionUnit') }}</p>
              </div>
            </div>
            <div class="detail-actions">
              <UEDButton
                variant="danger"
                size="sm"
                @click="handleRemoveWorkspace(selectedWorkspace)"
              >
                {{ t('workspace.remove') }}
              </UEDButton>
            </div>
          </div>

          <div class="agent-detail-body">
            <div class="detail-grid">
              <div class="detail-field">
                <span>{{ t('workspace.path') }}</span>
                <code class="ued-code">{{ selectedWorkspace.cwd }}</code>
              </div>
              <div class="detail-field">
                <span>{{ t('workspace.createdAt') }}</span>
                <strong>{{ formatDate(selectedWorkspace.createdAt) }}</strong>
              </div>
              <div class="detail-field">
                <span>{{ t('workspace.lastUpdated') }}</span>
                <strong>{{ formatDate(selectedWorkspace.lastUpdated) }}</strong>
              </div>
              <div class="detail-field">
                <span>{{ t('workspace.sessionCount') }}</span>
                <strong>{{ selectedWorkspace.sessionCount }}</strong>
              </div>
            </div>

            <div class="session-section">
              <div class="session-section-head">
                <span>{{ t('workspace.sessions') }}</span>
              </div>
              <div v-if="selectedWorkspaceSessions.length === 0" class="env-empty ued-meta">
                {{ t('session.noneSaved') }}
              </div>
              <div v-else class="session-list">
                <div
                  v-for="session in selectedWorkspaceSessions"
                  :key="session.id"
                  class="session-row"
                  :class="{ external: session.external }"
                >
                  <div class="session-row-info">
                    <strong>{{ session.title }}</strong>
                    <small>{{ session.agentName }} · {{ formatDate(session.lastUpdated) }}</small>
                  </div>
                  <button
                    v-if="!session.external"
                    class="session-row-delete ued-icon-btn ued-icon-btn--ghost ued-icon-btn--danger"
                    :title="t('session.delete')"
                    @click="handleRemoveSession(session)"
                  >
                    ×
                  </button>
                  <span v-else class="external-badge">{{ t('session.externalScanned') }}</span>
                </div>
              </div>
            </div>
          </div>
        </UEDCard>

        <div v-else class="agent-detail-empty">
          <strong>{{ t('workspace.none') }}</strong>
          <UEDButton variant="primary" @click="handleAdd">
            {{ t('workspace.add') }}
          </UEDButton>
        </div>
      </section>
    </div>

    <AppConfirmDialog
      :model-value="showDeleteConfirm"
      :title="t('workspace.remove')"
      :message="t('workspace.confirmRemove', { name: pendingDeleteTarget?.name || '' })"
      :confirm-label="t('workspace.remove')"
      :cancel-label="t('common.cancel')"
      tone="danger"
      @update:modelValue="(value) => { if (!value) cancelDelete(); }"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <AppConfirmDialog
      :model-value="showSessionDeleteConfirm"
      :title="t('session.delete')"
      :message="t('session.confirmDelete')"
      :confirm-label="t('session.delete')"
      :cancel-label="t('common.cancel')"
      tone="danger"
      @update:modelValue="(value) => { if (!value) cancelSessionDelete(); }"
      @confirm="confirmSessionDelete"
      @cancel="cancelSessionDelete"
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

.workspace-row-delete {
  width: 22px;
  height: 22px;
  font-size: 0.9rem;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.agent-list-item:hover .workspace-row-delete,
.agent-list-item.active .workspace-row-delete {
  opacity: 1;
  pointer-events: auto;
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

.detail-actions {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.agent-detail-body {
  padding: 1rem;
  display: grid;
  gap: 0.9rem;
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

.detail-field > span {
  color: var(--ued-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}

.detail-field code,
.detail-field strong {
  min-width: 0;
  color: var(--ued-text-primary);
  overflow-wrap: anywhere;
}

.detail-field code {
  font-size: 0.82rem;
}

.session-section {
  border: 1px solid var(--ued-border-subtle);
  border-radius: var(--ued-radius-md);
  overflow: hidden;
}

.session-section-head {
  padding: 0.72rem 0.85rem;
  background: var(--ued-bg-panel-muted);
  border-bottom: 1px solid var(--ued-border-subtle);
  color: var(--ued-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}

.session-list {
  display: flex;
  flex-direction: column;
}

.session-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.85rem;
  border-top: 1px solid var(--ued-border-subtle);
}

.session-row:first-child {
  border-top: none;
}

.session-row-info {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0.15rem;
}

.session-row-info strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ued-text-primary);
  font-size: 0.84rem;
}

.session-row-info small {
  color: var(--ued-text-muted);
  font-size: 0.72rem;
}

.session-row-delete {
  width: 22px;
  height: 22px;
  font-size: 0.9rem;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.session-row:hover .session-row-delete {
  opacity: 1;
  pointer-events: auto;
}

.external-badge {
  flex-shrink: 0;
  padding: 0.08rem 0.34rem;
  border: 1px solid var(--ued-border-default);
  border-radius: 999px;
  color: var(--ued-text-muted);
  background: color-mix(in srgb, var(--ued-bg-panel-muted) 68%, transparent);
  font-size: 0.66rem;
  line-height: 1.3;
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

  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
