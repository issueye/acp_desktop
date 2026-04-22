<script setup>
import SvgIcon from '../../components/common/SvgIcon.vue';
import { useI18n } from '../../lib/i18n';
import ModePicker from './ModePicker.vue';
import ModelPicker from './ModelPicker.vue';

defineProps({
  currentSession: {
    type: Object,
    default: null,
  },
  availableModels: {
    type: Array,
    default: () => [],
  },
  currentModelId: {
    type: String,
    default: '',
  },
  availableModes: {
    type: Array,
    default: () => [],
  },
  currentModeId: {
    type: String,
    default: '',
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  isRefreshingSession: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['refresh', 'open-git', 'model-change', 'mode-change']);

const { t } = useI18n();
</script>

<template>
  <div class="chat-header">
    <div class="chat-title">
      <h2>{{ currentSession?.title || t('chat.titleFallback') }}</h2>
      <span class="agent-name">{{ currentSession?.agentName }}</span>
    </div>
    <div class="header-right">
      <button
        class="chat-header-action ued-icon-btn"
        :title="t('git.open')"
        :aria-label="t('git.open')"
        :disabled="!currentSession?.cwd"
        @click="$emit('open-git')"
      >
        <SvgIcon name="git-commit" />
      </button>
      <button
        class="chat-header-action ued-icon-btn"
        :class="{ 'is-spinning': isRefreshingSession }"
        :title="t('chat.refresh')"
        :aria-label="t('chat.refresh')"
        :disabled="!currentSession || isLoading || isRefreshingSession"
        @click="$emit('refresh')"
      >
        <SvgIcon name="chat-header-01" />
      </button>
      <ModelPicker
        v-if="availableModels.length > 0"
        :models="availableModels"
        :current-model-id="currentModelId"
        :disabled="isLoading"
        @change="$emit('model-change', $event)"
      />
      <ModePicker
        v-if="availableModes.length > 0"
        :modes="availableModes"
        :current-mode-id="currentModeId"
        :disabled="isLoading"
        @change="$emit('mode-change', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.chat-header {
  padding: 0.3rem 0.4rem;
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
  font-size: 1.04rem;
  line-height: 1.3;
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.chat-header-action {
  width: 32px;
  height: 32px;
}

.chat-header-action .svg-icon {
  width: 15px;
  height: 15px;
  display: block;
}

.chat-header-action.is-spinning .svg-icon {
  animation: chat-refresh-spin 0.9s linear infinite;
}

.agent-name {
  font-size: 0.76rem;
  line-height: 1.45;
  color: var(--ued-accent);
  font-weight: 500;
}

@keyframes chat-refresh-spin {
  to {
    transform: rotate(360deg);
  }
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
}
</style>
