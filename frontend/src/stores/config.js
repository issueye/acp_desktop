// Agent configuration store with hot-reload support
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getConfig, reloadConfig, getConfigPath, onConfigChanged } from '../lib/wails';

export const useConfigStore = defineStore('config', () => {
  const config = ref({ agents: {} });
  const configPath = ref('');
  const loading = ref(false);
  const error = ref(null);

  const agentNames = computed(() => Object.keys(config.value.agents));
  
  const hasAgents = computed(() => agentNames.value.length > 0);

  async function loadConfig() {
    loading.value = true;
    error.value = null;
    try {
      config.value = await getConfig();
      configPath.value = await getConfigPath();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  async function reload() {
    loading.value = true;
    error.value = null;
    try {
      config.value = await reloadConfig();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  function getAgent(name) {
    return config.value.agents[name];
  }

  // Set up hot-reload listener
  async function setupHotReload() {
    await onConfigChanged((newConfig) => {
      config.value = newConfig;
      console.log('Config hot-reloaded:', newConfig);
    });
  }

  // Update config from event (for settings updates)
  function updateFromEvent(newConfig) {
    config.value = newConfig;
  }

  function clearError() {
    error.value = null;
  }

  return {
    config,
    configPath,
    loading,
    error,
    agentNames,
    hasAgents,
    loadConfig,
    reload,
    getAgent,
    setupHotReload,
    updateFromEvent,
    clearError,
  };
});
