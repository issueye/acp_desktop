<script setup>
import SvgIcon from './common/SvgIcon.vue';
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
        <SvgIcon name="app-sidebar-01" />
      </button>
      <button
        class="menu-rail-button"
        :class="{ active: activeRoute === 'agents' }"
        :title="t('settings.agents')"
        :aria-label="t('settings.agents')"
        type="button"
        @click="emit('navigateRoute', 'agents')"
      >
        <SvgIcon name="app-sidebar-02" />
      </button>
      <button
        class="menu-rail-button"
        :class="{ active: activeRoute === 'workspaces' }"
        :title="t('workspace.title')"
        :aria-label="t('workspace.title')"
        type="button"
        @click="emit('navigateRoute', 'workspaces')"
      >
        <SvgIcon name="app-sidebar-03" />
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
      <SvgIcon name="app-sidebar-04" />
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

.menu-rail-button .svg-icon {
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
