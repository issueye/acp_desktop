<script setup lang="ts">
import { useI18n } from '../lib/i18n';

defineProps<{
  showSidebar: boolean;
  locale: string;
  currentSessionTitle: string;
  activeStatusLabel: string;
  cwdLabel?: string;
  trafficMonitorOpen: boolean;
  isLive: boolean;
}>();

const emit = defineEmits<{
  toggleSidebar: [];
  toggleTraffic: [];
  toggleLocale: [];
  openSettings: [];
  minimise: [];
  close: [];
  headerDblclick: [];
}>();

const { t } = useI18n();
</script>

<template>
  <header class="window-header drag-region" @dblclick="emit('headerDblclick')">
    <div class="window-brand">
      <button
        class="icon-button no-drag"
        :title="showSidebar ? t('app.collapseSidebar') : t('app.expandSidebar')"
        @click="emit('toggleSidebar')"
      >
        {{ showSidebar ? '◀' : '▶' }}
      </button>
      <div class="brand-mark" aria-hidden="true"></div>
      <div class="brand-copy">
        <strong>ACP UI</strong>
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
        class="icon-button"
        :class="{ active: trafficMonitorOpen }"
        :title="t('app.trafficMonitor')"
        @click="emit('toggleTraffic')"
      >
        ~
      </button>
      <button class="header-chip" :title="t('app.language')" @click="emit('toggleLocale')">
        {{ locale === 'zh-CN' ? t('app.langLabelZh') : t('app.langLabelEn') }}
      </button>
      <button class="icon-button" :title="t('app.settings')" @click="emit('openSettings')">⚙</button>
      <button class="icon-button" :title="t('app.minimise')" @click="emit('minimise')">_</button>
      <button class="icon-button close-button" :title="t('app.close')" @click="emit('close')">×</button>
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
  color: var(--text-primary);
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
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
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff, #eef4ff);
  border: 1px solid rgba(37, 99, 235, 0.12);
  position: relative;
}

.brand-mark::before {
  content: '';
  position: absolute;
  inset: 8px;
  border-radius: 50%;
  background: var(--text-accent);
  opacity: 0.9;
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
  color: var(--text-muted);
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
  background: #cbd5e1;
  flex-shrink: 0;
}

.status-dot.live {
  background: var(--text-accent);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
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
  color: var(--text-primary);
}

.status-copy span {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.window-actions {
  gap: 0.4rem;
}

.header-chip,
.icon-button {
  height: 28px;
  border-radius: 8px;
  background: #fffdfa;
  color: var(--text-secondary);
  border: 1px solid rgba(15, 23, 42, 0.06);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.header-chip {
  min-width: 46px;
  padding: 0 0.65rem;
  font-size: 0.74rem;
  font-weight: 700;
}

.icon-button {
  width: 30px;
  display: grid;
  place-items: center;
  font-size: 0.88rem;
}

.header-chip:hover,
.icon-button:hover {
  background: #ffffff;
  color: var(--text-primary);
  border-color: rgba(15, 23, 42, 0.1);
}

.icon-button.active {
  background: rgba(37, 99, 235, 0.08);
  color: var(--text-accent);
  border-color: rgba(37, 99, 235, 0.14);
}

.close-button:hover {
  background: rgba(220, 38, 38, 0.08);
  border-color: rgba(220, 38, 38, 0.16);
  color: var(--bg-danger);
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
