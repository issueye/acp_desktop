<script setup>
const props = defineProps({
  name: { type: String, default: '' },
  size: { type: Number, default: 16 },
});

const key = props.name.trim().toLowerCase();

function isMatch(...variants) {
  return variants.some((v) => key.includes(v));
}

const style = {
  width: `${props.size}px`,
  height: `${props.size}px`,
  flexShrink: 0,
};
</script>

<template>
  <!-- Claude -->
  <svg v-if="isMatch('claude')" :style="style" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="#F2EAE5" />
    <path d="M12 6c-1.1 0-2.1.5-2.8 1.3-.7.8-1.1 1.9-.9 3 .2 1.1.9 2 1.9 2.5-.9.5-1.6 1.4-1.8 2.5-.2 1.1.1 2.2.8 3 .7.9 1.7 1.4 2.8 1.4s2.1-.5 2.8-1.4c.7-.8 1-1.9.8-3-.2-1.1-.9-2-1.8-2.5 1-.5 1.7-1.4 1.9-2.5.2-1.1-.2-2.2-.9-3C14.1 6.5 13.1 6 12 6z" fill="#CC785C" />
  </svg>

  <!-- Codex / OpenAI -->
  <svg v-else-if="isMatch('codex', 'openai', 'gpt')" :style="style" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="#E6F6F1" />
    <path d="M12 7l-4.5 5h3v5l4.5-5h-3V7z" fill="#10A37F" />
  </svg>

  <!-- Gemini -->
  <svg v-else-if="isMatch('gemini')" :style="style" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="#E8F0FE" />
    <path d="M12 6l4.5 6-4.5 6-4.5-6 4.5-6z" fill="#4285F4" />
  </svg>

  <!-- OpenCode / generic code -->
  <svg v-else-if="isMatch('opencode', 'code', 'coder')" :style="style" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="#EFF6FF" />
    <path d="M9 9l-3 3 3 3M15 9l3 3-3 3" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>

  <!-- Default fallback -->
  <svg v-else :style="style" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="#F3F4F6" />
    <circle cx="12" cy="12" r="3" fill="#9CA3AF" />
  </svg>
</template>
