<script setup>
defineOptions({
  inheritAttrs: false,
});

import { useAttrs } from 'vue';

defineProps({
    modelValue: { type: [String, Number], default: '' },
    disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);

const attrs = useAttrs();

function handleChange(event) {
  emit('update:modelValue', (event.target).value);
}
</script>

<template>
  <div class="ued-select-wrap" :class="{ 'is-disabled': disabled }">
    <select
      v-bind="attrs"
      class="ued-select ued-select-wrap__control"
      :disabled="disabled"
      :value="modelValue"
      @change="handleChange"
    >
      <slot />
    </select>
    <span class="ued-select-wrap__icon" aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none">
        <path
          d="M4.25 6.5L8 10.25L11.75 6.5"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>
  </div>
</template>

<style scoped>
.ued-select-wrap {
  position: relative;
  display: block;
  width: 100%;
}

.ued-select-wrap__control {
  width: 100%;
  padding-right: 2rem;
  appearance: none;
  cursor: pointer;
}

.ued-select-wrap__icon {
  position: absolute;
  top: 50%;
  right: 0.7rem;
  width: 14px;
  height: 14px;
  display: grid;
  place-items: center;
  color: var(--ued-text-muted);
  pointer-events: none;
  transform: translateY(-50%);
  transition: color 0.14s ease;
}

.ued-select-wrap__icon svg {
  width: 100%;
  height: 100%;
}

.ued-select-wrap:hover .ued-select-wrap__icon {
  color: var(--ued-text-primary);
}

.ued-select-wrap.is-disabled .ued-select-wrap__icon {
  color: var(--ued-text-disabled);
}
</style>
