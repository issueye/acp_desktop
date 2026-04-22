<script setup>
import { computed, ref } from 'vue';
import { useI18n } from '../../lib/i18n';
import CommandPalette from './CommandPalette.vue';
import UEDButton from '../../components/common/UEDButton.vue';
import UEDInput from '../../components/common/UEDInput.vue';
import UEDMenuPicker from '../../components/common/UEDMenuPicker.vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  availableCommands: {
    type: Array,
    default: () => [],
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  canSend: {
    type: Boolean,
    default: false,
  },
  currentSession: {
    type: Object,
    default: null,
  },
  currentAuthorizationMode: {
    type: String,
    default: '',
  },
  authorizationModeOptions: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['update:modelValue', 'send', 'authorization-mode-change']);

const { t } = useI18n();
const commandPaletteRef = ref(null);

const inputText = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const showCommandPalette = computed(() => {
  if (props.availableCommands.length === 0) return false;
  if (!props.modelValue.startsWith('/')) return false;
  return props.modelValue.indexOf(' ') === -1;
});

const commandFilter = computed(() => {
  if (!props.modelValue.startsWith('/')) return '';
  return props.modelValue.slice(1);
});

const authorizationMenuItems = computed(() =>
  props.authorizationModeOptions.map((option) => ({
    id: option.id,
    name: option.label,
  }))
);

function handleKeyDown(event) {
  if (showCommandPalette.value && commandPaletteRef.value) {
    if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
      commandPaletteRef.value.handleKeyDown(event);
      return;
    }
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    emit('send');
  }
}

function handleCommandSelect(command) {
  emit('update:modelValue', `/${command.name} `);
}
</script>

<template>
  <div class="input-shell">
    <div class="input-container">
      <div class="composer-shell">
        <CommandPalette
          ref="commandPaletteRef"
          :commands="availableCommands"
          :filter="commandFilter"
          :visible="showCommandPalette"
          @select="handleCommandSelect"
        />

        <div class="composer-surface" :class="{ 'composer-surface--loading': isLoading }">
          <UEDInput
            v-model="inputText"
            as="textarea"
            class="chat-input"
            :placeholder="availableCommands.length > 0 ? t('chat.placeholderCommands') : t('chat.placeholder')"
            :disabled="isLoading"
            :rows="3"
            @keydown="handleKeyDown"
          />

          <div class="composer-footer">
            <div class="composer-toolbar">
              <UEDMenuPicker
                class="authorization-picker"
                :items="authorizationMenuItems"
                :current-id="currentAuthorizationMode"
                :disabled="!currentSession"
                align="left"
                side="top"
                panel-class="authorization-picker-panel"
                min-width="180px"
                max-width="240px"
                trigger-min-width="132px"
                @change="$emit('authorization-mode-change', $event)"
              />
            </div>
            <div class="composer-actions composer-actions--text-only">
              <UEDButton
                class="send-btn send-btn--compact"
                :class="{ 'send-btn--active': isLoading }"
                variant="primary"
                size="lg"
                :disabled="!canSend || isLoading"
                :title="t('chat.send')"
                :aria-label="t('chat.send')"
                @click="$emit('send')"
              >
                <svg
                  v-if="!isLoading"
                  class="send-btn__icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M5.326 18.694L19.43 12 5.326 5.306l1.502 5.163 6.11 1.531-6.11 1.531-1.502 5.163Z"
                    fill="currentColor"
                  />
                </svg>
                <svg
                  v-else
                  class="send-btn__spinner"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="8"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-dasharray="38"
                    stroke-dashoffset="12"
                  />
                </svg>
              </UEDButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.input-shell {
  position: relative;
  border-top: 1px solid var(--ued-border-default);
  background: color-mix(in srgb, var(--ued-bg-panel) 90%, white);
  padding: 1rem 1.2rem 1.15rem;
}

.input-container {
  margin: 0 auto;
}

.composer-shell {
  position: relative;
  width: 100%;
}

.composer-surface {
  display: flex;
  flex-direction: column;
  gap: 0.42rem;
  min-height: 142px;
  padding: 0.72rem 0.78rem 0.42rem;
  border: 1px solid color-mix(in srgb, var(--ued-border-default) 92%, transparent);
  border-radius: 8px;
  background: var(--ued-bg-panel);
  box-shadow: var(--ued-shadow-rest);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
  position: relative;
  overflow: hidden;
}

.composer-surface::before {
  content: '';
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--ued-bg-panel) 60%, transparent);
  backdrop-filter: blur(2px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
  z-index: 5;
  border-radius: inherit;
}

.composer-surface--loading::before {
  opacity: 1;
}

.composer-surface--loading {
  border-color: color-mix(in srgb, var(--ued-accent) 28%, var(--ued-border-default));
}

.composer-surface:focus-within {
  border-color: color-mix(in srgb, var(--ued-accent) 42%, var(--ued-border-default));
  background: color-mix(in srgb, var(--ued-bg-panel) 94%, white);
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--ued-accent) 12%, transparent),
    var(--ued-shadow-panel);
}

.chat-input {
  display: block;
  width: 100%;
  flex: 1 1 auto;
  resize: none;
  min-height: 92px;
  padding: 4px;
  line-height: 1.65;
  border: none;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}

.chat-input:focus {
  outline: none;
}

.composer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: auto;
  padding-top: 0.24rem;
}

.composer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  min-width: 0;
  flex: 1 1 auto;
}

.authorization-picker {
  flex: 0 0 auto;
}

.authorization-picker :deep(.app-popover-panel.authorization-picker-panel) {
  z-index: 3000;
}

.authorization-picker :deep(.ued-menu-picker__trigger) {
  min-height: 36px;
  height: 36px;
  padding: 0.36rem 0.6rem;
  border-radius: 999px;
}

.composer-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.4rem;
  min-height: 22px;
}

.composer-actions--text-only {
  justify-content: flex-end;
}

.send-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--ued-border-default) 92%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--ued-bg-panel) 96%, white);
  color: var(--ued-text-muted);
  box-shadow: none;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.send-btn:hover {
  background: var(--ued-bg-panel-hover);
  color: var(--ued-text-primary);
  border-color: color-mix(in srgb, var(--ued-border-default) 82%, transparent);
}

.send-btn--active {
  background: color-mix(in srgb, var(--ued-accent) 12%, var(--ued-bg-panel));
  border-color: color-mix(in srgb, var(--ued-accent) 30%, var(--ued-border-default));
  color: var(--ued-accent);
  animation: send-btn-pulse 1.8s ease-in-out infinite;
}

.send-btn--active:hover {
  background: color-mix(in srgb, var(--ued-accent) 12%, var(--ued-bg-panel));
  border-color: color-mix(in srgb, var(--ued-accent) 30%, var(--ued-border-default));
  color: var(--ued-accent);
}

@keyframes send-btn-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--ued-accent) 20%, transparent);
  }

  50% {
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--ued-accent) 0%, transparent);
  }
}

.send-btn--compact {
  width: 36px;
  min-width: 36px;
  height: 36px;
  flex-shrink: 0;
}

.send-btn__icon {
  width: 12px;
  height: 12px;
  display: block;
}

.send-btn__spinner {
  width: 12px;
  height: 12px;
  display: block;
  animation: send-btn-spin 1s linear infinite;
}

@keyframes send-btn-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .composer-toolbar {
    align-items: center;
  }

  .composer-actions {
    gap: 0.36rem;
    min-height: 20px;
  }

  .composer-surface {
    min-height: 134px;
    padding: 0.6rem 0.6rem 0.34rem;
    border-radius: 20px;
  }

  .chat-input {
    min-height: 82px;
  }
}
</style>
