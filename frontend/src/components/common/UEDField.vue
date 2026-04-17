<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string;
    helper?: string;
    error?: string;
    required?: boolean;
  }>(),
  {
    label: '',
    helper: '',
    error: '',
    required: false,
  }
);
</script>

<template>
  <label class="ued-field">
    <div v-if="label || $slots.label" class="ued-field__label-row">
      <slot name="label">
        <span class="ued-label">
          {{ label }}
          <span v-if="required" class="ued-field__required">*</span>
        </span>
      </slot>
    </div>
    <slot />
    <div v-if="error" class="ued-error-text">{{ error }}</div>
    <div v-else-if="helper || $slots.helper" class="ued-helper">
      <slot name="helper">
        {{ helper }}
      </slot>
    </div>
  </label>
</template>

<style scoped>
.ued-field__label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ued-space-8);
}

.ued-field__required {
  color: var(--ued-danger);
}
</style>
