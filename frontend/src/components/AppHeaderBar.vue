<script setup>
import { useI18n } from '../lib/i18n';
import brandMark from '../../../assets/logo.png';

defineProps({
    locale: { type: String, required: true },
    currentSessionTitle: { type: String, required: true },
    activeStatusLabel: { type: String, required: true },
    cwdLabel: { type: String },
    trafficMonitorOpen: { type: Boolean, required: true },
    processManagerOpen: { type: Boolean, required: true },
    isLive: { type: Boolean, required: true },
});

const emit = defineEmits(['toggleTraffic', 'toggleProcessManager', 'toggleLocale', 'openSettings', 'minimise', 'close', 'headerDblclick']);

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
      <!-- <span class="status-dot" :class="{ live: isLive }"></span>
      <div class="status-copy">
        <strong>{{ currentSessionTitle }}</strong>
        <span>
          {{ activeStatusLabel }}
          <template v-if="cwdLabel">
            · {{ cwdLabel }}
          </template>
        </span>
      </div> -->
    </div>

    <div class="window-actions no-drag">
      <button
        class="header-icon-button ued-icon-btn"
        :class="{ 'ued-icon-btn--active': trafficMonitorOpen }"
        :title="t('app.trafficMonitor')"
        :aria-label="t('app.trafficMonitor')"
        @click="emit('toggleTraffic')"
      >
        <svg class="header-action-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4.75 13.25C6.75 10.25 8.75 10.25 10.75 13.25C12.75 16.25 14.75 16.25 16.75 13.25C17.55 12.05 18.35 11.3 19.25 11"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        class="header-icon-button ued-icon-btn"
        :class="{ 'ued-icon-btn--active': processManagerOpen }"
        :title="t('app.processManager')"
        :aria-label="t('app.processManager')"
        @click="emit('toggleProcessManager')"
      >
        <svg class="header-action-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4.75" y="6" width="14.5" height="5.25" rx="1.2" stroke="currentColor" stroke-width="1.6" />
          <rect x="4.75" y="12.75" width="14.5" height="5.25" rx="1.2" stroke="currentColor" stroke-width="1.6" />
          <path d="M8 8.6H10.5M8 15.35H12.25" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </button>
      <button
        class="header-icon-button ued-icon-btn"
        :title="`${t('app.language')}: ${locale === 'zh-CN' ? t('app.langLabelZh') : t('app.langLabelEn')}`"
        :aria-label="t('app.language')"
        @click="emit('toggleLocale')"
      >
        <svg class="header-action-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="7.25" stroke="currentColor" stroke-width="1.7" />
          <path
            d="M4.75 12H19.25M12 4.75C14 6.7 15.05 9.12 15.05 12C15.05 14.88 14 17.3 12 19.25C10 17.3 8.95 14.88 8.95 12C8.95 9.12 10 6.7 12 4.75Z"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        class="header-icon-button ued-icon-btn"
        :title="t('app.settings')"
        :aria-label="t('app.settings')"
        @click="emit('openSettings')"
      >
        <svg class="header-action-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M10.1 5.25L10.55 3.9H13.45L13.9 5.25C14.08 5.8 14.67 6.1 15.22 5.9L16.55 5.42L18 7.92L16.92 8.8C16.47 9.17 16.47 9.83 16.92 10.2L18 11.08L16.55 13.58L15.22 13.1C14.67 12.9 14.08 13.2 13.9 13.75L13.45 15.1H10.55L10.1 13.75C9.92 13.2 9.33 12.9 8.78 13.1L7.45 13.58L6 11.08L7.08 10.2C7.53 9.83 7.53 9.17 7.08 8.8L6 7.92L7.45 5.42L8.78 5.9C9.33 6.1 9.92 5.8 10.1 5.25Z"
            stroke="currentColor"
            stroke-width="1.55"
            stroke-linecap="round"
            stroke-linejoin="round"
            transform="translate(0 2.5)"
          />
          <circle cx="12" cy="12" r="2.15" stroke="currentColor" stroke-width="1.55" />
        </svg>
      </button>
      <button
        class="header-icon-button ued-icon-btn"
        :title="t('app.minimise')"
        :aria-label="t('app.minimise')"
        @click="emit('minimise')"
      >
        <svg class="header-action-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M7 15.5H17"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        </svg>
      </button>
      <button
        class="header-icon-button ued-icon-btn ued-icon-btn--danger close-button"
        :title="t('app.close')"
        :aria-label="t('app.close')"
        @click="emit('close')"
      >
        <svg class="header-action-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M8 8L16 16M16 8L8 16"
            stroke="currentColor"
            stroke-width="1.85"
            stroke-linecap="round"
          />
        </svg>
      </button>
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
  padding: 0.3rem 0.4rem;
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

.header-icon-button {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
}

.header-icon-button:hover {
  transform: translateY(-1px);
}

.header-action-icon {
  width: 16px;
  height: 16px;
  display: block;
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
