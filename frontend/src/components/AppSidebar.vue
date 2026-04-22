<script setup>
import { useI18n } from '../lib/i18n';

const props = defineProps({
  activeRoute: { type: String, required: true },
});

const emit = defineEmits(['navigateRoute']);
const { t } = useI18n();
</script>

<template>
  <aside class="app-sidebar-rail" :aria-label="t('app.desktopClient')">
    <div class="menu-rail-top">
      <button
        class="menu-rail-button"
        :class="{ active: activeRoute === 'chat' }"
        :title="t('chat.titleFallback')"
        :aria-label="t('chat.titleFallback')"
        type="button"
        @click="emit('navigateRoute', 'chat')"
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M4 5.8A2.3 2.3 0 0 1 6.3 3.5h7.4A2.3 2.3 0 0 1 16 5.8v4.6a2.3 2.3 0 0 1-2.3 2.3H9.2L5.4 15v-2.3A2.3 2.3 0 0 1 4 10.4V5.8Z" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round" />
          <path d="M7.1 7.4h5.8M7.1 9.7h3.8" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" />
        </svg>
      </button>
      <button
        class="menu-rail-button"
        :class="{ active: activeRoute === 'agents' }"
        :title="t('settings.agents')"
        :aria-label="t('settings.agents')"
        type="button"
        @click="emit('navigateRoute', 'agents')"
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M10 10.2a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4Z" stroke="currentColor" stroke-width="1.45" />
          <path d="M4.8 16.1c.7-2.3 2.5-3.6 5.2-3.6s4.5 1.3 5.2 3.6" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" />
          <path d="M15.2 5.4l.8-.8M16 8.1h1.2M15.2 10.8l.8.8" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" />
        </svg>
      </button>
      <button
        class="menu-rail-button"
        :class="{ active: activeRoute === 'workspaces' }"
        :title="t('workspace.title')"
        :aria-label="t('workspace.title')"
        type="button"
        @click="emit('navigateRoute', 'workspaces')"
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3 7.2a1.4 1.4 0 0 1 1.4-1.4h3l1.2 1.4h5a1.4 1.4 0 0 1 1.4 1.4v4.4a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 13V7.2Z" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round" />
          <path d="M7 10.2h6" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <button
      class="menu-rail-button"
      :class="{ active: activeRoute === 'settings' }"
      :title="t('app.settings')"
      :aria-label="t('app.settings')"
      type="button"
      @click="emit('navigateRoute', 'settings')"
    >
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M8.9 3.6h2.2l.4 1.6c.4.1.8.3 1.2.5l1.4-.8 1.6 1.6-.8 1.4c.2.4.4.8.5 1.2l1.6.4v2.2l-1.6.4c-.1.4-.3.8-.5 1.2l.8 1.4-1.6 1.6-1.4-.8c-.4.2-.8.4-1.2.5l-.4 1.6H8.9l-.4-1.6c-.4-.1-.8-.3-1.2-.5l-1.4.8-1.6-1.6.8-1.4c-.2-.4-.4-.8-.5-1.2L3 11.7V9.5l1.6-.4c.1-.4.3-.8.5-1.2l-.8-1.4 1.6-1.6 1.4.8c.4-.2.8-.4 1.2-.5l.4-1.6Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round" />
        <path d="M10 12.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z" stroke="currentColor" stroke-width="1.25" />
      </svg>
    </button>
  </aside>
</template>

<style scoped>
.app-sidebar-rail {
  width: 48px;
  min-width: 48px;
  padding: 0.55rem 0.35rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  border-right: 1px solid var(--ued-border-subtle);
  background: var(--bg-sidebar);
}

.menu-rail-top {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.menu-rail-button {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--ued-text-muted);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.menu-rail-button svg {
  width: 19px;
  height: 19px;
}

.menu-rail-button:hover,
.menu-rail-button.active {
  background: rgba(255, 255, 255, 0.58);
  color: var(--ued-text-primary);
}

.menu-rail-button.active {
  border-color: var(--ued-border-default);
}
</style>
