<script setup>
import { computed } from 'vue';
import SvgIcon from '../../components/common/SvgIcon.vue';
import UEDTabs from '../../components/common/UEDTabs.vue';
import { useI18n } from '../../lib/i18n';
import ChatView from './ChatView.vue';
import SessionPreview from './SessionPreview.vue';
import WelcomePanel from './WelcomePanel.vue';

const props = defineProps({
  activeTabId: { type: String, default: '' },
  activeSession: { type: Object, default: null },
  tabItems: { type: Array, default: () => [] },
  connectedSessionIds: { type: Array, default: () => [] },
  loadingSessionIds: { type: Array, default: () => [] },
  hasAgents: { type: Boolean, required: true },
  selectedAgentLabel: { type: String, required: true },
  workspaceLabel: { type: String, required: true },
  savedSessionCount: { type: Number, required: true },
  isConnecting: { type: Boolean, required: true },
});

const emit = defineEmits([
  'activate-tab',
  'close-tab',
  'resume-session',
  'open-workspace',
  'open-add-agent',
  'notify',
  'open-git',
]);

const { t } = useI18n();

const tabModel = computed({
  get: () => props.activeTabId,
  set: (value) => emit('activate-tab', value),
});

const hasTabs = computed(() => props.tabItems.length > 0);
const isActiveSessionConnected = computed(() =>
  props.activeSession?.id ? props.connectedSessionIds.includes(props.activeSession.id) : false
);
const shouldShowLiveChat = computed(() => props.activeSession && isActiveSessionConnected.value && !props.activeSession.external);

function isTabConnected(item) {
  return item?.session?.id ? props.connectedSessionIds.includes(item.session.id) : false;
}

function isTabLoading(item) {
  return item?.session?.id ? props.loadingSessionIds.includes(item.session.id) : false;
}

function handleCloseTab(item, event) {
  event.stopPropagation();
  if (!item?.id) return;
  emit('close-tab', item.id);
}
</script>

<template>
  <div class="chat-tabs-view">
    <UEDTabs
      v-if="hasTabs"
      v-model="tabModel"
      class="chat-tabs-view__tabs"
      :items="tabItems"
      size="sm"
    >
      <template #tab="{ item, active }">
        <span
          class="chat-tabs-view__tab-dot"
          :class="{
            'is-active': active,
            'is-connected': isTabConnected(item),
            'is-loading': isTabLoading(item),
            'is-external': item.session?.external,
          }"
          aria-hidden="true"
        />
        <span class="chat-tabs-view__tab-label">{{ item.label || t('chat.titleFallback') }}</span>
        <span v-if="item.badge" class="chat-tabs-view__tab-badge">{{ item.badge }}</span>
        <span
          class="chat-tabs-view__tab-close"
          role="button"
          tabindex="0"
          :title="t('app.close')"
          :aria-label="t('app.close')"
          @click="(event) => handleCloseTab(item, event)"
          @keydown.enter.prevent="(event) => handleCloseTab(item, event)"
          @keydown.space.prevent="(event) => handleCloseTab(item, event)"
        >
          <SvgIcon name="session-action-delete" />
        </span>
      </template>

      <template #default>
        <div class="chat-tabs-view__content">
          <ChatView
            v-if="shouldShowLiveChat"
            @notify="emit('notify', $event)"
            @open-git="emit('open-git', $event)"
          />

          <SessionPreview
            v-else-if="activeSession"
            :session="activeSession"
            @resume="emit('resume-session', $event)"
          />
        </div>
      </template>
    </UEDTabs>

    <WelcomePanel
      v-else
      :has-agents="hasAgents"
      :selected-agent-label="selectedAgentLabel"
      :workspace-label="workspaceLabel"
      :saved-session-count="savedSessionCount"
      :is-connecting="isConnecting"
      @open-workspace="emit('open-workspace')"
      @open-add-agent="emit('open-add-agent')"
    />
  </div>
</template>

<style scoped>
.chat-tabs-view {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, var(--ued-bg-panel) 0%, var(--ued-bg-window) 100%);
}

.chat-tabs-view__tabs {
  flex: 1;
  min-height: 0;
  gap: 0;
}

.chat-tabs-view__tabs :deep(.ued-tabs__header) {
  padding: 0.5rem 0.72rem;
  border-bottom: 1px solid var(--ued-border-default);
  background: color-mix(in srgb, var(--ued-bg-panel) 95%, white);
}

.chat-tabs-view__tabs :deep(.ued-tabs__nav-scroll) {
  min-height: var(--ued-control-height-sm);
}

.chat-tabs-view__tabs :deep(.ued-tabs__list) {
  gap: 0.35rem;
}

.chat-tabs-view__tabs :deep(.ued-tabs__tab) {
  flex: 0 0 auto;
  max-width: 220px;
  padding-right: 0.28rem;
}

.chat-tabs-view__tabs :deep(.ued-tabs__panel) {
  flex: 1;
  min-height: 0;
}

.chat-tabs-view__tab-dot {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--ued-text-disabled);
}

.chat-tabs-view__tab-dot.is-connected {
  background: var(--ued-success);
}

.chat-tabs-view__tab-dot.is-active {
  background: var(--ued-accent);
}

.chat-tabs-view__tab-dot.is-loading {
  background: var(--ued-warning);
  animation: chat-tab-dot-pulse 1.2s ease-in-out infinite;
}

.chat-tabs-view__tab-dot.is-external {
  background: var(--ued-text-muted);
}

.chat-tabs-view__tab-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-tabs-view__tab-badge {
  flex-shrink: 0;
  min-height: 16px;
  display: inline-flex;
  align-items: center;
  padding: 0 0.34rem;
  border-radius: var(--ued-radius-pill);
  background: var(--ued-bg-panel-muted);
  color: var(--ued-text-muted);
  font-size: 0.66rem;
  line-height: 1;
}

.chat-tabs-view__tab-close {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--ued-text-muted);
}

.chat-tabs-view__tab-close:hover {
  color: var(--ued-danger);
  background: color-mix(in srgb, var(--ued-danger) 10%, transparent);
}

.chat-tabs-view__tab-close:focus-visible {
  outline: none;
  box-shadow: var(--ued-shadow-focus);
}

.chat-tabs-view__tab-close .svg-icon {
  width: 12px;
  height: 12px;
}

.chat-tabs-view__content {
  height: 100%;
  min-height: 0;
}

@keyframes chat-tab-dot-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.82;
  }
  50% {
    transform: scale(1.35);
    opacity: 1;
  }
}
</style>
