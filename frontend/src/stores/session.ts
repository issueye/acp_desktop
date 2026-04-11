// Session store for managing ACP sessions and persistence
import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { trackError, trackEvent } from '../lib/telemetry';
import type {
  ChatMessage,
  ModelInfo,
  PermissionRequest,
  SavedSession,
  SessionMode,
  SessionProxyConfig,
  SlashCommand,
  ToolCallInfo,
} from '../lib/types';
import { AcpClientBridge, createAcpClient } from '../lib/acp-bridge';
import {
  getAppVersion,
  killAgent,
  loadStore,
  onAgentStderr,
  saveStore,
  spawnAgent,
} from '../lib/wails';
import type {
  AuthMethod,
  LoadSessionResponse,
  NewSessionResponse,
  SessionNotification,
} from '@agentclientprotocol/sdk';

const STORE_PATH = 'sessions.json';
const PROTOCOL_VERSION = 1;

let appVersion = '0.1.0';

interface ConnectedSessionState {
  session: SavedSession;
  client: AcpClientBridge;
  isLoading: boolean;
  messages: ChatMessage[];
  toolCalls: Map<string, ToolCallInfo>;
  availableModes: SessionMode[];
  currentModeId: string;
  availableCommands: SlashCommand[];
  availableModels: ModelInfo[];
  currentModelId: string;
  stopPermissionWatch?: () => void;
}

function detectPhase(line: string): string | null {
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

function sanitizeProxyConfig(proxy?: SessionProxyConfig): SessionProxyConfig | undefined {
  if (!proxy) {
    return undefined;
  }
  const cleaned: SessionProxyConfig = {
    enabled: !!proxy.enabled,
  };
  const http = proxy.httpProxy?.trim();
  const https = proxy.httpsProxy?.trim();
  const all = proxy.allProxy?.trim();
  const noProxy = proxy.noProxy?.trim();
  if (http) cleaned.httpProxy = http;
  if (https) cleaned.httpsProxy = https;
  if (all) cleaned.allProxy = all;
  if (noProxy) cleaned.noProxy = noProxy;
  return cleaned;
}

function buildProxyEnv(proxy?: SessionProxyConfig): Record<string, string> {
  const normalized = sanitizeProxyConfig(proxy);
  if (!normalized || !normalized.enabled) {
    return {};
  }
  const env: Record<string, string> = {};
  const setPair = (key: string, value?: string) => {
    if (!value) return;
    env[key] = value;
    env[key.toLowerCase()] = value;
  };
  setPair('HTTP_PROXY', normalized.httpProxy);
  setPair('HTTPS_PROXY', normalized.httpsProxy);
  setPair('ALL_PROXY', normalized.allProxy);
  setPair('NO_PROXY', normalized.noProxy);

  const npmProxy = normalized.httpProxy || normalized.allProxy;
  const npmHttpsProxy = normalized.httpsProxy || normalized.httpProxy || normalized.allProxy;
  if (npmProxy) {
    setPair('NPM_CONFIG_PROXY', npmProxy);
    setPair('npm_config_proxy', npmProxy);
  }
  if (npmHttpsProxy) {
    setPair('NPM_CONFIG_HTTPS_PROXY', npmHttpsProxy);
    setPair('npm_config_https_proxy', npmHttpsProxy);
    setPair('GLOBAL_AGENT_HTTP_PROXY', npmHttpsProxy);
  }
  if (normalized.noProxy) {
    setPair('NPM_CONFIG_NOPROXY', normalized.noProxy);
    setPair('npm_config_noproxy', normalized.noProxy);
  }
  return env;
}

function normalizeModes(
  modes?: NewSessionResponse['modes'] | LoadSessionResponse['modes']
): { availableModes: SessionMode[]; currentModeId: string } {
  if (!modes) {
    return {
      availableModes: [],
      currentModeId: '',
    };
  }
  return {
    availableModes: (modes.availableModes || []).map((mode) => ({
      id: mode.id,
      name: mode.name,
      description: mode.description ?? undefined,
    })),
    currentModeId: modes.currentModeId || '',
  };
}

function normalizeModels(
  models?: NewSessionResponse['models'] | LoadSessionResponse['models']
): { availableModels: ModelInfo[]; currentModelId: string } {
  if (!models) {
    return {
      availableModels: [],
      currentModelId: '',
    };
  }
  return {
    availableModels: (models.availableModels || []).map((model) => ({
      modelId: model.modelId,
      name: model.name,
      description: model.description ?? undefined,
    })),
    currentModelId: models.currentModelId || '',
  };
}

export const useSessionStore = defineStore('session', () => {
  const savedSessions = ref<SavedSession[]>([]);
  const connectedSessions = ref<Record<string, ConnectedSessionState>>({});
  const activeSessionId = ref('');
  const isConnected = computed(() => Object.keys(connectedSessions.value).length > 0);
  const isConnecting = ref(false);
  const error = ref<string | null>(null);
  const pendingPermission = ref<PermissionRequest | null>(null);
  const pendingPermissionSessionId = ref<string | null>(null);

  const pendingAuthMethods = ref<AuthMethod[]>([]);
  const pendingAuthAgentName = ref('');
  let authMethodResolver: ((methodId: string | null) => void) | null = null;

  const availableCommands = computed(() => {
    const active = connectedSessions.value[activeSessionId.value];
    return active?.availableCommands ?? [];
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
  const startupLogs = ref<string[]>([]);
  const startupElapsed = ref(0);
  let startupTimer: ReturnType<typeof setInterval> | null = null;
  let stderrUnlisten: (() => void) | null = null;

  let storeData: Record<string, unknown> = {};

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
  const connectedSessionIds = computed(() => Object.keys(connectedSessions.value));

  async function initStore() {
    storeData = await loadStore(STORE_PATH);
    const saved = storeData.sessions as SavedSession[] | undefined;
    if (saved) {
      savedSessions.value = saved.map((session) => ({
        ...session,
        proxy: sanitizeProxyConfig(session.proxy),
      }));
    }

    try {
      appVersion = await getAppVersion();
    } catch (e) {
      console.warn('Failed to get app version:', e);
    }
  }

  async function saveSessionsToStore() {
    storeData.sessions = savedSessions.value;
    await saveStore(STORE_PATH, storeData);
  }

  function getConnectedSession(sessionId: string): ConnectedSessionState | null {
    return connectedSessions.value[sessionId] ?? null;
  }

  function getConnectedSessionByAcpSessionId(sessionId: string): ConnectedSessionState | null {
    return (
      Object.values(connectedSessions.value).find(
        (connectedSession) => connectedSession.session.sessionId === sessionId
      ) ?? null
    );
  }

  function setActiveSession(sessionId: string): void {
    if (!connectedSessions.value[sessionId]) {
      return;
    }
    activeSessionId.value = sessionId;
  }

  function createConnectedSessionState(
    session: SavedSession,
    client: AcpClientBridge
  ): ConnectedSessionState {
    return {
      session,
      client,
      isLoading: false,
      messages: [],
      toolCalls: new Map<string, ToolCallInfo>(),
      availableModes: [],
      currentModeId: '',
      availableCommands: [],
      availableModels: [],
      currentModelId: '',
    };
  }

  function upsertConnectedSession(runtime: ConnectedSessionState): void {
    connectedSessions.value = {
      ...connectedSessions.value,
      [runtime.session.id]: runtime,
    };
    setActiveSession(runtime.session.id);
  }

  function applySessionCapabilities(
    runtime: ConnectedSessionState,
    response?: Pick<NewSessionResponse, 'modes' | 'models'> | Pick<LoadSessionResponse, 'modes' | 'models'>
  ): void {
    const normalizedModes = normalizeModes(response?.modes);
    runtime.availableModes = normalizedModes.availableModes;
    runtime.currentModeId = normalizedModes.currentModeId;

    const normalizedModels = normalizeModels(response?.models);
    runtime.availableModels = normalizedModels.availableModels;
    runtime.currentModelId = normalizedModels.currentModelId;
  }

  function clearRuntimePermissionState(sessionId: string): void {
    if (pendingPermissionSessionId.value === sessionId) {
      pendingPermission.value = null;
      pendingPermissionSessionId.value = null;
    }
  }

  function attachPermissionWatcher(runtime: ConnectedSessionState): void {
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

  function removeConnectedSession(sessionId: string): void {
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

  function touchSavedSession(session: SavedSession): void {
    session.lastUpdated = Date.now();
  }

  function handleSessionUpdate(runtime: ConnectedSessionState, notification: SessionNotification) {
    const update = notification.update;
    const targetMessages = runtime.messages;
    const targetToolCalls = runtime.toolCalls;

    switch (update.sessionUpdate) {
      case 'user_message_chunk': {
        const lastUserMsg = targetMessages[targetMessages.length - 1];
        if (lastUserMsg && lastUserMsg.role === 'user') {
          if (update.content.type === 'text') {
            lastUserMsg.content += update.content.text;
          }
        } else {
          targetMessages.push({
            id: crypto.randomUUID(),
            role: 'user',
            content: update.content.type === 'text' ? update.content.text : '',
            timestamp: Date.now(),
          });
        }
        break;
      }

      case 'agent_message_chunk': {
        const lastMsg = targetMessages[targetMessages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          if (update.content.type === 'text') {
            lastMsg.content += update.content.text;
          }
        } else {
          targetMessages.push({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: update.content.type === 'text' ? update.content.text : '',
            timestamp: Date.now(),
            toolCalls: [],
          });
        }
        break;
      }

      case 'agent_thought_chunk': {
        const lastAssistantMsg = targetMessages[targetMessages.length - 1];
        if (lastAssistantMsg && lastAssistantMsg.role === 'assistant') {
          if (update.content.type === 'text') {
            lastAssistantMsg.thought = (lastAssistantMsg.thought || '') + update.content.text;
          }
        } else {
          targetMessages.push({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '',
            thought: update.content.type === 'text' ? update.content.text : '',
            timestamp: Date.now(),
            toolCalls: [],
          });
        }
        break;
      }

      case 'tool_call': {
        const currentAssistantMsg = targetMessages[targetMessages.length - 1];
        if (currentAssistantMsg && currentAssistantMsg.role === 'assistant') {
          if (!currentAssistantMsg.toolCalls) {
            currentAssistantMsg.toolCalls = [];
          }
          currentAssistantMsg.toolCalls.push({
            toolCallId: update.toolCallId,
            title: update.title,
            kind: update.kind || 'other',
            status: update.status || 'pending',
            locations: update.locations,
          });
        }
        targetToolCalls.set(update.toolCallId, {
          toolCallId: update.toolCallId,
          title: update.title,
          kind: update.kind || 'other',
          status: update.status || 'pending',
          locations: update.locations,
        });
        break;
      }

      case 'tool_call_update': {
        const existing = targetToolCalls.get(update.toolCallId);
        if (existing) {
          if (update.status) existing.status = update.status;
          if (update.title) existing.title = update.title;
        }
        for (const msg of targetMessages) {
          if (!msg.toolCalls) continue;
          const toolCall = msg.toolCalls.find((entry) => entry.toolCallId === update.toolCallId);
          if (!toolCall) continue;
          if (update.status) toolCall.status = update.status;
          if (update.title) toolCall.title = update.title;
        }
        break;
      }

      case 'current_mode_update':
        if ('modeId' in update && update.modeId) {
          runtime.currentModeId = update.modeId as string;
        }
        break;

      case 'available_commands_update':
        if ('availableCommands' in update && Array.isArray(update.availableCommands)) {
          runtime.availableCommands = update.availableCommands.map((command) => ({
            name: command.name,
            description: command.description,
            hint: command.input?.hint ?? undefined,
          }));
        }
        break;

      default:
        console.log('Unhandled session update:', update);
    }
  }

  async function promptForAuthMethod(
    authMethods: AuthMethod[],
    agentName: string
  ): Promise<string | null> {
    return new Promise((resolve) => {
      pendingAuthMethods.value = authMethods;
      pendingAuthAgentName.value = agentName;
      authMethodResolver = resolve;
    });
  }

  function selectAuthMethod(methodId: string): void {
    if (!authMethodResolver) {
      return;
    }
    authMethodResolver(methodId);
    authMethodResolver = null;
    pendingAuthMethods.value = [];
    pendingAuthAgentName.value = '';
  }

  function cancelAuthSelection(): void {
    if (!authMethodResolver) {
      return;
    }
    authMethodResolver(null);
    authMethodResolver = null;
    pendingAuthMethods.value = [];
    pendingAuthAgentName.value = '';
  }

  async function createSession(
    agentName: string,
    cwd: string,
    proxy?: SessionProxyConfig
  ): Promise<void> {
    isConnecting.value = true;
    connectionAborted = false;
    error.value = null;

    startupPhase.value = 'starting';
    startupLogs.value = [];
    startupElapsed.value = 0;
    startupTimer = setInterval(() => {
      startupElapsed.value++;
    }, 1000);

    let client: AcpClientBridge | null = null;
    let runtime: ConnectedSessionState | null = null;

    try {
      const sanitizedProxy = sanitizeProxyConfig(proxy);
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
      })) as unknown as () => void;

      if (connectionAborted) {
        await killAgent(agentInstance.id);
        throw new Error('Connection cancelled');
      }

      startupPhase.value = 'initializing';

      client = await createAcpClient(agentInstance);

      if (connectionAborted) {
        await client.disconnect();
        throw new Error('Connection cancelled');
      }

      startupPhase.value = 'connecting';

      const initResponse = await client.initialize({
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: {
          fs: {
            readTextFile: true,
            writeTextFile: true,
          },
        },
        clientInfo: {
          name: 'acp-ui',
          title: 'ACP UI',
          version: appVersion,
        },
      });

      const supportsLoadSession = initResponse.agentCapabilities?.loadSession ?? false;
      const availableAuthMethods = initResponse.authMethods || [];

      if (connectionAborted) {
        await client.disconnect();
        throw new Error('Connection cancelled');
      }

      let sessionResponse: NewSessionResponse;
      try {
        sessionResponse = await client.newSession({
          cwd,
          mcpServers: [],
        });
      } catch (sessionError: unknown) {
        const errorMessage =
          sessionError instanceof Error ? sessionError.message : String(sessionError);
        const isAuthRequired =
          errorMessage.toLowerCase().includes('authentication required') ||
          errorMessage.includes('-32000');

        if (!isAuthRequired || availableAuthMethods.length === 0) {
          throw sessionError;
        }

        const selectedMethodId = await promptForAuthMethod(availableAuthMethods, agentName);

        if (!selectedMethodId || connectionAborted) {
          await client.disconnect();
          throw new Error('Authentication cancelled by user');
        }

        await client.authenticate({
          methodId: selectedMethodId,
        });

        if (connectionAborted) {
          await client.disconnect();
          throw new Error('Connection cancelled');
        }

        sessionResponse = await client.newSession({
          cwd,
          mcpServers: [],
        });
      }

      const session: SavedSession = {
        id: crypto.randomUUID(),
        agentName,
        sessionId: sessionResponse.sessionId,
        title: `Session ${new Date().toLocaleString()}`,
        lastUpdated: Date.now(),
        cwd,
        supportsLoadSession,
        proxy: sanitizedProxy,
      };

      runtime = createConnectedSessionState(session, client);
      client.onSessionUpdate = (notification) => handleSessionUpdate(runtime!, notification);
      applySessionCapabilities(runtime, sessionResponse);
      attachPermissionWatcher(runtime);
      upsertConnectedSession(runtime);

      savedSessions.value.push(session);
      await saveSessionsToStore();

      trackEvent('SessionCreated', { agentName, success: 'true' });
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      if (runtime) {
        removeConnectedSession(runtime.session.id);
      }
      if (client && !runtime) {
        await client.disconnect();
      }
      trackEvent('SessionCreated', { agentName, success: 'false' });
      trackError(e instanceof Error ? e : new Error(String(e)));
      throw e;
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

  async function resumeSession(savedSession: SavedSession): Promise<void> {
    const existing = getConnectedSession(savedSession.id);
    if (existing) {
      touchSavedSession(existing.session);
      await saveSessionsToStore();
      setActiveSession(savedSession.id);
      return;
    }

    error.value = null;

    let client: AcpClientBridge | null = null;
    let runtime: ConnectedSessionState | null = null;

    try {
      const agentInstance = await spawnAgent(
        savedSession.agentName,
        buildProxyEnv(savedSession.proxy)
      );

      client = await createAcpClient(agentInstance);

      runtime = createConnectedSessionState(savedSession, client);
      client.onSessionUpdate = (notification) => handleSessionUpdate(runtime!, notification);
      attachPermissionWatcher(runtime);
      upsertConnectedSession(runtime);

      const initResponse = await client.initialize({
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: {
          fs: {
            readTextFile: true,
            writeTextFile: true,
          },
        },
        clientInfo: {
          name: 'acp-ui',
          title: 'ACP UI',
          version: appVersion,
        },
      });

      const availableAuthMethods = initResponse.authMethods || [];

      let loadResponse: LoadSessionResponse;
      try {
        loadResponse = await client.loadSession({
          sessionId: savedSession.sessionId,
          cwd: savedSession.cwd,
          mcpServers: [],
        });
      } catch (sessionError: unknown) {
        const errorMessage =
          sessionError instanceof Error ? sessionError.message : String(sessionError);
        const isAuthRequired =
          errorMessage.toLowerCase().includes('authentication required') ||
          errorMessage.includes('-32000');

        if (!isAuthRequired || availableAuthMethods.length === 0) {
          throw sessionError;
        }

        const selectedMethodId = await promptForAuthMethod(
          availableAuthMethods,
          savedSession.agentName
        );

        if (!selectedMethodId) {
          await client.disconnect();
          throw new Error('Authentication cancelled by user');
        }

        await client.authenticate({
          methodId: selectedMethodId,
        });

        loadResponse = await client.loadSession({
          sessionId: savedSession.sessionId,
          cwd: savedSession.cwd,
          mcpServers: [],
        });
      }

      applySessionCapabilities(runtime, loadResponse);
      touchSavedSession(savedSession);
      await saveSessionsToStore();

      trackEvent('SessionResumed', {
        agentName: savedSession.agentName,
        success: 'true',
      });
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      if (runtime) {
        removeConnectedSession(runtime.session.id);
      }
      if (client && !runtime) {
        await client.disconnect();
      }
      trackEvent('SessionResumed', {
        agentName: savedSession.agentName,
        success: 'false',
      });
      trackError(e instanceof Error ? e : new Error(String(e)));
      throw e;
    } finally {
    }
  }

  async function sendPrompt(text: string): Promise<void> {
    const runtime = getConnectedSession(activeSessionId.value);
    if (!runtime) {
      throw new Error('No active session');
    }

    runtime.messages.push({
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    });

    runtime.isLoading = true;
    try {
      const response = await runtime.client.prompt({
        sessionId: runtime.session.sessionId,
        prompt: [
          {
            type: 'text',
            text,
          },
        ],
      });

      trackEvent('PromptSent', {
        messageLength: String(text.length),
        stopReason: response.stopReason || 'unknown',
      });

      if (runtime.messages.length === 2) {
        runtime.session.title = text.slice(0, 50) + (text.length > 50 ? '...' : '');
      }

      touchSavedSession(runtime.session);
      await saveSessionsToStore();
    } finally {
      runtime.isLoading = false;
    }
  }

  async function cancelOperation(): Promise<void> {
    const runtime = getConnectedSession(activeSessionId.value);
    if (!runtime) {
      return;
    }

    await runtime.client.cancel({
      sessionId: runtime.session.sessionId,
    });
  }

  async function cancelConnection(): Promise<void> {
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

  function resolvePermission(optionId: string): void {
    const pendingSession = pendingPermission.value?.sessionId;
    if (!pendingSession) {
      return;
    }
    const runtime = getConnectedSessionByAcpSessionId(pendingSession);
    runtime?.client.resolvePermission(optionId);
  }

  function cancelPermission(): void {
    const pendingSession = pendingPermission.value?.sessionId;
    if (!pendingSession) {
      return;
    }
    const runtime = getConnectedSessionByAcpSessionId(pendingSession);
    runtime?.client.cancelPermission();
  }

  async function disconnect(sessionId = activeSessionId.value): Promise<void> {
    const runtime = getConnectedSession(sessionId);
    if (!runtime) {
      return;
    }

    const sessionStart = runtime.session.lastUpdated || Date.now();
    const sessionDuration = Math.round((Date.now() - sessionStart) / 1000);

    await runtime.client.disconnect();
    removeConnectedSession(sessionId);

    trackEvent('SessionDisconnected', {
      agentName: runtime.session.agentName,
      sessionDurationSeconds: String(sessionDuration),
      messageCount: String(runtime.messages.length),
    });
  }

  async function deleteSession(sessionId: string): Promise<void> {
    if (getConnectedSession(sessionId)) {
      await disconnect(sessionId);
    }
    savedSessions.value = savedSessions.value.filter((session) => session.id !== sessionId);
    await saveSessionsToStore();
  }

  async function setMode(modeId: string): Promise<void> {
    const runtime = getConnectedSession(activeSessionId.value);
    if (!runtime) {
      throw new Error('No active session');
    }

    await runtime.client.setMode({
      sessionId: runtime.session.sessionId,
      modeId,
    });
    runtime.currentModeId = modeId;
  }

  async function setModel(modelId: string): Promise<void> {
    const runtime = getConnectedSession(activeSessionId.value);
    if (!runtime) {
      throw new Error('No active session');
    }

    await runtime.client.unstable_setSessionModel({
      sessionId: runtime.session.sessionId,
      modelId,
    });
    runtime.currentModelId = modelId;
  }

  function clearError() {
    error.value = null;
  }

  return {
    savedSessions,
    connectedSessionIds,
    currentSession,
    messages: messageList,
    isConnected,
    isLoading,
    isConnecting,
    error,
    pendingPermission,
    pendingAuthMethods,
    pendingAuthAgentName,
    availableModes,
    currentModeId,
    availableCommands,
    availableModels,
    currentModelId,
    startupPhase,
    startupLogs,
    startupElapsed,
    hasActiveSession,
    messageList,
    toolCallList,
    resumableSessions,
    initStore,
    createSession,
    resumeSession,
    sendPrompt,
    cancelOperation,
    cancelConnection,
    resolvePermission,
    cancelPermission,
    selectAuthMethod,
    cancelAuthSelection,
    disconnect,
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
