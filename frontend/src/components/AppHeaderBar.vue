<script setup>
import { useI18n } from '../lib/i18n';
import UEDButton from './common/UEDButton.vue';
import brandMark from '../assets/acp-desktop-mark.svg';

defineProps({
    locale: { type: String, required: true },
    currentSessionTitle: { type: String, required: true },
    activeStatusLabel: { type: String, required: true },
    cwdLabel: { type: String },
    trafficMonitorOpen: { type: Boolean, required: true },
    isLive: { type: Boolean, required: true },
});

const emit = defineEmits(['toggleTraffic', 'toggleLocale', 'openSettings', 'minimise', 'close', 'headerDblclick']);

const { t } = useI18n();
</script>

<template>
  <header class="window-header drag-region" @dblclick="emit('headerDblclick')">
    <div class="window-brand">
      <div class="brand-mark" aria-hidden="true">
        <img class="brand-mark__image" :src="brandMark" alt="" />
      </div>
      <div class="brand-copy">
        <strong>ACP DESKTOP</strong>
      </div>
    </div>

    <div class="window-status">
      <span class="status-dot" :class="{ live: isLive }"></span>
      <div class="status-copy">
        <strong>{{ currentSessionTitle }}</strong>
        <span>
          {{ activeStatusLabel }}
          <template v-if="cwdLabel">
            · {{ cwdLabel }}
          </template>
        </span>
      </div>
    </div>

    <div class="window-actions no-drag">
      <button
        class="header-icon-button ued-icon-btn"
        :class="{ 'ued-icon-btn--active': trafficMonitorOpen }"
        :title="t('app.trafficMonitor')"
        @click="emit('toggleTraffic')"
      >
        ~
      </button>
      <UEDButton class="header-chip" variant="secondary" size="sm" :title="t('app.language')" @click="emit('toggleLocale')">
        {{ locale === 'zh-CN' ? t('app.langLabelZh') : t('app.langLabelEn') }}
      </UEDButton>
      <button class="header-icon-button ued-icon-btn" :title="t('app.settings')" @click="emit('openSettings')">⚙</button>
      <button class="header-icon-button ued-icon-btn" :title="t('app.minimise')" @click="emit('minimise')">_</button>
      <button class="header-icon-button ued-icon-btn ued-icon-btn--danger close-button" :title="t('app.close')" @click="emit('close')">×</button>
    </div>
  </header>
</template>

<style scoped>
.window-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
  min-height: 46px;
  padding: 0.38rem 0.72rem;
  background: var(--bg-header);
  color: var(--ued-text-primary);
  border-bottom: 1px solid var(--ued-border-default);
}

.window-brand,
.window-actions,
.window-status {
  display: flex;
  align-items: center;
}

.window-brand {
  gap: 0.55rem;
  min-width: 0;
}

.brand-mark {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.brand-mark__image {
  width: 100%;
  height: 100%;
  display: block;
}

.brand-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.brand-copy strong {
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.1;
}

.brand-copy span {
  font-size: 0.62rem;
  color: var(--ued-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  line-height: 1.1;
}

.window-status {
  gap: 0.55rem;
  min-width: 0;
  justify-content: center;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--ued-text-muted);
  flex-shrink: 0;
}

.status-dot.live {
  background: var(--ued-accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--ued-accent) 14%, transparent);
}

.status-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
}

.status-copy strong,
.status-copy span {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-copy strong {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ued-text-primary);
}

.status-copy span {
  font-size: 0.72rem;
  color: var(--ued-text-muted);
}

.window-actions {
  gap: 0.4rem;
}

.header-chip {
  min-width: 46px;
  padding: 0 0.65rem;
  font-size: 0.74rem;
  font-weight: 700;
}

.header-icon-button {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  font-size: 0.88rem;
}

.header-chip:hover,
.header-icon-button:hover {
  transform: translateY(-1px);
}

.close-button:hover {
  color: var(--ued-danger);
}

@media (max-width: 1180px) {
  .window-header {
    grid-template-columns: auto 1fr;
  }

  .window-actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }
}
</style>
