// Traffic store for ACP message monitoring
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { diagnoseError } from '../lib/diagnostics';

const MAX_ENTRIES = 500;
const SLOW_REQUEST_MS = 3000;

export const useTrafficStore = defineStore('traffic', () => {
  const entries = ref([]);
  const isPaused = ref(false);
  const filter = ref('all');
  const searchQuery = ref('');
  const pendingRequests = new Map();

  const filteredEntries = computed(() => {
    let result = entries.value;
    
    // Apply type filter
    switch (filter.value) {
      case 'requests':
        result = result.filter(e => e.type === 'request');
        break;
      case 'responses':
        result = result.filter(e => e.type === 'response');
        break;
      case 'notifications':
        result = result.filter(e => e.type === 'notification');
        break;
    }
    
    // Apply search filter
    const query = searchQuery.value.trim().toLowerCase();
    if (query) {
      result = result.filter(e => 
        e.method.toLowerCase().includes(query) ||
        JSON.stringify(e.payload).toLowerCase().includes(query)
      );
    }
    
    return result;
  });

  function enrichEntry(entry) {
    const now = Date.now();
    if (entry.type === 'request' && entry.requestId !== undefined) {
      const startedAt = entry.startedAt || now;
      pendingRequests.set(entry.requestId, {
        method: entry.method,
        startedAt,
      });
      return {
        ...entry,
        startedAt,
      };
    }

    if (entry.type === 'response' && entry.requestId !== undefined) {
      const pending = pendingRequests.get(entry.requestId);
      if (pending) {
        pendingRequests.delete(entry.requestId);
      }
      const completedAt = entry.completedAt || now;
      const durationMs = pending ? Math.max(0, completedAt - pending.startedAt) : undefined;
      return {
        ...entry,
        completedAt,
        durationMs,
        isSlow: Number.isFinite(durationMs) ? durationMs >= SLOW_REQUEST_MS : false,
        diagnostic: entry.diagnostic || (entry.error ? diagnoseError(entry.payload || entry) : ''),
      };
    }

    if (entry.error && !entry.diagnostic) {
      return {
        ...entry,
        diagnostic: diagnoseError(entry.payload || entry),
      };
    }

    return entry;
  }

  function addEntry(entry) {
    if (isPaused.value) return;
    
    const newEntry = {
      ...enrichEntry(entry),
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    
    entries.value.push(newEntry);
    
    // Limit entries to prevent memory issues
    if (entries.value.length > MAX_ENTRIES) {
      entries.value = entries.value.slice(-MAX_ENTRIES);
    }
  }

  function clear() {
    entries.value = [];
    pendingRequests.clear();
  }

  function togglePause() {
    isPaused.value = !isPaused.value;
  }

  function setFilter(newFilter) {
    filter.value = newFilter;
  }

  function setSearch(query) {
    searchQuery.value = query;
  }

  function clearSearch() {
    searchQuery.value = '';
  }

  return {
    entries,
    filteredEntries,
    isPaused,
    filter,
    searchQuery,
    addEntry,
    clear,
    togglePause,
    setFilter,
    setSearch,
    clearSearch,
  };
});
