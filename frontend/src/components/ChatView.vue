<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import { marked } from 'marked';
import { useSessionStore } from '../stores/session';
import { useI18n } from '../lib/i18n';
import ModePicker from './ModePicker.vue';
import ModelPicker from './ModelPicker.vue';
import CommandPalette from './CommandPalette.vue';
import type { ChatMessage, ChatMessagePart, SlashCommand } from '../lib/types';
import CurrentPlanPanel from './CurrentPlanPanel.vue';
import UEDButton from './common/UEDButton.vue';
import UEDInput from './common/UEDInput.vue';
import UEDEmptyState from './common/UEDEmptyState.vue';

const sessionStore = useSessionStore();
const { t } = useI18n();
const inputText = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const commandPaletteRef = ref<InstanceType<typeof CommandPalette> | null>(null);

// Track expanded thought sections by message id
const expandedThoughts = ref<Set<string>>(new Set());

const messages = computed(() => sessionStore.messageList);
const isLoading = computed(() => sessionStore.isLoading);
const currentSession = computed(() => sessionStore.currentSession);
const availableModes = computed(() => sessionStore.availableModes);
const currentModeId = computed(() => sessionStore.currentModeId);
const availableModels = computed(() => sessionStore.availableModels);
const currentModelId = computed(() => sessionStore.currentModelId);
const availableCommands = computed(() => sessionStore.availableCommands);
const currentPlanEntries = computed(() => sessionStore.currentPlanEntries);
const isPlanCollapsed = ref(false);

// Slash command state
const showCommandPalette = computed(() => {
  if (availableCommands.value.length === 0) return false;
  const text = inputText.value;
  // Show palette when input starts with "/" and cursor is after it
  if (!text.startsWith('/')) return false;
  // Don't show if there's a space (command already entered)
  const spaceIndex = text.indexOf(' ');
  return spaceIndex === -1;
});

const commandFilter = computed(() => {
  if (!inputText.value.startsWith('/')) return '';
  return inputText.value.slice(1); // Remove the leading "/"
});

// Auto-scroll to bottom when new messages arrive
watch(messages, async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}, { deep: true });

watch(
  currentPlanEntries,
  (entries, previousEntries) => {
    if (entries.length === 0) {
      isPlanCollapsed.value = false;
      return;
    }

    if (JSON.stringify(entries) !== JSON.stringify(previousEntries ?? [])) {
      isPlanCollapsed.value = false;
    }
  },
  { deep: true }
);

async function handleSend() {
  const text = inputText.value.trim();
  if (!text || isLoading.value) return;
  
  inputText.value = '';
  try {
    await sessionStore.sendPrompt(text);
  } catch (e) {
    console.error('Failed to send prompt:', e);
  }
}

function handleKeyDown(event: KeyboardEvent) {
  // Let CommandPalette handle navigation keys when visible
  if (showCommandPalette.value && commandPaletteRef.value) {
    if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
      commandPaletteRef.value.handleKeyDown(event);
      return;
    }
  }
  
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
}

function handleCommandSelect(command: SlashCommand) {
  // Replace current input with the command
  if (command.hint) {
    inputText.value = `/${command.name} `;
  } else {
    inputText.value = `/${command.name} `;
  }
}

function handleCommandClose() {
  // Just dismiss, keep the text
}

function handleCancel() {
  sessionStore.cancelOperation();
}

async function handleModeChange(modeId: string) {
  try {
    await sessionStore.setMode(modeId);
  } catch (e) {
    console.error('Failed to change mode:', e);
  }
}

async function handleModelChange(modelId: string) {
  try {
    await sessionStore.setModel(modelId);
  } catch (e) {
    console.error('Failed to change model:', e);
  }
}

function isThoughtExpanded(messageId: string): boolean {
  return expandedThoughts.value.has(messageId);
}

function toggleThought(messageId: string): void {
  if (expandedThoughts.value.has(messageId)) {
    expandedThoughts.value.delete(messageId);
  } else {
    expandedThoughts.value.add(messageId);
  }
}

function renderMarkdown(content: string): string {
  return marked.parse(content, { async: false }) as string;
}

function getMessageParts(message: ChatMessage): ChatMessagePart[] {
  if (message.parts?.length) {
    return message.parts;
  }

  const parts: ChatMessagePart[] = [];
  if (message.content) {
    parts.push({
      type: 'content',
      content: message.content,
    });
  }
  if (message.thought) {
    parts.push({
      type: 'thought',
      content: message.thought,
    });
  }
  if (message.planEntries?.length) {
    parts.push({
      type: 'plan',
      entries: message.planEntries,
    });
  }
  if (message.toolCalls?.length) {
    parts.push(
      ...message.toolCalls.map((toolCall) => ({
        type: 'tool_call' as const,
        toolCall,
      }))
    );
  }
  return parts;
}

function getThoughtKey(messageId: string, index: number): string {
  return `${messageId}-${index}`;
}

function getToolIcon(kind: string): string {
  switch (kind) {
    case 'read': return '📖';
    case 'edit': return '✏️';
    case 'delete': return '🗑️';
    case 'move': return '📦';
    case 'search': return '🔍';
    case 'execute': return '▶️';
    case 'think': return '💭';
    case 'fetch': return '🌐';
    default: return '🔧';
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'pending': return '⏳';
    case 'in_progress': return '⚙️';
    case 'completed': return '✓';
    case 'failed': return '✗';
    default: return '';
  }
}
</script>

<template>
  <div class="chat-view">
    <div class="chat-header">
      <div class="chat-title">
        <h2>{{ currentSession?.title || t('chat.titleFallback') }}</h2>
        <span class="agent-name">{{ currentSession?.agentName }}</span>
      </div>
      <div class="header-right">
        <ModelPicker 
          v-if="availableModels.length > 0"
          :models="availableModels"
          :current-model-id="currentModelId"
          :disabled="isLoading"
          @change="handleModelChange"
        />
        <ModePicker 
          v-if="availableModes.length > 0"
          :modes="availableModes"
          :current-mode-id="currentModeId"
          :disabled="isLoading"
          @change="handleModeChange"
        />
      </div>
    </div>
    
    <div ref="messagesContainer" class="messages-container">
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
            <div
              v-if="part.type === 'thought' && message.role === 'assistant'"
              class="thought-section"
            >
              <button class="thought-toggle" @click="toggleThought(getThoughtKey(message.id, partIndex))">
                <span class="thought-icon">...</span>
                <span class="thought-label">
                  {{ isThoughtExpanded(getThoughtKey(message.id, partIndex)) ? t('chat.hideThinking') : t('chat.showThinking') }}
                </span>
                <span class="thought-chevron">
                  {{ isThoughtExpanded(getThoughtKey(message.id, partIndex)) ? '▲' : '▼' }}
                </span>
              </button>
              <div v-if="isThoughtExpanded(getThoughtKey(message.id, partIndex))" class="thought-content">
                <div v-html="renderMarkdown(part.content)" />
              </div>
            </div>

            <div v-else-if="part.type === 'tool_call'" class="tool-calls-section">
              <div :class="['tool-call-inline', `tool-${part.toolCall.status}`]">
                <span class="tool-icon">{{ getToolIcon(part.toolCall.kind) }}</span>
                <span class="tool-name">{{ part.toolCall.title }}</span>
                <span v-if="part.toolCall.locations?.length" class="tool-location">
                  {{ part.toolCall.locations[0].path }}
                </span>
                <span :class="['tool-status', `status-${part.toolCall.status}`]">
                  {{ getStatusIcon(part.toolCall.status) }}
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

        <div v-if="isLoading" class="loading-indicator">
          <span class="spinner"></span>
          <span>{{ t('chat.thinking') }}</span>
          <UEDButton class="cancel-btn" variant="secondary" size="sm" @click="handleCancel">
            {{ t('chat.cancel') }}
          </UEDButton>
        </div>
      </div>
    </div>

    <CurrentPlanPanel
      v-if="currentPlanEntries.length"
      :entries="currentPlanEntries"
      :collapsed="isPlanCollapsed"
      @toggle="isPlanCollapsed = !isPlanCollapsed"
    />
    
    <div class="input-shell" :class="{ 'input-shell-with-plan': currentPlanEntries.length > 0 }">
      <div class="input-container">
        <CommandPalette
          ref="commandPaletteRef"
          :commands="availableCommands"
          :filter="commandFilter"
          :visible="showCommandPalette"
          @select="handleCommandSelect"
          @close="handleCommandClose"
        />
        <UEDInput
          v-model="inputText"
          as="textarea"
          class="chat-input"
          :placeholder="availableCommands.length > 0 ? t('chat.placeholderCommands') : t('chat.placeholder')"
          :disabled="isLoading"
          @keydown="handleKeyDown"
          :rows="3"
        />
        <UEDButton
          class="send-btn"
          variant="primary"
          size="lg"
          :disabled="!inputText.trim() || isLoading"
          @click="handleSend"
        >
          {{ t('chat.send') }}
        </UEDButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-header {
  padding: 0.66rem 1.15rem;
  border-bottom: 1px solid var(--ued-border-default);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: color-mix(in srgb, var(--ued-bg-panel) 90%, white);
}

.chat-title {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.16rem;
}

.chat-header h2 {
  margin: 0;
  font-size: 0.96rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.agent-name {
  font-size: 0.73rem;
  color: var(--ued-accent);
  font-weight: 600;
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
  font-weight: 600;
  font-size: 0.75rem;
  color: var(--ued-text-muted);
}

.tool-calls-section {
  margin-bottom: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tool-call-inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.7rem;
  border-radius: var(--ued-radius-md);
  font-size: 0.8rem;
  background: var(--ued-bg-panel-muted);
  border-left: 2px solid var(--ued-border-default);
}

.tool-pending {
  border-left-color: #f59e0b;
}

.tool-in_progress {
  border-left-color: var(--ued-accent);
  background: var(--ued-accent-soft);
}

.tool-completed {
  border-left-color: var(--ued-success);
  background: var(--ued-success-soft);
}

.tool-failed {
  border-left-color: var(--ued-danger);
  background: var(--ued-danger-soft);
}

.tool-icon {
  font-size: 0.875rem;
}

.tool-name {
  font-weight: 500;
  color: var(--ued-text-primary);
}

.tool-location {
  flex: 1;
  color: var(--ued-text-muted);
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tool-status {
  font-size: 0.75rem;
  font-weight: 600;
}

.status-pending { color: var(--ued-warning); }
.status-in_progress { color: var(--ued-accent); }
.status-completed { color: var(--ued-success); }
.status-failed { color: var(--ued-danger); }

.message-content {
  line-height: 1.7;
  overflow-wrap: break-word;
  word-wrap: break-word;
  color: var(--ued-text-primary);
}

.message-content :deep(p) {
  margin: 0.5rem 0;
}

.message-content :deep(ol),
.message-content :deep(ul) {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.message-content :deep(li) {
  margin: 0.25rem 0;
}

.message-content :deep(pre) {
  background: var(--ued-bg-panel-muted);
  color: var(--ued-text-primary);
  padding: 0.75rem;
  border-radius: var(--ued-radius-sm);
  overflow-x: auto;
}

.message-content :deep(code) {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9rem;
}

.loading-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.95rem 1rem;
  color: var(--ued-text-muted);
  border-radius: var(--ued-radius-md);
  background: var(--ued-bg-panel);
  border: 1px solid var(--ued-border-default);
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--ued-border-default);
  border-top-color: var(--ued-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.input-shell {
  border-top: 1px solid var(--ued-border-default);
  background: color-mix(in srgb, var(--ued-bg-panel) 90%, white);
  padding: 1rem 1.2rem 1.15rem;
}

.input-shell.input-shell-with-plan {
  border-top: none;
  padding-top: 0.45rem;
}

.input-container {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  width: min(920px, 100%);
  margin: 0 auto;
}

.chat-input {
  flex: 1;
  resize: none;
  min-height: 88px;
}

.cancel-btn {
  margin-left: auto;
}

.send-btn {
  min-width: 98px;
  align-self: stretch;
}

.thought-section {
  margin-bottom: 0.75rem;
  border: 1px solid var(--ued-border-default);
  border-radius: var(--ued-radius-md);
  overflow: hidden;
}

.thought-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.65rem 0.85rem;
  background: var(--ued-bg-panel-muted);
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--ued-text-muted);
  text-align: left;
  transition: background 0.15s ease;
}

.thought-toggle:hover {
  background: var(--ued-bg-panel-hover);
}

.thought-icon {
  font-size: 0.95rem;
  flex-shrink: 0;
  letter-spacing: 0.08em;
}

.thought-label {
  flex: 1;
  font-weight: 500;
}

.thought-chevron {
  font-size: 0.7rem;
  color: var(--ued-text-muted);
}

.thought-content {
  padding: 0.85rem 1rem 0.85rem 1.15rem;
  background: var(--ued-bg-panel);
  border-top: 1px solid var(--ued-border-default);
  font-size: 0.9rem;
  color: var(--ued-text-muted);
  font-style: italic;
  line-height: 1.5;
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
  font-size: 0.85em;
}

@media (max-width: 900px) {
  .chat-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-right {
    width: 100%;
    flex-wrap: wrap;
  }

  .message-user,
  .message-assistant {
    margin-left: 0;
    margin-right: 0;
  }

  .messages-container {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .input-container {
    flex-direction: column;
  }

  .send-btn {
    width: 100%;
  }
}
</style>
