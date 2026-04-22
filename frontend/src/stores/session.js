// Session store for managing ACP sessions and persistence
import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { trackError, trackEvent } from '../lib/telemetry';
import { AUTHORIZATION_MODES, normalizeAuthorizationMode } from '../lib/authorization';

import { AcpClientBridge, createAcpClient } from '../lib/acp-bridge';
import {
  buildPromptParts,
  buildPromptPayload,
  buildProxyEnv,
  buildWorkspaceId,
  cloneMessages,
  clonePlanEntries,
  normalizeWorkspace,
  normalizeWorkspacePath,
  sanitizeProxyConfig,
} from './session/session-models';
import { createChatMessage } from './session/session-message-parts';
import {
  createBoundRuntime,
  applySessionCapabilities,
  persistSavedSession,
  syncRuntimeSnapshot,
  persistRuntimeSession,
  refreshRuntimeCollections,
  handleSessionUpdate,
} from './session/session-runtime';
import {
  executeSessionActionWithAuth,
  handleSessionLifecycleFailure,
  initializeSessionClient,
} from './session/session-connection';
import {
  collectScannedSessions,
  mergeScannedSessions,
} from './session/session-scanner';
import {
  getAppVersion,
  killAgent,
  loadStore,
  onAgentStderr,
  saveStore,
  spawnAgent,
} from '../lib/wails';

const STORE_PATH = 'sessions.json';
const PROTOCOL_VERSION = 1;

let appVersion = '0.1.0';

function detectPhase(line) {
  const lower = line.toLowerCase();
  if (lower.includes('download') || lower.includes('fetch') || lower.includes('get ')) {
    return 'downloading';
  }
  if (lower.includes('install') || lower.includes('added') || lower.includes('packages')) {
    return 'installing';
  }
  if (lower.includes('build') || lower.includes('compil')) {
    return 'building';
  }
  if (lower.includes('start') || lower.includes('spawn')) {
    return 'starting';
  }
  return null;
}

export const useSessionStore = defineStore('session', () => {
  const savedSessions = ref([]);
  const scannedSessions = ref([]);
  const isScanningSessions = ref(false);
  const scanSessionError = ref('');
  const workspaces = ref([]);
  const connectedSessions = ref({});
  const activeSessionId = ref('');
  const isConnected = computed(() => Object.keys(connectedSessions.value).length > 0);
  const isConnecting = ref(false);
  const error = ref(null);
  const pendingPermission = ref(null);
  const pendingPermissionSessionId = ref(null);
  const authorizationMode = ref(AUTHORIZATION_MODES.MANUAL);

  const pendingAuthMethods = ref([]);
  const pendingAuthAgentName = ref('');
  let authMethodResolver = null;

  const availableCommands = computed(() => {
    const active = connectedSessions.value[activeSessionId.value];
    return active?.availableCommands ?? [];
  });
  const currentPlanEntries = computed(() => {
    const active = connectedSessions.value[activeSessionId.value];
    return active?.currentPlanEntries ?? [];
  });

  const availableModes = computed(() => {
    const active = connectedSessions.value[activeSessionId.value];
    return active?.availableModes ?? [];
  });

  const currentModeId = computed(() => {
    const active = connectedSessions.value[activeSessionId.value];
    return active?.currentModeId ?? '';
  });

  const availableModels = computed(() => {
    const active = connectedSessions.value[activeSessionId.value];
    return active?.availableModels ?? [];
  });

  const currentModelId = computed(() => {
    const active = connectedSessions.value[activeSessionId.value];
    return active?.currentModelId ?? '';
  });

  let connectionAborted = false;

  const startupPhase = ref('starting');
  const startupLogs = ref([]);
  const startupElapsed = ref(0);
  let startupTimer = null;
  let stderrUnlisten = null;

  let storeData = {};

  const currentSession = computed(
    () => connectedSessions.value[activeSessionId.value]?.session ?? null
  );
  const isLoading = computed(() => {
    const active = connectedSessions.value[activeSessionId.value];
    return isConnecting.value || active?.isLoading === true;
  });
  const hasActiveSession = computed(() => currentSession.value !== null);
  const messageList = computed(
    () => connectedSessions.value[activeSessionId.value]?.messages ?? []
  );
  const toolCallList = computed(() => {
    const active = connectedSessions.value[activeSessionId.value];
    return active ? Array.from(active.toolCalls.values()) : [];
  });
  const resumableSessions = computed(() =>
    savedSessions.value.filter((session) => session.supportsLoadSession === true)
  );
  const visibleSessions = computed(() => [...resumableSessions.value, ...scannedSessions.value]);
  const connectedSessionIds = computed(() => Object.keys(connectedSessions.value));
  const loadingSessionIds = computed(() =>
    Object.entries(connectedSessions.value)
      .filter(([, runtime]) => runtime?.isLoading === true)
      .map(([sessionId]) => sessionId)
  );
  const workspacesWithCounts = computed(() => {
    const counts = new Map();
    visibleSessions.value.forEach((session) => {
      counts.set(session.workspaceId, (counts.get(session.workspaceId) || 0) + 1);
    });
    return workspaces.value
      .map((workspace) => ({
        ...workspace,
        sessionCount: counts.get(workspace.id) || 0,
      }))
      .sort((a, b) =>
        String(a.name || a.cwd || '').localeCompare(String(b.name || b.cwd || ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      );
  });

  async function initStore() {
    storeData = await loadStore(STORE_PATH);
    const savedWorkspaces = Array.isArray(storeData.workspaces) ? storeData.workspaces : [];
    workspaces.value = savedWorkspaces.map((workspace) => normalizeWorkspace(workspace));

    const saved = Array.isArray(storeData.sessions) ? storeData.sessions : undefined;
    if (saved) {
      savedSessions.value = saved.map((session) => ({
        ...session,
        workspaceId: session.workspaceId || buildWorkspaceId(session.cwd),
        proxy: sanitizeProxyConfig(session.proxy),
        messages: cloneMessages(session.messages),
        currentPlanEntries: clonePlanEntries(session.currentPlanEntries),
      }));
    }

    savedSessions.value.forEach((session) => {
      ensureWorkspaceForCwd(session.cwd, false);
    });
    await saveSessionsToStore();

    try {
      appVersion = await getAppVersion();
    } catch (e) {
      console.warn('Failed to get app version:', e);
    }
  }

  async function saveSessionsToStore() {
    storeData.sessions = savedSessions.value;
    storeData.workspaces = workspaces.value;
    await saveStore(STORE_PATH, storeData);
  }

  function ensureWorkspaceForCwd(cwd, touch = true) {
    const normalizedCwd = normalizeWorkspacePath(cwd);
    const workspaceId = buildWorkspaceId(normalizedCwd);
    const existing = workspaces.value.find((workspace) => workspace.id === workspaceId);
    if (existing) {
      if (touch) {
        existing.lastUpdated = Date.now();
        workspaces.value = [...workspaces.value];
      }
      return existing;
    }

    const workspace = normalizeWorkspace({
      id: workspaceId,
      cwd: normalizedCwd,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    });
    workspaces.value = [...workspaces.value, workspace];
    return workspace;
  }

  async function addWorkspace(cwd) {
    const workspace = ensureWorkspaceForCwd(cwd, true);
    await saveSessionsToStore();
    return workspace;
  }

  async function deleteWorkspace(workspaceId) {
    for (const session of savedSessions.value.filter((s) => s.workspaceId === workspaceId)) {
      if (connectedSessions.value[session.id]) {
        await disconnect(session.id);
      }
    }
    savedSessions.value = savedSessions.value.filter((session) => session.workspaceId !== workspaceId);
    scannedSessions.value = scannedSessions.value.filter((session) => session.workspaceId !== workspaceId);
    workspaces.value = workspaces.value.filter((workspace) => workspace.id !== workspaceId);
    await saveSessionsToStore();
  }

  function getConnectedSession(sessionId) {
    return connectedSessions.value[sessionId] ?? null;
  }

  async function runSessionScan(agentNames = [], options = {}) {
    isScanningSessions.value = true;
    scanSessionError.value = '';

    try {
      return await collectScannedSessions(agentNames, {
        ensureWorkspaceForCwd,
        ...options,
      });
    } finally {
      isScanningSessions.value = false;
    }
  }

  async function scanConfiguredAgentSessions(agentNames = []) {
    const { names, nextSessions, errors } = await runSessionScan(agentNames);

    if (names.length === 0) {
      scannedSessions.value = [];
      return [];
    }

    scannedSessions.value = mergeScannedSessions(
      scannedSessions.value,
      names,
      nextSessions
    );
    if (nextSessions.length > 0) {
      workspaces.value = [...workspaces.value];
    }
    scanSessionError.value = errors.join('\n');
    return nextSessions;
  }

  async function scanWorkspaceAgentSessions(agentNames = [], workspace) {
    const { names, nextSessions, errors, targetWorkspace } = await runSessionScan(agentNames, {
      workspace,
    });

    if (names.length === 0 || !targetWorkspace?.id) {
      return [];
    }

    scannedSessions.value = mergeScannedSessions(
      scannedSessions.value,
      names,
      nextSessions,
      targetWorkspace
    );
    scanSessionError.value = errors.join('\n');
    return nextSessions;
  }

  function getConnectedSessionByAcpSessionId(sessionId) {
    return (
      Object.values(connectedSessions.value).find(
        (connectedSession) => connectedSession.session.sessionId === sessionId
      ) ?? null
    );
  }

  function setActiveSession(sessionId) {
    if (!connectedSessions.value[sessionId]) {
      return;
    }
    activeSessionId.value = sessionId;
  }

  function applyAuthorizationModeToClient(client) {
    if (client && typeof client.setAuthorizationMode === 'function') {
      client.setAuthorizationMode(authorizationMode.value);
    }
  }

  function setAuthorizationMode(mode) {
    authorizationMode.value = normalizeAuthorizationMode(mode);
    Object.values(connectedSessions.value).forEach((runtime) => {
      applyAuthorizationModeToClient(runtime?.client);
    });
  }

  function upsertConnectedSession(runtime) {
    connectedSessions.value = {
      ...connectedSessions.value,
      [runtime.session.id]: runtime,
    };
    setActiveSession(runtime.session.id);
  }

  function notifyConnectedSessionChanged(runtime) {
    if (!connectedSessions.value[runtime.session.id]) {
      return;
    }

    connectedSessions.value = {
      ...connectedSessions.value,
      [runtime.session.id]: runtime,
    };
  }

  function clearRuntimePermissionState(sessionId) {
    if (pendingPermissionSessionId.value === sessionId) {
      pendingPermission.value = null;
      pendingPermissionSessionId.value = null;
    }
  }

  function getRuntimeForPendingPermission() {
    if (pendingPermissionSessionId.value) {
      const localRuntime = getConnectedSession(pendingPermissionSessionId.value);
      if (localRuntime) {
        return localRuntime;
      }
    }

    const acpSessionId = pendingPermission.value?.sessionId;
    if (!acpSessionId) {
      return null;
    }

    return getConnectedSessionByAcpSessionId(acpSessionId);
  }

  function attachPermissionWatcher(runtime) {
    runtime.stopPermissionWatch = watch(
      () => runtime.client.pendingPermissionRequest.value,
      (newValue) => {
        if (newValue) {
          pendingPermission.value = newValue ?? null;
          pendingPermissionSessionId.value = runtime.session.id;
          setActiveSession(runtime.session.id);
          return;
        }

        if (pendingPermissionSessionId.value === runtime.session.id) {
          pendingPermission.value = null;
          pendingPermissionSessionId.value = null;
        }
      },
      { immediate: true }
    );
  }

  function removeConnectedSession(sessionId) {
    const runtime = connectedSessions.value[sessionId];
    if (runtime?.stopPermissionWatch) {
      runtime.stopPermissionWatch();
      runtime.stopPermissionWatch = undefined;
    }

    clearRuntimePermissionState(sessionId);

    const next = { ...connectedSessions.value };
    delete next[sessionId];
    connectedSessions.value = next;

    if (activeSessionId.value === sessionId) {
      activeSessionId.value = Object.keys(next)[0] ?? '';
    }
  }

  async function promptForAuthMethod(authMethods, agentName) {
    return new Promise((resolve) => {
      pendingAuthMethods.value = authMethods;
      pendingAuthAgentName.value = agentName;
      authMethodResolver = resolve;
    });
  }

  function selectAuthMethod(methodId) {
    if (!authMethodResolver) {
      return;
    }
    authMethodResolver(methodId);
    authMethodResolver = null;
    pendingAuthMethods.value = [];
    pendingAuthAgentName.value = '';
  }

  function cancelAuthSelection() {
    if (!authMethodResolver) {
      return;
    }
    authMethodResolver(null);
    authMethodResolver = null;
    pendingAuthMethods.value = [];
    pendingAuthAgentName.value = '';
  }

  async function createSession(agentName, cwd, proxy) {
    isConnecting.value = true;
    connectionAborted = false;
    error.value = null;

    startupPhase.value = 'starting';
    startupLogs.value = [];
    startupElapsed.value = 0;
    startupTimer = setInterval(() => {
      startupElapsed.value++;
    }, 1000);

    let client = null;
    let runtime = null;

    try {
      const sanitizedProxy = sanitizeProxyConfig(proxy);
      const workspace = ensureWorkspaceForCwd(cwd, true);
      const agentInstance = await spawnAgent(agentName, buildProxyEnv(sanitizedProxy));

      stderrUnlisten = (await onAgentStderr((stderr) => {
        if (stderr.agent_id !== agentInstance.id) {
          return;
        }
        startupLogs.value.push(stderr.line);
        const detectedPhase = detectPhase(stderr.line);
        if (detectedPhase) {
          startupPhase.value = detectedPhase;
        }
      }));

      if (connectionAborted) {
        await killAgent(agentInstance.id);
        throw new Error('Connection cancelled');
      }

      startupPhase.value = 'initializing';

      client = await createAcpClient(agentInstance);
      applyAuthorizationModeToClient(client);

      if (connectionAborted) {
        await client.disconnect();
        throw new Error('Connection cancelled');
      }

      startupPhase.value = 'connecting';

      const initResponse = await initializeSessionClient(client, appVersion, PROTOCOL_VERSION);

      const supportsLoadSession = initResponse.agentCapabilities?.loadSession ?? false;
      const availableAuthMethods = initResponse.authMethods || [];

      if (connectionAborted) {
        await client.disconnect();
        throw new Error('Connection cancelled');
      }

      const sessionResponse = await executeSessionActionWithAuth({
        client,
        availableAuthMethods,
        agentName,
        promptForAuthMethod: async (authMethods, nextAgentName) => {
          const selectedMethodId = await promptForAuthMethod(authMethods, nextAgentName);

          if (!selectedMethodId || connectionAborted) {
            await client.disconnect();
            throw new Error(
              connectionAborted ? 'Connection cancelled' : 'Authentication cancelled by user'
            );
          }

          return selectedMethodId;
        },
        execute: () =>
          client.newSession({
            cwd,
            mcpServers: [],
          }),
      });

      const session = {
        id: crypto.randomUUID(),
        agentName,
        sessionId: sessionResponse.sessionId,
        title: `Session ${new Date().toLocaleString()}`,
        lastUpdated: Date.now(),
        cwd,
        workspaceId: workspace.id,
        supportsLoadSession,
        proxy: sanitizedProxy,
        messages: [],
      };

      runtime = createBoundRuntime(session, client, {
        handleSessionUpdate,
        notifyConnectedSessionChanged,
        attachPermissionWatcher,
        upsertConnectedSession,
      });
      applySessionCapabilities(runtime, sessionResponse, notifyConnectedSessionChanged);
      syncRuntimeSnapshot(runtime);

      await persistSavedSession(savedSessions.value, session, saveSessionsToStore);

      trackEvent('SessionCreated', { agentName, success: 'true' });
    } catch (e) {
      await handleSessionLifecycleFailure({
        error: e,
        runtime,
        client,
        removeConnectedSession,
        setError: (message) => {
          error.value = message;
        },
        trackEvent,
        trackError,
        eventName: 'SessionCreated',
        eventProperties: { agentName },
      });
    } finally {
      isConnecting.value = false;
      if (startupTimer) {
        clearInterval(startupTimer);
        startupTimer = null;
      }
      if (stderrUnlisten) {
        stderrUnlisten();
        stderrUnlisten = null;
      }
    }
  }

  async function resumeSession(savedSession) {
    const existing = getConnectedSession(savedSession.id);
    if (existing) {
      await persistRuntimeSession(existing, saveSessionsToStore);
      setActiveSession(savedSession.id);
      return;
    }

    error.value = null;

    let client = null;
    let runtime = null;

    try {
      const agentInstance = await spawnAgent(
        savedSession.agentName,
        buildProxyEnv(savedSession.proxy)
      );

      client = await createAcpClient(agentInstance);
      applyAuthorizationModeToClient(client);

      runtime = createBoundRuntime(savedSession, client, {
        handleSessionUpdate,
        notifyConnectedSessionChanged,
        attachPermissionWatcher,
        upsertConnectedSession,
      });

      const initResponse = await initializeSessionClient(client, appVersion, PROTOCOL_VERSION);

      const availableAuthMethods = initResponse.authMethods || [];

      const loadResponse = await executeSessionActionWithAuth({
        client,
        availableAuthMethods,
        agentName: savedSession.agentName,
        promptForAuthMethod: async (authMethods, agentName) => {
          const selectedMethodId = await promptForAuthMethod(authMethods, agentName);
          if (!selectedMethodId) {
            await client.disconnect();
            throw new Error('Authentication cancelled by user');
          }
          return selectedMethodId;
        },
        execute: () =>
          client.loadSession({
            sessionId: savedSession.sessionId,
            cwd: savedSession.cwd,
            mcpServers: [],
          }),
      });

      applySessionCapabilities(runtime, loadResponse, notifyConnectedSessionChanged);
      if (runtime.messages.length === 0 && savedSession.messages?.length) {
        runtime.messages = cloneMessages(savedSession.messages);
      }
      ensureWorkspaceForCwd(savedSession.cwd, true);
      await persistRuntimeSession(runtime, saveSessionsToStore);

      trackEvent('SessionResumed', {
        agentName: savedSession.agentName,
        success: 'true',
      });
    } catch (e) {
      await handleSessionLifecycleFailure({
        error: e,
        runtime,
        client,
        removeConnectedSession,
        setError: (message) => {
          error.value = message;
        },
        trackEvent,
        trackError,
        eventName: 'SessionResumed',
        eventProperties: { agentName: savedSession.agentName },
      });
    } finally {
    }
  }

  async function sendPrompt(text) {
    const runtime = getConnectedSession(activeSessionId.value);
    if (!runtime) {
      throw new Error('No active session');
    }

    const normalizedText = typeof text === 'string' ? text.trim() : '';
    if (!normalizedText) {
      return;
    }

    error.value = null;

    runtime.messages.push({
      ...createChatMessage('user'),
      content: normalizedText,
      timestamp: Date.now(),
      parts: buildPromptParts(normalizedText),
    });
    refreshRuntimeCollections(runtime);

    runtime.isLoading = true;
    notifyConnectedSessionChanged(runtime);
    try {
      const response = await runtime.client.prompt({
        sessionId: runtime.session.sessionId,
        prompt: buildPromptPayload(normalizedText),
      });

      trackEvent('PromptSent', {
        messageLength: String(normalizedText.length),
        stopReason: response.stopReason || 'unknown',
      });

      if (runtime.messages.length === 2) {
        const titleSource = normalizedText || 'Chat';
        runtime.session.title = titleSource.slice(0, 50) + (titleSource.length > 50 ? '...' : '');
      }

      await persistRuntimeSession(runtime, saveSessionsToStore);
    } catch (e) {
      const nextError = e instanceof Error ? e.message : String(e);
      error.value = nextError;
      trackError(e instanceof Error ? e : new Error(nextError));
      throw e;
    } finally {
      runtime.isLoading = false;
      notifyConnectedSessionChanged(runtime);
    }
  }

  async function cancelOperation() {
    const runtime = getConnectedSession(activeSessionId.value);
    if (!runtime) {
      return;
    }

    await runtime.client.cancel({
      sessionId: runtime.session.sessionId,
    });
  }

  async function cancelConnection() {
    connectionAborted = true;

    if (authMethodResolver) {
      authMethodResolver(null);
      authMethodResolver = null;
      pendingAuthMethods.value = [];
      pendingAuthAgentName.value = '';
    }

    isConnecting.value = false;
    error.value = null;
  }

  function resolvePermission(optionId) {
    const runtime = getRuntimeForPendingPermission();
    if (!runtime) {
      return;
    }
    runtime.client.resolvePermission(optionId);
    pendingPermission.value = null;
    pendingPermissionSessionId.value = null;
  }

  function cancelPermission() {
    const runtime = getRuntimeForPendingPermission();
    if (!runtime) {
      return;
    }
    runtime.client.cancelPermission();
    pendingPermission.value = null;
    pendingPermissionSessionId.value = null;
  }

  async function disconnect(sessionId = activeSessionId.value) {
    const runtime = getConnectedSession(sessionId);
    if (!runtime) {
      return;
    }

    const sessionStart = runtime.session.lastUpdated || Date.now();
    const sessionDuration = Math.round((Date.now() - sessionStart) / 1000);

    await persistRuntimeSession(runtime, saveSessionsToStore);
    await runtime.client.disconnect();
    removeConnectedSession(sessionId);

    trackEvent('SessionDisconnected', {
      agentName: runtime.session.agentName,
      sessionDurationSeconds: String(sessionDuration),
      messageCount: String(runtime.messages.length),
    });
  }

  async function refreshCurrentSession() {
    const sessionId = activeSessionId.value;
    if (!sessionId) {
      throw new Error('No active session');
    }

    await disconnect(sessionId);

    const savedSession = savedSessions.value.find((session) => session.id === sessionId);
    if (!savedSession) {
      throw new Error('Session snapshot not found');
    }

    await resumeSession(savedSession);
  }

  async function deleteSession(sessionId) {
    if (getConnectedSession(sessionId)) {
      await disconnect(sessionId);
    }
    savedSessions.value = savedSessions.value.filter((session) => session.id !== sessionId);
    await saveSessionsToStore();
  }

  async function setMode(modeId) {
    const runtime = getConnectedSession(activeSessionId.value);
    if (!runtime) {
      throw new Error('No active session');
    }

    await runtime.client.setMode({
      sessionId: runtime.session.sessionId,
      modeId,
    });
    runtime.currentModeId = modeId;
    notifyConnectedSessionChanged(runtime);
  }

  async function setModel(modelId) {
    const runtime = getConnectedSession(activeSessionId.value);
    if (!runtime) {
      throw new Error('No active session');
    }

    await runtime.client.unstable_setSessionModel({
      sessionId: runtime.session.sessionId,
      modelId,
    });
    runtime.currentModelId = modelId;
    notifyConnectedSessionChanged(runtime);
  }

  function clearError() {
    error.value = null;
  }

  return {
    savedSessions,
    scannedSessions,
    workspaces,
    workspacesWithCounts,
    connectedSessionIds,
    loadingSessionIds,
    currentSession,
    messages: messageList,
    isConnected,
    isLoading,
    isConnecting,
    error,
    pendingPermission,
    authorizationMode,
    pendingAuthMethods,
    pendingAuthAgentName,
    availableModes,
    currentModeId,
    availableCommands,
    availableModels,
    currentModelId,
    currentPlanEntries,
    startupPhase,
    startupLogs,
    startupElapsed,
    hasActiveSession,
    messageList,
    toolCallList,
    resumableSessions,
    visibleSessions,
    isScanningSessions,
    scanSessionError,
    initStore,
    scanConfiguredAgentSessions,
    scanWorkspaceAgentSessions,
    addWorkspace,
    deleteWorkspace,
    ensureWorkspaceForCwd,
    createSession,
    resumeSession,
    sendPrompt,
    cancelOperation,
    cancelConnection,
    setAuthorizationMode,
    resolvePermission,
    cancelPermission,
    selectAuthMethod,
    cancelAuthSelection,
    disconnect,
    refreshCurrentSession,
    deleteSession,
    setMode,
    setModel,
    clearError,
    setActiveSession,
    get acpClient() {
      return connectedSessions.value[activeSessionId.value]?.client ?? null;
    },
  };
});
