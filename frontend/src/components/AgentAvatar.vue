<script setup>
import SvgIcon from './common/SvgIcon.vue';
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
  <SvgIcon name="agent-avatar-01" v-if="isMatch('claude')" :style="style" />

  <!-- Codex / OpenAI -->
  <SvgIcon name="agent-avatar-02" v-else-if="isMatch('codex', 'openai', 'gpt')" :style="style" />

  <!-- Gemini -->
  <SvgIcon name="agent-avatar-03" v-else-if="isMatch('gemini')" :style="style" />

  <!-- OpenCode / generic code -->
  <SvgIcon name="agent-avatar-04" v-else-if="isMatch('opencode', 'code', 'coder')" :style="style" />

  <!-- Default fallback -->
  <SvgIcon name="agent-avatar-05" v-else :style="style" />
</template>
