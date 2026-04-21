<script setup>
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
  if (message.parts?.length) {
    return message.parts.filter((part) => {
      if (part.type === 'content' || part.type === 'thought') {
        return typeof part.content === 'string' && part.content.length > 0;
      }
      return true;
    });
  }

  const parts = [];
  if (message.content) {
    parts.push({ type: 'content', content: message.content });
  }
  if (message.thought) {
    parts.push({ type: 'thought', content: message.thought });
  }
  if (message.planEntries?.length) {
    parts.push({ type: 'plan', entries: message.planEntries });
  }
  if (message.toolCalls?.length) {
    parts.push(
      ...message.toolCalls.map((toolCall) => ({
        type: 'tool_call',
        toolCall,
      }))
    );
  }
  return parts;
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

function isToolCallExpanded(toolCallId) {
  return expandedToolCalls.value.has(toolCallId);
}

function toggleToolCall(toolCallId) {
  if (expandedToolCalls.value.has(toolCallId)) {
    expandedToolCalls.value.delete(toolCallId);
  } else {
    expandedToolCalls.value.add(toolCallId);
  }
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
          :class="['message', `message-${message.role}`]"
        >
          <div class="message-header">
            <span class="role">{{ message.role === 'user' ? t('chat.roleYou') : t('chat.roleAssistant') }}</span>
          </div>

          <template v-for="(part, partIndex) in getMessageParts(message)" :key="`${message.id}-${partIndex}`">
            <div v-if="part.type === 'thought' && message.role === 'assistant'" class="thought-section">
              <button class="thought-toggle ued-btn ued-btn--ghost" @click="toggleThought(getThoughtKey(message.id, partIndex))">
                <span class="thought-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M9.5 18.5H14.5M10 21H14M8.25 14.75C7 13.74 6.2 12.19 6.2 10.45C6.2 7.44 8.76 5 12 5C15.24 5 17.8 7.44 17.8 10.45C17.8 12.19 17 13.74 15.75 14.75C15.18 15.21 14.82 15.89 14.82 16.63V17H9.18V16.63C9.18 15.89 8.82 15.21 8.25 14.75Z"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
                <span class="thought-label">
                  {{ isThoughtExpanded(getThoughtKey(message.id, partIndex)) ? t('chat.hideThinking') : t('chat.showThinking') }}
                </span>
                <span class="thought-chevron" aria-hidden="true">
                  <svg
                    :class="{ 'is-open': isThoughtExpanded(getThoughtKey(message.id, partIndex)) }"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8 10L12 14L16 10"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
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
                  'tool-call-inline',
                  `tool-${part.toolCall.status}`,
                  { 'is-expanded': isToolCallExpanded(part.toolCall.toolCallId) },
                ]"
              >
                <span class="tool-icon" :title="getToolKindLabel(part.toolCall.kind)" aria-hidden="true">
                  <svg v-if="part.toolCall.kind === 'read'" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6.75 6.75C6.75 5.78 7.53 5 8.5 5H18V17H8.5C7.53 17 6.75 17.78 6.75 18.75M6.75 6.75V18.75M6.75 6.75H5.75C4.78 6.75 4 7.53 4 8.5V17C4 17.97 4.78 18.75 5.75 18.75H6.75" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <svg v-else-if="part.toolCall.kind === 'edit'" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4.75 19.25H8.25L18.06 9.44C18.65 8.85 18.65 7.9 18.06 7.31L16.69 5.94C16.1 5.35 15.15 5.35 14.56 5.94L4.75 15.75V19.25Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M13.5 7L17 10.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <svg v-else-if="part.toolCall.kind === 'delete'" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5.5 7.5H18.5M9.5 4.75H14.5M8 7.5V17.25C8 18.22 8.78 19 9.75 19H14.25C15.22 19 16 18.22 16 17.25V7.5M10 10.25V15.5M14 10.25V15.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <svg v-else-if="part.toolCall.kind === 'move'" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 4.75L18.5 8.25V15.75L12 19.25L5.5 15.75V8.25L12 4.75Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M5.9 8.5L12 12L18.1 8.5M12 12V19" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <svg v-else-if="part.toolCall.kind === 'search'" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10.5" cy="10.5" r="5.75" stroke="currentColor" stroke-width="1.7" />
                    <path d="M15 15L19 19" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
                  </svg>
                  <svg v-else-if="part.toolCall.kind === 'execute'" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 6.5L17 12L8 17.5V6.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
                  </svg>
                  <svg v-else-if="part.toolCall.kind === 'think'" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9.5 18.5H14.5M10 21H14M8.25 14.75C7 13.74 6.2 12.19 6.2 10.45C6.2 7.44 8.76 5 12 5C15.24 5 17.8 7.44 17.8 10.45C17.8 12.19 17 13.74 15.75 14.75C15.18 15.21 14.82 15.89 14.82 16.63V17H9.18V16.63C9.18 15.89 8.82 15.21 8.25 14.75Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <svg v-else-if="part.toolCall.kind === 'fetch'" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 5C15.87 5 19 8.13 19 12M12 5C8.13 5 5 8.13 5 12M12 5V12H19M5 12C5 15.87 8.13 19 12 19C15.87 19 19 15.87 19 12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 4.75L18.5 8.25V15.75L12 19.25L5.5 15.75V8.25L12 4.75Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M12 8.5V12M12 15.25H12.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
                  </svg>
                </span>
                <div class="tool-main">
                  <div class="tool-topline">
                    <span
                      :class="[
                        'tool-name',
                        {
                          'is-collapsible': isToolCallCollapsible(part.toolCall),
                          'is-expanded': isToolCallExpanded(part.toolCall.toolCallId),
                        },
                      ]"
                      :title="getToolCallText(part.toolCall)"
                    >
                      {{ getToolCallText(part.toolCall) }}
                    </span>
                    <button
                      v-if="isToolCallCollapsible(part.toolCall)"
                      type="button"
                      class="tool-expand-toggle"
                      @click="toggleToolCall(part.toolCall.toolCallId)"
                    >
                      {{ isToolCallExpanded(part.toolCall.toolCallId) ? '收起' : '展开' }}
                    </button>
                  </div>
                  <div
                    v-if="part.toolCall.locations?.length"
                    class="tool-location"
                    :title="part.toolCall.locations[0].path"
                  >
                    <svg class="tool-location__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M4.75 8.75C4.75 7.78 5.53 7 6.5 7H10L11.5 8.5H17.5C18.47 8.5 19.25 9.28 19.25 10.25V16.5C19.25 17.47 18.47 18.25 17.5 18.25H6.5C5.53 18.25 4.75 17.47 4.75 16.5V8.75Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    <span class="tool-location__text">{{ part.toolCall.locations[0].path }}</span>
                  </div>
                </div>
                <span :class="['tool-status', `status-${part.toolCall.status}`]">
                  <svg v-if="part.toolCall.status === 'pending'" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M12 7V12L15 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                    <circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="1.8" />
                  </svg>
                  <svg v-else-if="part.toolCall.status === 'in_progress'" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M12 5V8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                    <path d="M12 16V19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                    <path d="M5 12H8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                    <path d="M16 12H19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                    <path d="M7.05 7.05L9.17 9.17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                    <path d="M14.83 14.83L16.95 16.95" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                    <path d="M16.95 7.05L14.83 9.17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                    <path d="M9.17 14.83L7.05 16.95" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                  </svg>
                  <svg v-else-if="part.toolCall.status === 'completed'" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M7.5 12.5L10.5 15.5L16.5 9.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                    <circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="1.8" />
                  </svg>
                  <svg v-else-if="part.toolCall.status === 'failed'" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="1.8" />
                    <path d="M9.5 9.5L14.5 14.5M14.5 9.5L9.5 14.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                  </svg>
                  <span>{{ getToolStatusLabel(part.toolCall.status) }}</span>
                </span>
              </div>
            </div>

            <div
              v-else-if="part.type === 'content' && part.content"
              class="message-content"
              v-html="renderMarkdown(part.content)"
            />
          </template>
        </div>

        <div v-if="isLoading" class="loading-indicator" role="status" aria-live="polite">
          <span class="loading-indicator__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M9.5 18.5H14.5M10 21H14M8.25 14.75C7 13.74 6.2 12.19 6.2 10.45C6.2 7.44 8.76 5 12 5C15.24 5 17.8 7.44 17.8 10.45C17.8 12.19 17 13.74 15.75 14.75C15.18 15.21 14.82 15.89 14.82 16.63V17H9.18V16.63C9.18 15.89 8.82 15.21 8.25 14.75Z"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
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
            <svg
              class="scroll-jump__icon"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M12 5.5V17.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              <path d="M7.5 13L12 17.5L16.5 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M6 19.5H18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
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
  display: flex;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1.4rem 1.4rem 1.2rem;
  background:
    radial-gradient(circle at top right, rgba(10, 100, 216, 0.04), transparent 24%),
    linear-gradient(180deg, var(--ued-bg-panel) 0%, var(--ued-bg-window) 100%);
}

.messages-stack {
  width: min(920px, 100%);
  margin: 0 auto;
}

.scroll-jump {
  position: sticky;
  bottom: 16px;
  display: flex;
  justify-content: flex-end;
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

.message {
  margin-bottom: 0.95rem;
  padding: 0.95rem 1rem;
  border-radius: var(--ued-radius-md);
  border: 1px solid var(--ued-border-default);
  box-shadow: var(--ued-shadow-rest);
}

.message-user {
  background: color-mix(in srgb, var(--ued-accent) 7%, white);
  margin-left: 4rem;
}

.message-assistant {
  background: var(--ued-bg-panel);
  margin-right: 4rem;
}

.message-header {
  margin-bottom: 0.55rem;
}

.role {
  font-weight: 500;
  font-size: 0.76rem;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--ued-text-muted);
}

.tool-calls-section {
  margin-bottom: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.tool-call-inline {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.38rem 0.5rem;
  font-size: 0.8rem;
  background: color-mix(in srgb, var(--ued-bg-panel-muted) 44%, white);
  border: none;
  box-shadow: none;
  border-radius: 10px;
}

.tool-call-inline.is-expanded {
  align-items: start;
}

.tool-pending,
.tool-in_progress,
.tool-completed,
.tool-failed {
  background: transparent;
}

.tool-icon {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 0;
  background: transparent;
  color: var(--ued-text-muted);
  border: none;
}

.tool-icon svg {
  width: 14px;
  height: 14px;
  display: block;
}

.tool-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
  padding: 0.08rem 0;
}

.tool-topline {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.tool-name {
  font-weight: 500;
  line-height: 1.45;
  color: var(--ued-text-primary);
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
  word-break: break-word;
  white-space: pre-wrap;
  padding: 0.04rem 0;
}

.tool-name.is-collapsible {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.tool-name.is-expanded {
  display: block;
  -webkit-line-clamp: initial;
  overflow: visible;
  padding: 0.45rem 0.55rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--ued-accent-soft) 32%, white);
  border: 1px solid color-mix(in srgb, var(--ued-border-subtle) 62%, transparent);
  line-height: 1.62;
}

.tool-expand-toggle {
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--ued-accent);
  font-size: 0.72rem;
  line-height: 1.4;
  font-weight: 500;
  cursor: pointer;
}

.tool-expand-toggle:hover {
  color: var(--ued-accent-hover);
  text-decoration: underline;
}

.tool-location {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--ued-text-muted);
  font-size: 0.74rem;
  line-height: 1.45;
  padding: 0.1rem 0 0;
  opacity: 0.9;
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

.tool-status {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
  align-self: flex-start;
  min-height: auto;
  padding: 0;
  border-radius: 0;
  font-size: 0.72rem;
  font-weight: 500;
  border: none;
  background: transparent;
  white-space: nowrap;
  opacity: 0.8;
}

.tool-call-inline.is-expanded .tool-status {
  padding-top: 0.45rem;
}

.tool-status svg {
  width: 12px;
  height: 12px;
  display: block;
}

.status-pending {
  color: var(--ued-warning);
}

.status-in_progress {
  color: var(--ued-accent);
}

.status-completed {
  color: var(--ued-success);
}

.status-failed {
  color: var(--ued-danger);
}

.message-content {
  font-size: 0.95rem;
  line-height: 1.78;
  letter-spacing: 0.005em;
  overflow-wrap: break-word;
  word-wrap: break-word;
  color: var(--ued-text-primary);
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

.loading-indicator__icon svg {
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

.thought-icon svg {
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

.thought-chevron svg {
  width: 14px;
  height: 14px;
  display: block;
  transition: transform 0.18s ease;
}

.thought-chevron svg.is-open {
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
  .message-user,
  .message-assistant {
    margin-left: 0;
    margin-right: 0;
  }

  .messages-container {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .scroll-jump {
    bottom: 12px;
  }

  .tool-call-inline {
    grid-template-columns: 38px minmax(0, 1fr);
  }

  .tool-status {
    grid-column: 1 / -1;
    justify-self: flex-start;
  }
}
</style>
