<script setup>
import { computed, ref } from 'vue';
import { useI18n } from '../lib/i18n';
import CommandPalette from './CommandPalette.vue';
import UEDButton from './common/UEDButton.vue';
import UEDInput from './common/UEDInput.vue';

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

        <div class="composer-surface">
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
              <label class="authorization-field" :title="t('chat.authorizationHint')">
                <span class="authorization-field__label">{{ t('chat.authorizationMode') }}</span>
                <div class="authorization-select">
                  <span class="authorization-select__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M12 4.75L18.25 7.5V11.63C18.25 15.48 15.7 19.06 12 20.25C8.3 19.06 5.75 15.48 5.75 11.63V7.5L12 4.75Z"
                        stroke="currentColor"
                        stroke-width="1.7"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                      <path
                        d="M9.5 12.25L11.1 13.85L14.75 10.2"
                        stroke="currentColor"
                        stroke-width="1.7"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </span>
                  <select
                    class="authorization-select__control"
                    :value="currentAuthorizationMode"
                    :disabled="!currentSession"
                    @change="$emit('authorization-mode-change', $event.target.value)"
                  >
                    <option
                      v-for="option in authorizationModeOptions"
                      :key="option.id"
                      :value="option.id"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                  <span class="authorization-select__chevron" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M7.5 9.75L12 14.25L16.5 9.75"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </span>
                </div>
              </label>
              <span class="composer-toolbar__hint">{{ t('chat.authorizationHint') }}</span>
            </div>
            <div class="composer-actions composer-actions--text-only">
              <UEDButton
                class="send-btn send-btn--compact"
                variant="primary"
                size="lg"
                :disabled="!canSend"
                :title="t('chat.send')"
                :aria-label="t('chat.send')"
                @click="$emit('send')"
              >
                <svg
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
  align-items: flex-end;
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
}

.authorization-field {
  display: grid;
  gap: 0.32rem;
  min-width: min(280px, 100%);
}

.authorization-field__label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ued-text-muted);
}

.authorization-select {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 42px;
  padding: 0 0.8rem 0 0.72rem;
  border: 1px solid color-mix(in srgb, var(--ued-border-default) 92%, transparent);
  border-radius: 14px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--ued-bg-window) 96%, white) 0%, var(--ued-bg-panel) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
  transition: border-color 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease;
}

.authorization-select:focus-within {
  border-color: color-mix(in srgb, var(--ued-accent) 34%, var(--ued-border-default));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ued-accent) 12%, transparent);
}

.authorization-select__icon {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: color-mix(in srgb, var(--ued-accent) 78%, var(--ued-text-muted));
}

.authorization-select__icon svg,
.authorization-select__chevron svg {
  width: 16px;
  height: 16px;
  display: block;
}

.authorization-select__control {
  flex: 1;
  min-width: 0;
  height: 40px;
  padding: 0 2rem 0 0.55rem;
  border: none;
  background: transparent;
  color: var(--ued-text-primary);
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.2;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  cursor: pointer;
}

.authorization-select__control:focus {
  outline: none;
}

.authorization-select__control:disabled {
  cursor: not-allowed;
  color: var(--ued-text-muted);
}

.authorization-select__chevron {
  position: absolute;
  right: 0.8rem;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  color: var(--ued-text-muted);
  pointer-events: none;
}

.authorization-select:has(.authorization-select__control:disabled) {
  opacity: 0.72;
}

.composer-toolbar__hint {
  max-width: 320px;
  font-size: 0.72rem;
  line-height: 1.45;
  color: var(--ued-text-muted);
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
}

.send-btn:hover {
  background: var(--ued-bg-panel-hover);
  color: var(--ued-text-primary);
  border-color: color-mix(in srgb, var(--ued-border-default) 82%, transparent);
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

@media (max-width: 900px) {
  .authorization-field {
    min-width: 0;
    width: 100%;
  }

  .composer-toolbar {
    align-items: stretch;
  }

  .authorization-select {
    width: 100%;
  }

  .composer-toolbar__hint {
    max-width: none;
    width: 100%;
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

  .send-btn--compact {
    width: 26px;
    min-width: 26px;
    height: 26px;
  }
}
</style>


