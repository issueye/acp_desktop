<script setup>
import { ref, computed, watch } from 'vue';
import { useSessionStore } from '../../stores/session';
import { useI18n } from '../../lib/i18n';
import { AUTHORIZATION_MODES } from '../../lib/authorization';
import ChatComposer from './ChatComposer.vue';
import ChatHeader from './ChatHeader.vue';
import ChatMessages from './ChatMessages.vue';

const sessionStore = useSessionStore();
const { t } = useI18n();

const inputText = ref('');
const inputHeight = '200px';
const isRefreshingSession = ref(false);
const isPlanCollapsed = ref(false);

const messages = computed(() => sessionStore.messageList);
const isLoading = computed(() => sessionStore.isLoading);
const currentSession = computed(() => sessionStore.currentSession);
const availableModes = computed(() => sessionStore.availableModes);
const currentModeId = computed(() => sessionStore.currentModeId);
const availableModels = computed(() => sessionStore.availableModels);
const currentModelId = computed(() => sessionStore.currentModelId);
const availableCommands = computed(() => sessionStore.availableCommands);
const currentPlanEntries = computed(() => sessionStore.currentPlanEntries);
const currentAuthorizationMode = computed(() => sessionStore.authorizationMode);
const canSend = computed(() => !isLoading.value && inputText.value.trim().length > 0);
const authorizationModeOptions = computed(() => [
  { id: AUTHORIZATION_MODES.MANUAL, label: t('chat.authorizationDefault') },
  { id: AUTHORIZATION_MODES.POPUP_AUTO_FIRST, label: t('chat.authorizationFullAccess') },
]);

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
  if (!canSend.value) return;

  const text = inputText.value.trim();
  inputText.value = '';
  try {
    await sessionStore.sendPrompt(text);
  } catch (e) {
    inputText.value = text;
    console.error('Failed to send prompt:', e);
  }
}

function handleCancel() {
  sessionStore.cancelOperation();
}

async function handleModeChange(modeId) {
  try {
    await sessionStore.setMode(modeId);
  } catch (e) {
    console.error('Failed to change mode:', e);
  }
}

async function handleModelChange(modelId) {
  try {
    await sessionStore.setModel(modelId);
  } catch (e) {
    console.error('Failed to change model:', e);
  }
}

function handleAuthorizationModeChange(mode) {
  sessionStore.setAuthorizationMode(mode);
}

async function handleRefreshSession() {
  if (!currentSession.value || isLoading.value || isRefreshingSession.value) {
    return;
  }

  isRefreshingSession.value = true;
  try {
    await sessionStore.refreshCurrentSession();
  } catch (e) {
    console.error('Failed to refresh session:', e);
  } finally {
    isRefreshingSession.value = false;
  }
}
</script>

<template>
  <div class="chat-view">
    <ChatHeader
      :current-session="currentSession"
      :available-models="availableModels"
      :current-model-id="currentModelId"
      :available-modes="availableModes"
      :current-mode-id="currentModeId"
      :is-loading="isLoading"
      :is-refreshing-session="isRefreshingSession"
      @refresh="handleRefreshSession"
      @model-change="handleModelChange"
      @mode-change="handleModeChange"
    />

    <div class="chat-body" :class="{ 'chat-body-with-plan': currentPlanEntries.length > 0 }">
      <div class="chat-main">
        <ChatMessages
          :style="{ height: `calc(100% - ${inputHeight})` }"
          :messages="messages"
          :is-loading="isLoading"
          :current-plan-entries="currentPlanEntries"
          :is-plan-collapsed="isPlanCollapsed"
          @cancel="handleCancel"
          @toggle-plan="isPlanCollapsed = !isPlanCollapsed"
        />
        <ChatComposer
          v-model="inputText"
          :style="{ height: inputHeight }"
          :available-commands="availableCommands"
          :is-loading="isLoading"
          :can-send="canSend"
          :current-session="currentSession"
          :current-authorization-mode="currentAuthorizationMode"
          :authorization-mode-options="authorizationModeOptions"
          @send="handleSend"
          @authorization-mode-change="handleAuthorizationModeChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: var(--ued-font-ui);
}

.chat-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.chat-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

@media (max-width: 900px) {
  .chat-body {
    flex-direction: column;
  }
}
</style>
