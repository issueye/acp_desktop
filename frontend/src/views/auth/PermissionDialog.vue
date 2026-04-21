<script setup>

import { useI18n } from '../../lib/i18n';
import AppDialogShell from '../../components/AppDialogShell.vue';
import UEDButton from '../../components/common/UEDButton.vue';
import UEDCard from '../../components/common/UEDCard.vue';
import UEDStatus from '../../components/common/UEDStatus.vue';

defineProps({
    request: { type: Object, required: true },
});

const emit = defineEmits(['select', 'cancel']);
const { t } = useI18n();

function handleSelect(optionId) {
  emit('select', optionId);
}

function handleCancel() {
  emit('cancel');
}
</script>

<template>
  <AppDialogShell
    :model-value="true"
    :title="t('permission.required')"
    max-width="760px"
    @close="handleCancel"
  >
    <template #header-extra>
      <span class="icon ued-badge">🔐</span>
    </template>

    <div class="dialog-content">
      <div class="tool-meta">
        <UEDCard muted class="tool-info">
          <span class="tool-label">Tool</span>
          <UEDStatus kind="badge" tone="info" class="tool-kind">{{ request.toolCall.kind }}</UEDStatus>
        </UEDCard>

        <UEDCard class="tool-preview" :padded="false">
          <div class="preview-head">
            <span class="preview-label">Command Preview</span>
          </div>
          <pre class="tool-command">{{ request.toolCall.title }}</pre>
        </UEDCard>
      </div>
      
      <UEDCard v-if="request.toolCall.locations?.length" class="locations">
        <div class="locations-title">Paths</div>
        <div 
          v-for="(loc, index) in request.toolCall.locations" 
          :key="index"
          class="location"
        >
          📁 {{ loc.path }}
        </div>
      </UEDCard>
    </div>

    <template #footer>
      <UEDButton
        v-for="option in request.options" 
        :key="option.optionId"
        type="button"
        size="sm"
        class="perm-btn"
        :variant="option.kind.startsWith('reject') ? 'danger' : 'primary'"
        :title="option.name"
        @click="handleSelect(option.optionId)"
      >
        {{ option.name }}
      </UEDButton>
      <UEDButton type="button" size="sm" variant="secondary" class="perm-btn" @click="handleCancel">
        {{ t('common.cancel') }}
      </UEDButton>
    </template>
  </AppDialogShell>
</template>

<style scoped>
.dialog-content {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.icon {
  font-size: 1rem;
}

.tool-meta {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.tool-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.tool-label {
  font-weight: 600;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ued-text-muted);
}

.tool-preview {
  overflow: hidden;
}

.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.9rem;
  border-bottom: 1px solid var(--ued-border-default);
  background: var(--ued-bg-panel-muted);
}

.preview-label,
.locations-title {
  font-size: 0.76rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ued-text-muted);
}

.tool-command {
  max-height: min(42dvh, 420px);
  margin: 0;
  padding: 0.9rem;
  overflow: auto;
  font-family: var(--ued-font-mono);
  font-size: 0.84rem;
  line-height: 1.55;
  color: var(--ued-text-primary);
  background: var(--ued-bg-panel);
  white-space: pre-wrap;
  word-break: break-word;
}

.locations {
  min-width: 0;
}

.locations-title {
  margin-bottom: 0.45rem;
}

.location {
  font-family: var(--ued-font-mono);
  font-size: 0.78rem;
  padding: 0.18rem 0;
  color: var(--ued-text-primary);
  word-break: break-all;
}

/* 权限弹窗按钮尺寸优化 */
.perm-btn {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.dialog-shell__footer) {
  flex-wrap: wrap;
}

@media (max-width: 720px) {
  :deep(.dialog-shell__footer > *) {
    min-width: 0;
  }
}
</style>
