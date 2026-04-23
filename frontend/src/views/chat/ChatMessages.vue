<script setup>
import SvgIcon from '../../components/common/SvgIcon.vue';
import { ref, nextTick, watch, onBeforeUnmount, onMounted, onUpdated } from 'vue';
import { marked } from 'marked';
import { useI18n } from '../../lib/i18n';
import CurrentPlanPanel from './CurrentPlanPanel.vue';
import UEDButton from '../../components/common/UEDButton.vue';
import UEDEmptyState from '../../components/common/UEDEmptyState.vue';

const props = defineProps({
  messages: {
    type: Array,
    default: () => [],
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  currentPlanEntries: {
    type: Array,
    default: () => [],
  },
  isPlanCollapsed: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['cancel', 'toggle-plan']);

const { t } = useI18n();
const messagesContainer = ref(null);
const isPinnedToBottom = ref(true);
const expandedThoughts = ref(new Set());
const expandedToolCalls = ref(new Set());
let scrollFrameId = null;

function clearScheduledScroll() {
  if (scrollFrameId !== null) {
    cancelAnimationFrame(scrollFrameId);
    scrollFrameId = null;
  }
}

function getDistanceToBottom() {
  const container = messagesContainer.value;
  if (!container) return 0;
  return container.scrollHeight - container.scrollTop - container.clientHeight;
}

function updatePinnedState() {
  isPinnedToBottom.value = getDistanceToBottom() <= 48;
}

function scrollToBottom() {
  const container = messagesContainer.value;
  if (!container) return;
  container.scrollTop = container.scrollHeight;
  isPinnedToBottom.value = true;
}

function scheduleScrollToBottom(force = false) {
  if (!force && !isPinnedToBottom.value) {
    return;
  }

  clearScheduledScroll();
  scrollFrameId = requestAnimationFrame(() => {
    scrollFrameId = null;
    scrollToBottom();
  });
}

function handleMessagesScroll() {
  if (props.isLoading) {
    return;
  }
  updatePinnedState();
}

watch(
  () => props.messages,
  async () => {
    await nextTick();
    scheduleScrollToBottom(props.isLoading);
  },
  { deep: true }
);

watch(
  () => props.isLoading,
  async (loading) => {
    await nextTick();
    if (loading) {
      scheduleScrollToBottom(true);
      return;
    }
    updatePinnedState();
  }
);

onMounted(() => {
  updatePinnedState();
});

onUpdated(() => {
  if (props.isLoading) {
    scheduleScrollToBottom(true);
  }
});

onBeforeUnmount(() => {
  clearScheduledScroll();
});

function isThoughtExpanded(messageId) {
  return expandedThoughts.value.has(messageId);
}

function toggleThought(messageId) {
  if (expandedThoughts.value.has(messageId)) {
    expandedThoughts.value.delete(messageId);
  } else {
    expandedThoughts.value.add(messageId);
  }
}

function renderMarkdown(content) {
  if (typeof content !== 'string' || content.length === 0) {
    return '';
  }
  return marked.parse(content, { async: false });
}

function getMessageParts(message) {
  const rawParts = message.parts?.length
    ? message.parts.filter((part) => {
        if (part.type === 'content' || part.type === 'thought') {
          return typeof part.content === 'string' && part.content.length > 0;
        }
        return true;
      })
    : [
        ...(message.content ? [{ type: 'content', content: message.content }] : []),
        ...(message.thought ? [{ type: 'thought', content: message.thought }] : []),
        ...(message.planEntries?.length ? [{ type: 'plan', entries: message.planEntries }] : []),
        ...(message.toolCalls?.length
          ? message.toolCalls.map((toolCall) => ({
              type: 'tool_call',
              toolCall,
            }))
          : []),
      ];

  const seenToolCallIds = new Set();
  return rawParts.filter((part) => {
    if (part.type !== 'tool_call') {
      return true;
    }

    const toolCallId = part.toolCall?.toolCallId;
    if (!toolCallId) {
      return true;
    }
    if (seenToolCallIds.has(toolCallId)) {
      return false;
    }

    seenToolCallIds.add(toolCallId);
    return true;
  });
}

function getThoughtKey(messageId, index) {
  return `${messageId}-${index}`;
}

function getToolKindLabel(kind) {
  switch (kind) {
    case 'read':
      return 'Read';
    case 'edit':
      return 'Edit';
    case 'write':
      return 'Write';
    case 'delete':
      return 'Delete';
    case 'move':
      return 'Move';
    case 'search':
      return 'Search';
    case 'execute':
      return 'Run';
    case 'think':
      return 'Think';
    case 'fetch':
      return 'Fetch';
    default:
      return 'Tool';
  }
}

function getToolStatusLabel(status) {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'in_progress':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return 'Unknown';
  }
}

function getToolCallText(toolCall) {
  return typeof toolCall?.title === 'string' ? toolCall.title.trim() : '';
}

function isToolCallCollapsible(toolCall) {
  const text = getToolCallText(toolCall);
  return text.length > 180 || text.includes('\n');
}

function getToolToggleKey(messageId, partIndex, toolCall) {
  if (toolCall?.toolCallId) {
    return `${messageId}::${toolCall.toolCallId}`;
  }
  return `${messageId}::${partIndex}`;
}

function isToolCallExpanded(toggleKey) {
  return expandedToolCalls.value.has(toggleKey);
}

function toggleToolCall(toggleKey) {
  const next = new Set(expandedToolCalls.value);
  if (next.has(toggleKey)) {
    next.delete(toggleKey);
  } else {
    next.add(toggleKey);
  }
  expandedToolCalls.value = next;
}
</script>

<template>
  <div class="chat-content">
    <div ref="messagesContainer" class="messages-container" @scroll="handleMessagesScroll">
      <div class="messages-stack">
        <div v-if="messages.length === 0 && !isLoading" class="chat-empty-state">
          <UEDEmptyState :title="t('chat.emptyTitle')" :text="t('chat.emptyDesc')">
            <template #icon>
              <div class="empty-icon">+</div>
            </template>
          </UEDEmptyState>
        </div>

        <div
          v-for="message in messages"
          :key="message.id"
          class="message-row"
          :class="[`message-row--${message.role}`]"
        >
          <!-- AI Avatar -->
          <div v-if="message.role === 'assistant'" class="msg-avatar msg-avatar--ai" aria-hidden="true">
            <SvgIcon name="chat-messages-01" />
          </div>

          <div class="msg-body" :class="`msg-body--${message.role}`">
            <div class="msg-header">
              <span class="msg-role">{{ message.role === 'user' ? t('chat.roleYou') : t('chat.roleAssistant') }}</span>
            </div>

            <div class="msg-parts">
              <template v-for="(part, partIndex) in getMessageParts(message)" :key="`${message.id}-${partIndex}`">
                <div v-if="part.type === 'thought' && message.role === 'assistant'" class="thought-section">
                  <button class="thought-toggle ued-btn ued-btn--ghost" @click="toggleThought(getThoughtKey(message.id, partIndex))">
                    <span class="thought-icon" aria-hidden="true">
                      <SvgIcon name="chat-messages-02" />
                    </span>
                    <span class="thought-label">
                      {{ isThoughtExpanded(getThoughtKey(message.id, partIndex)) ? t('chat.hideThinking') : t('chat.showThinking') }}
                    </span>
                    <span class="thought-chevron" aria-hidden="true">
                      <SvgIcon name="chat-messages-03" :class="{ 'is-open': isThoughtExpanded(getThoughtKey(message.id, partIndex)) }" />
                    </span>
                  </button>
                  <div
                    v-if="isThoughtExpanded(getThoughtKey(message.id, partIndex)) && part.content"
                    class="thought-content"
                  >
                    <div class="thought-content__prose" v-html="renderMarkdown(part.content)" />
                  </div>
                </div>

                <div v-else-if="part.type === 'tool_call'" class="tool-calls-section">
                  <div
                    :class="[
                      'tool-call-card',
                      `tool-${part.toolCall.status}`,
                      { 'is-expanded': isToolCallExpanded(getToolToggleKey(message.id, partIndex, part.toolCall)) },
                    ]"
                  >
                    <button
                      class="tool-call-summary"
                      type="button"
                      :aria-expanded="isToolCallExpanded(getToolToggleKey(message.id, partIndex, part.toolCall))"
                      @click="toggleToolCall(getToolToggleKey(message.id, partIndex, part.toolCall))"
                    >
                      <span class="tool-call-summary__main">
                        <span class="tool-call-summary__lead">
                          <span
                            class="tool-status-icon"
                            :title="getToolStatusLabel(part.toolCall.status)"
                          >
                            <SvgIcon name="chat-messages-04" v-if="part.toolCall.status === 'pending' || part.toolCall.status === 'in_progress'" class="tool-spinner" />
                            <SvgIcon name="chat-messages-05" v-else-if="part.toolCall.status === 'completed'" class="tool-check" />
                            <SvgIcon name="chat-messages-06" v-else-if="part.toolCall.status === 'failed'" class="tool-cross" />
                          </span>

                          <span class="tool-kind-pill">
                            <span class="tool-icon" :title="getToolKindLabel(part.toolCall.kind)" aria-hidden="true">
                              <SvgIcon name="chat-messages-07" v-if="part.toolCall.kind === 'read'" />
                              <SvgIcon name="chat-messages-08" v-else-if="part.toolCall.kind === 'edit'" />
                              <SvgIcon name="chat-messages-09" v-else-if="part.toolCall.kind === 'write'" />
                              <SvgIcon name="chat-messages-10" v-else-if="part.toolCall.kind === 'delete'" />
                              <SvgIcon name="chat-messages-11" v-else-if="part.toolCall.kind === 'move'" />
                              <SvgIcon name="chat-messages-12" v-else-if="part.toolCall.kind === 'search'" />
                              <SvgIcon name="chat-messages-13" v-else-if="part.toolCall.kind === 'execute'" />
                              <SvgIcon name="chat-messages-14" v-else-if="part.toolCall.kind === 'think'" />
                              <SvgIcon name="chat-messages-15" v-else-if="part.toolCall.kind === 'fetch'" />
                              <SvgIcon name="chat-messages-16" v-else />
                            </span>
                            <span class="tool-kind-label">{{ getToolKindLabel(part.toolCall.kind) }}</span>
                          </span>
                        </span>

                        <span class="tool-call-summary__tail">
                          <span class="tool-call-id-chip" :title="part.toolCall.toolCallId || ''">
                            <span class="tool-call-id-chip__label">toolCallId</span>
                            <code class="tool-call-id">{{ part.toolCall.toolCallId || '—' }}</code>
                          </span>
                        </span>
                      </span>

                      <span class="tool-expand-button" aria-hidden="true">
                        <span class="tool-expand-chevron">
                          <SvgIcon name="chat-messages-17" :class="{ 'is-open': isToolCallExpanded(getToolToggleKey(message.id, partIndex, part.toolCall)) }" />
                        </span>
                      </span>
                    </button>

                    <div v-if="isToolCallExpanded(getToolToggleKey(message.id, partIndex, part.toolCall))" class="tool-detail">
                      <div v-if="part.toolCall.toolCallId" class="tool-detail-meta">
                        <span class="tool-detail-label">toolCallId</span>
                        <code class="tool-detail-value">{{ part.toolCall.toolCallId }}</code>
                      </div>
                      <div v-if="getToolCallText(part.toolCall)" class="tool-detail-text">
                        {{ getToolCallText(part.toolCall) }}
                      </div>
                      <div v-if="part.toolCall.locations?.length" class="tool-detail-locations">
                        <div
                          v-for="(location, locationIndex) in part.toolCall.locations"
                          :key="`${getToolToggleKey(message.id, partIndex, part.toolCall)}-location-${locationIndex}`"
                          class="tool-location"
                          :title="location.path"
                        >
                          <SvgIcon name="chat-messages-18" class="tool-location__icon" />
                          <span class="tool-location__text">{{ location.path }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  v-else-if="part.type === 'content' && part.content"
                  class="message-content"
                  v-html="renderMarkdown(part.content)"
                />
              </template>
            </div>
          </div>

          <!-- User Avatar -->
          <div v-if="message.role === 'user'" class="msg-avatar msg-avatar--user" aria-hidden="true">
            <SvgIcon name="chat-messages-19" />
          </div>
        </div>

        <div v-if="isLoading" class="loading-indicator" role="status" aria-live="polite">
          <span class="loading-indicator__icon" aria-hidden="true">
            <SvgIcon name="chat-messages-20" />
          </span>
          <span class="loading-indicator__label">{{ t('chat.thinking') }}</span>
          <span class="loading-indicator__dots" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </span>
          <UEDButton class="cancel-btn" variant="secondary" size="sm" @click="emit('cancel')">
            {{ t('chat.cancel') }}
          </UEDButton>
        </div>
      </div>

      <Transition name="scroll-jump">
        <div v-if="messages.length > 0 && !isPinnedToBottom" class="scroll-jump">
          <UEDButton
            class="scroll-jump__button"
            variant="secondary"
            size="sm"
            title="置底"
            aria-label="置底"
            @click="scrollToBottom"
          >
            <SvgIcon name="chat-messages-21" class="scroll-jump__icon" />
          </UEDButton>
        </div>
      </Transition>
    </div>
    <CurrentPlanPanel
      v-if="currentPlanEntries.length"
      class="chat-plan-panel"
      :entries="currentPlanEntries"
      :collapsed="isPlanCollapsed"
      @toggle="$emit('toggle-plan')"
    />
  </div>
</template>

<style scoped>
.chat-content {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.messages-container {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 1.4rem 1.4rem 1.2rem;
  background: var(--ued-bg-window);
}

.messages-stack {
  width: min(920px, 100%);
  margin: 0 auto;
}

.scroll-jump {
  position: sticky;
  bottom: 16px;
  display: flex;
  justify-content: center;
  width: min(920px, 100%);
  margin: 0 auto;
  padding-top: 0.25rem;
  pointer-events: none;
}

.scroll-jump__button {
  pointer-events: auto;
  width: 42px;
  min-width: 42px;
  height: 42px;
  padding: 0;
  border-radius: 999px;
  border-color: color-mix(in srgb, var(--ued-accent) 20%, var(--ued-border-default));
  background: color-mix(in srgb, var(--ued-bg-panel) 92%, white);
  box-shadow: var(--ued-shadow-panel);
  backdrop-filter: blur(14px);
}

.scroll-jump__button:hover {
  transform: translateY(-1px);
}

.scroll-jump__icon {
  width: 18px;
  height: 18px;
  display: block;
}

.chat-empty-state {
  min-height: 100%;
  display: grid;
  place-items: center;
  padding: 2rem 0;
}

.empty-icon {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  margin: 0 auto;
  border-radius: var(--ued-radius-md);
  background: var(--ued-accent-soft);
  border: 1px solid color-mix(in srgb, var(--ued-accent) 18%, var(--ued-border-default));
  color: var(--ued-accent);
  font-size: 1.5rem;
  font-weight: 700;
}

.message-row {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  margin-bottom: 0.6rem;
  padding: 0.5rem 0;
}

.message-row--user {
  justify-content: flex-end;
}

.msg-avatar {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  margin-top: 0.15rem;
}

.msg-avatar .svg-icon {
  width: 100%;
  height: 100%;
  display: block;
}

.msg-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.msg-body--user {
  align-items: flex-end;
}

.msg-body--assistant {
  align-items: flex-start;
}

.msg-header {
  margin-bottom: 0.4rem;
}

.msg-role {
  font-weight: 500;
  font-size: 0.72rem;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--ued-text-muted);
}

.msg-parts {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.msg-body--user .msg-parts {
  align-items: flex-end;
}

.msg-body--assistant .msg-parts {
  align-items: flex-start;
}

.tool-calls-section {
  margin-bottom: 0.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  width: 100%;
}

.tool-call-card {
  width: 100%;
  border: 1px solid color-mix(in srgb, var(--ued-border-subtle) 68%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--ued-bg-panel) 94%, white);
  overflow: hidden;
  transition: border-color 0.12s ease, background 0.12s ease;
}

.tool-call-card:hover {
  border-color: color-mix(in srgb, var(--ued-accent) 24%, var(--ued-border-subtle));
}

.tool-call-card.is-expanded {
  background: color-mix(in srgb, var(--ued-accent-soft) 14%, white);
}

.tool-call-summary {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.3rem 0.4rem;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.tool-call-summary__main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem 0.7rem;
}

.tool-call-summary__lead {
  min-width: 0;
  flex: 1 1 180px;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: nowrap;
}

.tool-call-summary__tail {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 0 1 auto;
  margin-left: auto;
}

.tool-status-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
}

.tool-status-icon .svg-icon {
  width: 13px;
  height: 13px;
  display: block;
}

.tool-spinner {
  color: var(--ued-accent);
  animation: tool-spin 1s linear infinite;
}

.tool-check {
  color: var(--ued-success);
}

.tool-cross {
  color: var(--ued-danger);
}

@keyframes tool-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.tool-kind-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  min-width: 0;
  max-width: 100%;
  padding: 0;
  border-radius: 0;
  background: transparent;
  border: none;
}

.tool-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  color: var(--ued-text-muted);
}

.tool-icon .svg-icon {
  width: 12px;
  height: 12px;
  display: block;
}

.tool-kind-label {
  font-weight: 500;
  font-size: 0.76rem;
  color: var(--ued-text-primary);
  min-width: 0;
  white-space: nowrap;
}

.tool-call-id-chip {
  min-width: 0;
  max-width: min(240px, 100%);
  display: inline-flex;
  align-items: center;
  gap: 0.32rem;
  padding: 0.14rem 0.42rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ued-accent-soft) 28%, white);
  border: 1px solid color-mix(in srgb, var(--ued-accent) 14%, var(--ued-border-subtle));
}

.tool-call-id-chip__label {
  flex-shrink: 0;
  font-size: 0.66rem;
  line-height: 1.3;
  color: var(--ued-text-muted);
}

.tool-call-id,
.tool-detail-value {
  font-family: var(--ued-font-mono);
  font-size: 0.72rem;
  line-height: 1.4;
  color: var(--ued-text-primary);
  overflow-wrap: anywhere;
  word-break: break-all;
}

.tool-call-id {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: normal;
}

.tool-detail-value {
  overflow-wrap: anywhere;
  word-break: break-all;
}

.tool-expand-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  align-self: center;
  color: var(--ued-text-muted);
  opacity: 0.72;
}

.tool-expand-chevron {
  width: 14px;
  height: 14px;
  display: grid;
  place-items: center;
}

.tool-expand-chevron .svg-icon {
  width: 14px;
  height: 14px;
  display: block;
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.tool-call-summary:hover .tool-expand-button {
  opacity: 1;
}

.tool-expand-chevron .svg-icon.is-open {
  transform: rotate(180deg);
}

.tool-detail {
  padding: 0.65rem 0.8rem 0.8rem;
  border-top: 1px solid color-mix(in srgb, var(--ued-border-subtle) 72%, transparent);
  background: color-mix(in srgb, var(--ued-bg-panel-muted) 42%, transparent);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tool-detail-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.tool-detail-label {
  font-size: 0.68rem;
  line-height: 1.35;
  color: var(--ued-text-muted);
}

.tool-detail-text {
  font-size: 0.78rem;
  line-height: 1.55;
  color: var(--ued-text-primary);
  overflow-wrap: anywhere;
  word-break: break-word;
  white-space: pre-wrap;
}

.tool-detail-locations {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding-top: 0.1rem;
}

.tool-location {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--ued-text-muted);
  font-size: 0.72rem;
  line-height: 1.45;
}

.tool-location__icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  opacity: 0.7;
}

.tool-location__text {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tool-pending,
.tool-in_progress,
.tool-completed,
.tool-failed {
  background: transparent;
}

.message-content {
  font-size: 0.95rem;
  line-height: 1.78;
  letter-spacing: 0.005em;
  overflow-wrap: break-word;
  word-wrap: break-word;
  color: var(--ued-text-primary);
  max-width: 100%;
}

.msg-body--user .message-content {
  background: var(--bg-user);
  padding: 0.55rem 0.85rem;
  border-radius: 10px;
  border-bottom-right-radius: 3px;
}

.message-content :deep(p) {
  margin: 0.58rem 0;
}

.message-content :deep(ol),
.message-content :deep(ul) {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.message-content :deep(li) {
  margin: 0.3rem 0;
}

.message-content :deep(pre) {
  background: var(--ued-bg-panel-muted);
  color: var(--ued-text-primary);
  padding: 0.75rem;
  border-radius: var(--ued-radius-sm);
  overflow-x: auto;
}

.message-content :deep(code) {
  font-family: var(--ued-font-mono);
  font-size: 0.88rem;
}

.message-content :deep(table) {
  width: 100%;
  margin: 0.8rem 0;
  border-collapse: collapse;
  font-size: 0.88rem;
  line-height: 1.6;
  border: 1px solid var(--ued-border-subtle);
  border-radius: 8px;
  overflow: hidden;
  background: color-mix(in srgb, var(--ued-bg-panel-muted) 50%, transparent);
}

.message-content :deep(thead) {
  background: color-mix(in srgb, var(--ued-accent-soft) 35%, transparent);
}

.message-content :deep(th) {
  font-weight: 600;
  text-align: left;
  padding: 0.55rem 0.75rem;
  color: var(--ued-text-primary);
  border-bottom: 1px solid var(--ued-border-subtle);
  white-space: nowrap;
}

.message-content :deep(td) {
  padding: 0.5rem 0.75rem;
  color: var(--ued-text-primary);
  border-bottom: 1px solid color-mix(in srgb, var(--ued-border-subtle) 50%, transparent);
  vertical-align: top;
}

.message-content :deep(tbody tr:last-child td) {
  border-bottom: none;
}

.message-content :deep(tbody tr:hover) {
  background: color-mix(in srgb, var(--ued-accent) 4%, transparent);
}

.message-content :deep(table code) {
  font-size: 0.84rem;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  background: var(--ued-bg-panel-muted);
  border: 1px solid color-mix(in srgb, var(--ued-border-subtle) 70%, transparent);
}

.loading-indicator {
  display: flex;
  align-items: center;
  gap: 0.42rem;
  padding: 0.45rem 0;
  color: var(--ued-text-muted);
  background: transparent;
  border: none;
}

.loading-indicator__icon {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  color: var(--ued-text-muted);
}

.loading-indicator__icon .svg-icon {
  width: 13px;
  height: 13px;
  display: block;
}

.loading-indicator__label {
  font-size: 0.8rem;
  line-height: 1.4;
  font-weight: 500;
}

.loading-indicator__dots {
  display: inline-flex;
  align-items: center;
  gap: 0.18rem;
  min-width: 18px;
}

.loading-indicator__dots span {
  width: 3px;
  height: 3px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.28;
  animation: loading-pulse 1.2s ease-in-out infinite;
}

.loading-indicator__dots span:nth-child(2) {
  animation-delay: 0.16s;
}

.loading-indicator__dots span:nth-child(3) {
  animation-delay: 0.32s;
}

.cancel-btn {
  margin-left: auto;
}

.thought-section {
  margin-bottom: 0.75rem;
  border: none;
  border-radius: 0;
  overflow: hidden;
  background: transparent;
  box-shadow: none;
}

.thought-toggle {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.35rem;
  width: 100%;
  padding: 0.12rem 0;
  background: transparent;
  min-height: auto;
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--ued-text-muted);
  text-align: left;
  transition: background 0.15s ease, color 0.15s ease;
  transform: none;
}

.thought-toggle:hover {
  background: transparent;
  color: var(--ued-text-primary);
}

.thought-toggle:active:not(:disabled) {
  transform: none;
}

.thought-icon {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 0;
  color: var(--ued-text-muted);
  background: transparent;
  border: none;
}

.thought-icon .svg-icon {
  width: 13px;
  height: 13px;
  display: block;
}

.thought-label {
  flex: 1;
  font-weight: 500;
  color: currentColor;
}

.thought-chevron {
  color: var(--ued-text-muted);
  margin-left: auto;
  width: 14px;
  height: 14px;
  display: grid;
  place-items: center;
  opacity: 0.72;
}

.thought-chevron .svg-icon {
  width: 14px;
  height: 14px;
  display: block;
  transition: transform 0.18s ease;
}

.thought-chevron .svg-icon.is-open {
  transform: rotate(180deg);
}

.thought-content {
  padding: 0.1rem 0 0.55rem 0.7rem;
  background: transparent;
  border-top: none;
  font-size: 0.9rem;
  color: var(--ued-text-muted);
  line-height: 1.72;
  letter-spacing: 0.004em;
  border-left: 1px solid color-mix(in srgb, var(--ued-accent) 18%, var(--ued-border-default));
  margin-left: 0.6rem;
}

.thought-content__prose {
  padding: 0.4rem 0.55rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--ued-bg-panel-muted) 88%, white);
  border: 1px solid color-mix(in srgb, var(--ued-border-subtle) 52%, transparent);
}

.thought-content :deep(p) {
  margin: 0 0 0.5rem 0;
}

.thought-content :deep(p:last-child) {
  margin-bottom: 0;
}

.thought-content :deep(code) {
  background: var(--ued-bg-panel-muted);
  padding: 0.125rem 0.25rem;
  border-radius: 3px;
  font-family: var(--ued-font-mono);
  font-size: 0.84em;
}

.thought-content :deep(pre) {
  margin: 0.6rem 0;
  padding: 0.8rem;
  border-radius: 8px;
  background: var(--ued-bg-panel-muted);
  overflow-x: auto;
}

.thought-content :deep(ul),
.thought-content :deep(ol) {
  margin: 0.45rem 0;
  padding-left: 1.35rem;
}

.scroll-jump-enter-active,
.scroll-jump-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.scroll-jump-enter-from,
.scroll-jump-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@keyframes loading-pulse {
  0%,
  100% {
    opacity: 0.22;
    transform: translateY(0);
  }

  50% {
    opacity: 0.72;
    transform: translateY(-1px);
  }
}

@media (max-width: 900px) {
  .message-row {
    gap: 0.4rem;
  }

  .msg-avatar {
    width: 24px;
    height: 24px;
  }

  .messages-container {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .scroll-jump {
    bottom: 12px;
  }

  .tool-call-summary {
    align-items: center;
    gap: 0.55rem;
  }

  .tool-call-summary__main {
    gap: 0.4rem 0.55rem;
  }

  .tool-call-summary__lead {
    flex: 1 1 140px;
  }

  .tool-call-summary__tail {
    flex: 1 1 100%;
    margin-left: 1.85rem;
    justify-content: flex-start;
  }

  .tool-call-id-chip {
    max-width: min(100%, 280px);
  }

  .message-content :deep(table) {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
    -webkit-overflow-scrolling: touch;
  }

  .message-content :deep(th),
  .message-content :deep(td) {
    padding: 0.45rem 0.6rem;
    font-size: 0.84rem;
  }
}
</style>
