<script setup>
import SvgIcon from '../../components/common/SvgIcon.vue';
import AgentAvatar from '../../components/AgentAvatar.vue';
import AppConfirmDialog from '../../components/AppConfirmDialog.vue';
import { useChatSessionPanel } from './useChatSessionPanel';

const props = defineProps({
  show: { type: Boolean, default: true },
  isSelectingFolder: { type: Boolean, required: true },
  selectedAgent: { type: String, default: '' },
  selectedCwd: { type: String, default: '' },
  activeWorkspaceId: { type: String, default: '' },
  proxyEnabled: { type: Boolean, required: true },
  httpProxy: { type: String, required: true },
  httpsProxy: { type: String, required: true },
  allProxy: { type: String, required: true },
  noProxy: { type: String, required: true },
  previewSessionId: { type: String, default: '' },
});

const emit = defineEmits([
  'update:selectedAgent',
  'update:selectedCwd',
  'update:activeWorkspaceId',
  'update:proxyEnabled',
  'update:httpProxy',
  'update:httpsProxy',
  'update:allProxy',
  'update:noProxy',
  'update:isSelectingFolder',
  'update:showWorkspaceDialog',
  'update:previewSessionId',
  'notify',
  'open-git',
  'open-session-tab',
]);

const {
  activeWorkspaceId,
  currentSessionId,
  currentSessionInActiveWorkspace,
  handleAddWorkspace,
  handleConnectAction,
  handleCreateSession,
  handleDelete,
  handleDeleteSession,
  handleDeleteWorkspace,
  handleDisconnect,
  handleNewSessionFromWorkspace,
  handleRefreshWorkspace,
  handleRemoveWorkspaceClick,
  handleResumeSession,
  handleSelectWorkspace,
  handleSessionClick,
  handleToggleSessionPin,
  isConnected,
  isConnectedSession,
  isChatLoadingSession,
  isConnecting,
  isDeletingSession,
  isPendingSession,
  isPinned,
  isSelectedSession,
  isWorkspaceOpen,
  openWorkspaceDialog,
  pendingDeleteWorkspaceId,
  previewSessionId,
  savedSessionCount,
  selectedAgent,
  selectedCwd,
  sessionSearchQuery,
  showDeleteConfirm,
  showWorkspaceDeleteConfirm,
  syncSelectionFromCurrentSession,
  t,
  toggleWorkspace,
  workspaces,
  workspaceList,
  getConnectActionLabel,
  getSessionSummary,
  cancelDelete,
  confirmDelete,
  cancelDeleteWorkspace,
  confirmDeleteWorkspace,
} = useChatSessionPanel(props, emit);

defineExpose({
  handleCreateSession,
  handleSelectWorkspace,
  handleAddWorkspace,
  openWorkspaceDialog,
  handleResumeSession,
  handleDeleteSession,
  handleDisconnect,
  handleToggleSessionPin,
  handleDeleteWorkspace,
  handleRefreshWorkspace,
  syncSelectionFromCurrentSession,
  savedSessionCount,
  currentSessionId,
  previewSessionId,
  activeWorkspaceId,
  selectedAgent,
  selectedCwd,
  isConnected,
  isConnecting,
  currentSessionInActiveWorkspace,
});
</script>

<template>
  <aside v-if="show" class="chat-session-panel">
    <div class="chat-session-panel__top">
      <button
        class="chat-session-panel__btn ued-icon-btn ued-icon-btn--ghost"
        :disabled="isConnecting"
        :title="t('workspace.add')"
        :aria-label="t('workspace.add')"
        @click="handleAddWorkspace"
      >
        <SvgIcon name="chat-session-panel-01" />
      </button>
      <button
        class="chat-session-panel__btn ued-icon-btn ued-icon-btn--ghost"
        :disabled="isConnecting"
        :title="t('app.newSession')"
        :aria-label="t('app.newSession')"
        @click="openWorkspaceDialog"
      >
        <SvgIcon name="chat-session-panel-02" />
      </button>
    </div>

    <div class="chat-session-panel__search">
      <input
        v-model="sessionSearchQuery"
        type="text"
        class="session-search"
        :placeholder="t('app.searchSessions')"
      />
    </div>

    <div class="chat-session-panel__tree">
      <div v-if="workspaceList.length === 0" class="csp-empty">
        <p>{{ sessionSearchQuery ? t('session.noMatching') : t('session.noneSaved') }}</p>
        <p class="csp-empty-hint">{{ sessionSearchQuery ? t('session.tryAnotherKeyword') : t('session.createHint') }}</p>
      </div>

      <div v-else class="csp-workspace-list">
        <section
          v-for="workspace in workspaceList"
          :key="workspace.id"
          class="csp-workspace"
        >
          <button
            class="csp-workspace-row"
            :class="{ active: activeWorkspaceId === workspace.id, open: isWorkspaceOpen(workspace.id) }"
            type="button"
            @click="toggleWorkspace(workspace.id)"
          >
            <span
              class="csp-chevron"
              :class="{ open: isWorkspaceOpen(workspace.id) }"
            />
            <span class="csp-workspace-icon" aria-hidden="true">
              <SvgIcon name="chat-session-panel-03" width="14" height="14" />
            </span>
            <span class="csp-workspace-label">
              <strong>{{ workspace.name }}</strong>
            </span>
            <span class="csp-workspace-count">{{ workspace.sessions.length }}</span>
            <button
              class="csp-workspace-git ued-icon-btn ued-icon-btn--ghost"
              :title="t('git.open')"
              :aria-label="t('git.open')"
              @click.stop="emit('open-git', workspace.cwd)"
            >
              <SvgIcon name="git-commit" />
            </button>
            <button
              class="csp-workspace-new ued-icon-btn ued-icon-btn--ghost"
              :title="t('app.newSession')"
              :aria-label="t('app.newSession')"
              @click.stop="(event) => handleNewSessionFromWorkspace(workspace.id, event)"
            >
              <SvgIcon name="chat-session-panel-04" />
            </button>
            <button
              class="csp-workspace-delete ued-icon-btn ued-icon-btn--ghost ued-icon-btn--danger"
              :title="t('workspace.remove')"
              :aria-label="t('workspace.remove')"
              @click.stop="(event) => handleRemoveWorkspaceClick(workspace.id, event)"
            >
              <SvgIcon name="chat-session-panel-05" />
            </button>
          </button>

          <div v-if="isWorkspaceOpen(workspace.id)" class="csp-workspace-sessions">
            <div
              v-for="session in workspace.sessions"
              :key="session.id"
              class="csp-session-row"
              :class="{
                active: isSelectedSession(session.id),
                external: session.external,
                busy: isPendingSession(session.id) || isDeletingSession(session.id),
                'chat-loading': isChatLoadingSession(session.id)
              }"
              :title="getSessionSummary(session)"
              role="button"
              tabindex="0"
              @click="handleSessionClick(session)"
              @keydown.enter.prevent="handleSessionClick(session)"
            >
              <AgentAvatar :name="session.agentName" :size="14" class="csp-session-avatar" />
              <span
                v-if="currentSessionId === session.id || isConnectedSession(session.id)"
                class="csp-session-dot"
                :class="{ active: currentSessionId === session.id, loading: isChatLoadingSession(session.id) }"
              />
              <span class="csp-session-label">
                <strong>{{ session.title }}</strong>
                <small v-if="session.external">{{ t('session.externalScanned') }}</small>
              </span>

              <div class="csp-session-actions">
                <template v-if="!session.external">
                  <button
                    class="csp-action-btn ued-icon-btn ued-icon-btn--ghost connect-toggle"
                    :class="{ disconnect: isConnectedSession(session.id), busy: isPendingSession(session.id) }"
                    :disabled="isPendingSession(session.id) || isDeletingSession(session.id)"
                    :title="getConnectActionLabel(session)"
                    @click="(event) => handleConnectAction(session, event)"
                  >
                    <SvgIcon name="chat-session-panel-06" class="csp-connect-icon" />
                  </button>
                  <button
                    class="csp-action-btn ued-icon-btn ued-icon-btn--ghost"
                    :class="{ pinned: isPinned(session.id) }"
                    :disabled="isPendingSession(session.id) || isDeletingSession(session.id)"
                    :title="isPinned(session.id) ? t('session.unpin') : t('session.pin')"
                    :aria-label="isPinned(session.id) ? t('session.unpin') : t('session.pin')"
                    @click="(event) => handleToggleSessionPin(session.id, event)"
                  >
                    <SvgIcon name="session-action-pin" class="csp-session-action-icon" />
                  </button>
                </template>
                <button
                  class="csp-action-btn ued-icon-btn ued-icon-btn--ghost ued-icon-btn--danger"
                  :disabled="isPendingSession(session.id) || isDeletingSession(session.id)"
                  :title="isDeletingSession(session.id) ? t('session.deleting') : t('session.delete')"
                  :aria-label="isDeletingSession(session.id) ? t('session.deleting') : t('session.delete')"
                  @click="(event) => handleDelete(session.id, event)"
                >
                  <SvgIcon
                    :name="isDeletingSession(session.id) ? 'session-action-pending' : 'session-action-delete'"
                    class="csp-session-action-icon"
                  />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <AppConfirmDialog
      :model-value="showDeleteConfirm"
      :title="t('session.delete')"
      :message="t('session.confirmDelete')"
      :confirm-label="t('session.delete')"
      :cancel-label="t('common.cancel')"
      tone="danger"
      @update:modelValue="(value) => { if (!value) cancelDelete(); }"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <AppConfirmDialog
      :model-value="showWorkspaceDeleteConfirm"
      :title="t('workspace.remove')"
      :message="t('workspace.confirmRemove', { name: workspaces.find((w) => w.id === pendingDeleteWorkspaceId)?.name || '' })"
      :confirm-label="t('workspace.remove')"
      :cancel-label="t('common.cancel')"
      tone="danger"
      @update:modelValue="(value) => { if (!value) cancelDeleteWorkspace(); }"
      @confirm="confirmDeleteWorkspace"
      @cancel="cancelDeleteWorkspace"
    />
  </aside>
</template>

<style scoped>
.chat-session-panel {
  width: 300px;
  min-width: 300px;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.65rem 0.55rem;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--ued-border-default);
}

.chat-session-panel__top {
  display: flex;
  gap: 0.35rem;
  align-items: center;
  justify-content: flex-end;
}

.chat-session-panel__btn {
  width: 28px;
  height: 28px;
  color: var(--ued-text-secondary);
  font-size: 1.05rem;
  font-weight: 500;
}

.chat-session-panel__btn .svg-icon {
  width: 17px;
  height: 17px;
}

.chat-session-panel__search {
  padding: 0.1rem 0.15rem 0;
}

.session-search {
  width: 100%;
  min-height: 30px;
  border-radius: 6px;
  border: 1px solid var(--ued-border-default);
  background: rgba(255, 255, 255, 0.42);
  color: var(--ued-text-primary);
  padding: 0 0.65rem;
  font-size: 0.8rem;
}

.session-search:focus {
  outline: none;
  border-color: var(--ued-accent);
  box-shadow: var(--ued-shadow-focus);
}

.chat-session-panel__tree {
  flex: 1;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.csp-empty {
  padding: 0.5rem;
  color: var(--ued-text-muted);
  font-size: 0.78rem;
  text-align: center;
}

.csp-empty-hint {
  margin-top: 0.3rem;
  font-size: 0.72rem;
}

.csp-workspace-list {
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
}

.csp-workspace {
  min-width: 0;
}

.csp-workspace-row {
  width: 100%;
  min-height: 32px;
  display: flex;
  align-items: center;
  gap: 0.38rem;
  padding: 0.2rem 0.34rem 0.2rem 0.28rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--ued-text-secondary);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  font-size: 0.82rem;
  font-weight: 600;
}

.csp-workspace-row:hover,
.csp-workspace-row.active,
.csp-workspace-row.open {
  background: rgba(255, 255, 255, 0.52);
  color: var(--ued-text-primary);
}

.csp-chevron {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  position: relative;
}

.csp-chevron::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 2px;
  width: 5px;
  height: 5px;
  border-right: 1.4px solid currentColor;
  border-bottom: 1.4px solid currentColor;
  transform: rotate(-45deg);
  transition: transform 0.14s ease;
}

.csp-chevron.open::before {
  transform: rotate(45deg);
}

.csp-workspace-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--ued-text-muted);
  display: grid;
  place-items: center;
}

.csp-workspace-label {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0;
}

.csp-workspace-label strong,
.csp-workspace-label small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csp-workspace-label strong {
  font-size: 0.8rem;
  font-weight: 600;
}

.csp-workspace-label small {
  color: var(--ued-text-muted);
  font-size: 0.66rem;
  font-weight: 400;
}

.csp-workspace-count {
  flex-shrink: 0;
  min-width: 1.1rem;
  color: var(--ued-text-muted);
  font-size: 0.7rem;
  text-align: right;
}

.csp-workspace-git,
.csp-workspace-new {
  width: 20px;
  height: 20px;
  font-size: 0.9rem;
  font-weight: 500;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
  color: var(--ued-accent);
}

.csp-workspace-delete {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.csp-workspace-git .svg-icon,
.csp-workspace-new .svg-icon,
.csp-workspace-delete .svg-icon {
  width: 15px;
  height: 15px;
}

.csp-workspace-row:hover .csp-workspace-git,
.csp-workspace-row.active .csp-workspace-git,
.csp-workspace-row:hover .csp-workspace-new,
.csp-workspace-row.active .csp-workspace-new,
.csp-workspace-row:hover .csp-workspace-delete,
.csp-workspace-row.active .csp-workspace-delete {
  opacity: 1;
  pointer-events: auto;
}

.csp-workspace-sessions {
  display: flex;
  flex-direction: column;
  gap: 0.02rem;
  padding-left: 0.3rem;
}

.csp-session-row {
  position: relative;
  width: calc(100% - 0.3rem);
  min-height: 30px;
  display: flex;
  align-items: center;
  gap: 0.38rem;
  padding: 0.14rem 0.28rem 0.14rem 0.4rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--ued-text-secondary);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  margin: 0.2rem 0;
  margin-left: 0.3rem;
}

.csp-session-row:hover,
.csp-session-row.active {
  background: rgba(255, 255, 255, 0.52);
  color: var(--ued-text-primary);
}

.csp-session-row.external {
  cursor: default;
}

.csp-session-avatar {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.csp-session-dot {
  position: absolute;
  left: 1.4rem;
  bottom: 0.22rem;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--ued-success);
  box-shadow: 0 0 0 2px var(--bg-sidebar, #f2ede3);
}

.csp-session-dot.active {
  background: var(--ued-accent);
}

.csp-session-dot.loading {
  background: var(--ued-warning);
  animation: csp-session-dot-pulse 1.2s ease-in-out infinite;
}

.csp-session-label {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0;
}

.csp-session-label strong,
.csp-session-label small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.78rem;
  font-weight: 500;
}

.csp-session-label small {
  color: var(--ued-text-muted);
  font-size: 0.66rem;
}

.csp-session-actions {
  display: flex;
  align-items: center;
  gap: 0.1rem;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.csp-session-row:hover .csp-session-actions,
.csp-session-row.active .csp-session-actions {
  opacity: 1;
  pointer-events: auto;
}

.csp-action-btn {
  width: 20px;
  height: 20px;
  font-size: 0.72rem;
  display: grid;
  place-items: center;
}

.csp-action-btn.pinned {
  color: var(--ued-warning);
}

.csp-action-btn.connect-toggle {
  color: var(--ued-accent);
}

.csp-action-btn.connect-toggle.disconnect {
  color: var(--ued-danger);
}

.csp-connect-icon {
  width: 13px;
  height: 13px;
}

.csp-session-action-icon {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

@keyframes csp-session-dot-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.85;
  }
  50% {
    transform: scale(1.4);
    opacity: 1;
  }
}

@media (max-width: 900px) {
  .csp-session-actions {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
