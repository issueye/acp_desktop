// Session store for managing ACP sessions and persistence
import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { trackError, trackEvent } from '../lib/telemetry';

import { AcpClientBridge, createAcpClient } from '../lib/acp-bridge';
import {
  getAppVersion,
  killAgent,
  loadStore,
  onAgentStderr,
  saveStore,
  selectImageFiles as openImagePicker,
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

function sanitizeProxyConfig(proxy) {
  if (!proxy) {
    return undefined;
  }
  const cleaned = {
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

function buildProxyEnv(proxy) {
  const normalized = sanitizeProxyConfig(proxy);
  if (!normalized || !normalized.enabled) {
    return {};
  }
  const env = {};
  const setPair = (key, value) => {
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

function normalizeModes(modes) {
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

function normalizeModels(models) {
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

function createImageDataUrl(mimeType, dataBase64) {
  if (typeof mimeType !== 'string' || typeof dataBase64 !== 'string' || dataBase64.length === 0) {
    return '';
  }
  return `data:${mimeType};base64,${dataBase64}`;
}

function cloneAttachment(attachment) {
  if (!attachment || typeof attachment !== 'object') {
    return null;
  }

  const mimeType = typeof attachment.mimeType === 'string' ? attachment.mimeType : '';
  const dataBase64 = typeof attachment.dataBase64 === 'string' ? attachment.dataBase64 : '';
  const path = typeof attachment.path === 'string' ? attachment.path : '';
  const relativePath = typeof attachment.relativePath === 'string' ? attachment.relativePath : '';
  return {
    id: typeof attachment.id === 'string' ? attachment.id : crypto.randomUUID(),
    name: typeof attachment.name === 'string' ? attachment.name : '',
    mimeType,
    dataBase64,
    path,
    relativePath,
    previewUrl:
      typeof attachment.previewUrl === 'string' && attachment.previewUrl.length > 0
        ? attachment.previewUrl
        : createImageDataUrl(mimeType, dataBase64),
  };
}

function cloneAttachments(attachments) {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments
    .map((attachment) => cloneAttachment(attachment))
    .filter((attachment) => attachment !== null);
}

function cloneMessagePart(part) {
  if (!part || typeof part !== 'object') {
    return null;
  }

  if (part.type === 'tool_call') {
    return {
      ...part,
      toolCall: {
        ...part.toolCall,
        locations: part.toolCall.locations?.map((location) => ({ ...location })),
      },
    };
  }
  if (part.type === 'plan') {
    return {
      ...part,
      entries: part.entries.map((entry) => ({ ...entry })),
    };
  }
  if (part.type === 'image') {
    return {
      ...part,
      image: cloneAttachment(part.image),
    };
  }

  return { ...part };
}

function normalizeSelectedImage(image) {
  if (!image || typeof image !== 'object') {
    return null;
  }

  const mimeType = typeof image.mimeType === 'string' ? image.mimeType : '';
  const dataBase64 = typeof image.dataBase64 === 'string' ? image.dataBase64 : '';
  const path = typeof image.path === 'string' ? image.path : '';
  const relativePath = typeof image.relativePath === 'string' ? image.relativePath : '';
  if (!mimeType || (!path && !relativePath)) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    name: typeof image.name === 'string' ? image.name : '',
    mimeType,
    dataBase64,
    path,
    relativePath,
    previewUrl: createImageDataUrl(mimeType, dataBase64),
  };
}

function normalizeIncomingImageContent(content) {
  if (!content || content.type !== 'image') {
    return null;
  }

  const mimeType = typeof content.mimeType === 'string' ? content.mimeType : '';
  const dataBase64 =
    typeof content.data === 'string'
      ? content.data
      : typeof content.dataBase64 === 'string'
        ? content.dataBase64
        : '';

  return {
    id: crypto.randomUUID(),
    name: typeof content.name === 'string' ? content.name : '',
    mimeType,
    dataBase64,
    path: typeof content.path === 'string' ? content.path : '',
    relativePath: typeof content.relativePath === 'string' ? content.relativePath : '',
    previewUrl: createImageDataUrl(mimeType, dataBase64),
  };
}

function buildPromptParts(text, attachments) {
  const parts = [];
  if (text) {
    parts.push({
      type: 'content',
      content: text,
    });
  }

  for (const attachment of attachments) {
    parts.push({
      type: 'image',
      image: cloneAttachment(attachment),
    });
  }

  return parts;
}

function getAttachmentPromptPath(attachment) {
  if (!attachment || typeof attachment !== 'object') {
    return '';
  }

  if (typeof attachment.relativePath === 'string' && attachment.relativePath.length > 0) {
    return attachment.relativePath;
  }
  if (typeof attachment.path === 'string' && attachment.path.length > 0) {
    return attachment.path;
  }
  return '';
}

function buildAttachmentPromptText(attachments) {
  const lines = attachments
    .map((attachment) => {
      const promptPath = getAttachmentPromptPath(attachment);
      if (!promptPath) {
        return '';
      }

      const displayName =
        typeof attachment.name === 'string' && attachment.name.length > 0
          ? attachment.name
          : 'image';
      return `- ${displayName}: ${promptPath}`;
    })
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return '';
  }

  return ['用户附带了以下图片文件，请读取这些路径对应的图片内容：', ...lines].join('\n');
}

function buildPromptPayload(text, attachments) {
  const payload = [];
  if (text) {
    payload.push({
      type: 'text',
      text,
    });
  }

  const attachmentPromptText = buildAttachmentPromptText(attachments);
  if (attachmentPromptText) {
    payload.push({
      type: 'text',
      text: attachmentPromptText,
    });
  }

  return payload;
}

function cloneMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.map((message) => ({
    ...message,
    content: typeof message.content === 'string' ? message.content : '',
    thought: typeof message.thought === 'string' ? message.thought : undefined,
    toolCalls: message.toolCalls?.map((toolCall) => ({
      ...toolCall,
      locations: toolCall.locations?.map((location) => ({ ...location })),
    })),
    planEntries: message.planEntries?.map((entry) => ({ ...entry })),
    attachments: cloneAttachments(message.attachments),
    parts: message.parts
      ?.map((part) => cloneMessagePart(part))
      .filter((part) => part !== null),
  }));
}

function clonePlanEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries.map((entry) => ({ ...entry }));
}

export const useSessionStore = defineStore('session', () => {
  const savedSessions = ref([]);
  const connectedSessions = ref({});
  const activeSessionId = ref('');
  const isConnected = computed(() => Object.keys(connectedSessions.value).length > 0);
  const isConnecting = ref(false);
  const error = ref(null);
  const pendingPermission = ref(null);
  const pendingPermissionSessionId = ref(null);

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

  const pendingAttachments = computed(() => {
    const active = connectedSessions.value[activeSessionId.value];
    return active?.pendingAttachments ?? [];
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
  const connectedSessionIds = computed(() => Object.keys(connectedSessions.value));

  async function initStore() {
    storeData = await loadStore(STORE_PATH);
    const saved = Array.isArray(storeData.sessions) ? storeData.sessions : undefined;
    if (saved) {
      savedSessions.value = saved.map((session) => ({
        ...session,
        proxy: sanitizeProxyConfig(session.proxy),
        messages: cloneMessages(session.messages),
        currentPlanEntries: clonePlanEntries(session.currentPlanEntries),
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

  function getConnectedSession(sessionId) {
    return connectedSessions.value[sessionId] ?? null;
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

  function createConnectedSessionState(
    session,
    client
  ) {
    return {
      session,
      client,
      isLoading: false,
      messages: [],
      pendingAttachments: [],
      currentPlanEntries: clonePlanEntries(session.currentPlanEntries),
      toolCalls: new Map(),
      availableModes: [],
      currentModeId: '',
      availableCommands: [],
      availableModels: [],
      currentModelId: '',
    };
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

  function applySessionCapabilities(
    runtime,
    response
  ) {
    const normalizedModes = normalizeModes(response?.modes);
    runtime.availableModes = normalizedModes.availableModes;
    runtime.currentModeId = normalizedModes.currentModeId;

    const normalizedModels = normalizeModels(response?.models);
    runtime.availableModels = normalizedModels.availableModels;
    runtime.currentModelId = normalizedModels.currentModelId;
    notifyConnectedSessionChanged(runtime);
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

  function touchSavedSession(session) {
    session.lastUpdated = Date.now();
  }

  function syncRuntimeSnapshot(runtime) {
    runtime.session.messages = cloneMessages(runtime.messages);
    runtime.session.currentPlanEntries = clonePlanEntries(runtime.currentPlanEntries);
  }

  function refreshRuntimeCollections(runtime) {
    runtime.messages = [...runtime.messages];
    runtime.currentPlanEntries = [...runtime.currentPlanEntries];
    runtime.pendingAttachments = [...(runtime.pendingAttachments ?? [])];
  }

  function ensureMessageParts(message) {
    if (!message.parts) {
      const parts = [];
      if (message.content) {
        parts.push({
          type: 'content',
          content: message.content,
        });
      }
      if (message.attachments?.length) {
        parts.push(
          ...message.attachments.map((attachment) => ({
            type: 'image',
            image: cloneAttachment(attachment),
          }))
        );
      }
      if (message.thought) {
        parts.push({
          type: 'thought',
          content: message.thought,
        });
      }
      if (message.planEntries?.length) {
        parts.push({
          type: 'plan',
          entries: message.planEntries.map((entry) => ({ ...entry })),
        });
      }
      if (message.toolCalls?.length) {
        parts.push(
          ...message.toolCalls.map((toolCall) => ({
            type: 'tool_call',
            toolCall: {
              ...toolCall,
              locations: toolCall.locations?.map((location) => ({ ...location })),
            },
          }))
        );
      }
      message.parts = parts;
    }
    return message.parts;
  }

  function createChatMessage(role) {
    return {
      id: crypto.randomUUID(),
      role,
      content: '',
      timestamp: Date.now(),
      attachments: [],
      parts: [],
    };
  }

  function getOrCreateTrailingMessage(runtime, role) {
    const lastMessage = runtime.messages[runtime.messages.length - 1];
    if (lastMessage && lastMessage.role === role) {
      ensureMessageParts(lastMessage);
      return lastMessage;
    }

    const nextMessage = createChatMessage(role);
    runtime.messages.push(nextMessage);
    return nextMessage;
  }

  function appendTextPart(message, type, text) {
    if (typeof text !== 'string' || text.length === 0) {
      return;
    }

    const parts = ensureMessageParts(message);
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.type === type) {
      lastPart.content = (typeof lastPart.content === 'string' ? lastPart.content : '') + text;
    } else {
      parts.push({
        type,
        content: text,
      });
    }

    if (type === 'content') {
      message.content = (typeof message.content === 'string' ? message.content : '') + text;
      return;
    }

    message.thought = (message.thought || '') + text;
  }

  function appendImagePart(message, attachment) {
    const nextAttachment = cloneAttachment(attachment);
    if (!nextAttachment) {
      return;
    }

    if (!message.attachments) {
      message.attachments = [];
    }
    message.attachments.push(nextAttachment);
    ensureMessageParts(message).push({
      type: 'image',
      image: nextAttachment,
    });
  }

  function appendToolCallPart(message, toolCall) {
    const nextToolCall = {
      ...toolCall,
      locations: toolCall.locations?.map((location) => ({ ...location })),
    };

    ensureMessageParts(message).push({
      type: 'tool_call',
      toolCall: nextToolCall,
    });
    if (!message.toolCalls) {
      message.toolCalls = [];
    }
    message.toolCalls.push(nextToolCall);
  }

  function upsertPlanMessage(runtime, entries) {
    const nextEntries = entries.map((entry) => ({ ...entry }));
    runtime.currentPlanEntries = nextEntries;
    runtime.session.currentPlanEntries = clonePlanEntries(nextEntries);
  }

  function updateToolCallParts(messages, update) {
    for (const msg of messages) {
      if (msg.toolCalls) {
        const toolCall = msg.toolCalls.find((entry) => entry.toolCallId === update.toolCallId);
        if (toolCall) {
          if (update.status) toolCall.status = update.status;
          if (update.title) toolCall.title = update.title;
        }
      }

      const parts = ensureMessageParts(msg);
      for (const part of parts) {
        if (part.type !== 'tool_call' || part.toolCall.toolCallId !== update.toolCallId) {
          continue;
        }
        if (update.status) part.toolCall.status = update.status;
        if (update.title) part.toolCall.title = update.title;
      }
    }
  }

  function handleSessionUpdate(runtime, notification) {
    const update = notification.update;
    const targetMessages = runtime.messages;
    const targetToolCalls = runtime.toolCalls;

    switch (update.sessionUpdate) {
      case 'user_message_chunk': {
        if (update.content?.type === 'text') {
          const message = getOrCreateTrailingMessage(runtime, 'user');
          appendTextPart(message, 'content', update.content.text);
        } else if (update.content?.type === 'image') {
          const message = getOrCreateTrailingMessage(runtime, 'user');
          appendImagePart(message, normalizeIncomingImageContent(update.content));
        }
        break;
      }

      case 'agent_message_chunk': {
        if (update.content?.type === 'text') {
          const message = getOrCreateTrailingMessage(runtime, 'assistant');
          appendTextPart(message, 'content', update.content.text);
        } else if (update.content?.type === 'image') {
          const message = getOrCreateTrailingMessage(runtime, 'assistant');
          appendImagePart(message, normalizeIncomingImageContent(update.content));
        }
        break;
      }

      case 'agent_thought_chunk': {
        if (update.content?.type === 'text') {
          const message = getOrCreateTrailingMessage(runtime, 'assistant');
          appendTextPart(message, 'thought', update.content.text);
        }
        break;
      }

      case 'tool_call': {
        const nextToolCall = {
          toolCallId: update.toolCallId,
          title: update.title,
          kind: update.kind || 'other',
          status: update.status || 'pending',
          locations: update.locations,
        };
        const message = getOrCreateTrailingMessage(runtime, 'assistant');
        appendToolCallPart(message, nextToolCall);
        targetToolCalls.set(update.toolCallId, nextToolCall);
        break;
      }

      case 'tool_call_update': {
        const existing = targetToolCalls.get(update.toolCallId);
        if (existing) {
          if (update.status) existing.status = update.status;
          if (update.title) existing.title = update.title;
        }
        updateToolCallParts(targetMessages, update);
        break;
      }

      case 'plan':
        if ('entries' in update && Array.isArray(update.entries)) {
          upsertPlanMessage(runtime, update.entries);
        }
        break;

      case 'current_mode_update':
        if ('modeId' in update && update.modeId) {
          runtime.currentModeId = update.modeId;
        }
        break;

      case 'session_info_update':
        if ('title' in update) {
          runtime.session.title = update.title || runtime.session.title;
        }
        if ('updatedAt' in update && update.updatedAt) {
          const nextUpdatedAt = Date.parse(update.updatedAt);
          if (!Number.isNaN(nextUpdatedAt)) {
            runtime.session.lastUpdated = nextUpdatedAt;
          }
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

    refreshRuntimeCollections(runtime);
    notifyConnectedSessionChanged(runtime);
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
          title: 'ACP DESKTOP',
          version: appVersion,
        },
      });

      const supportsLoadSession = initResponse.agentCapabilities?.loadSession ?? false;
      const availableAuthMethods = initResponse.authMethods || [];

      if (connectionAborted) {
        await client.disconnect();
        throw new Error('Connection cancelled');
      }

      let sessionResponse;
      try {
        sessionResponse = await client.newSession({
          cwd,
          mcpServers: [],
        });
      } catch (sessionError) {
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

      const session = {
        id: crypto.randomUUID(),
        agentName,
        sessionId: sessionResponse.sessionId,
        title: `Session ${new Date().toLocaleString()}`,
        lastUpdated: Date.now(),
        cwd,
        supportsLoadSession,
        proxy: sanitizedProxy,
        messages: [],
      };

      runtime = createConnectedSessionState(session, client);
      client.onSessionUpdate = (notification) => handleSessionUpdate(runtime, notification);
      applySessionCapabilities(runtime, sessionResponse);
      attachPermissionWatcher(runtime);
      upsertConnectedSession(runtime);
      syncRuntimeSnapshot(runtime);

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

  async function resumeSession(savedSession) {
    const existing = getConnectedSession(savedSession.id);
    if (existing) {
      touchSavedSession(existing.session);
      await saveSessionsToStore();
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

      runtime = createConnectedSessionState(savedSession, client);
      client.onSessionUpdate = (notification) => handleSessionUpdate(runtime, notification);
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
          title: 'ACP DESKTOP',
          version: appVersion,
        },
      });

      const availableAuthMethods = initResponse.authMethods || [];

      let loadResponse;
      try {
        loadResponse = await client.loadSession({
          sessionId: savedSession.sessionId,
          cwd: savedSession.cwd,
          mcpServers: [],
        });
      } catch (sessionError) {
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
      if (runtime.messages.length === 0 && savedSession.messages?.length) {
        runtime.messages = cloneMessages(savedSession.messages);
      }
      touchSavedSession(savedSession);
      syncRuntimeSnapshot(runtime);
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

  async function selectImageFiles() {
    const runtime = getConnectedSession(activeSessionId.value);
    if (!runtime) {
      throw new Error('No active session');
    }

    error.value = null;
    const selectedImages = await openImagePicker(runtime.session.cwd);
    const nextAttachments = Array.isArray(selectedImages)
      ? selectedImages.map((image) => normalizeSelectedImage(image)).filter((image) => image !== null)
      : [];

    if (nextAttachments.length === 0) {
      return runtime.pendingAttachments;
    }

    runtime.pendingAttachments = [...runtime.pendingAttachments, ...nextAttachments];
    notifyConnectedSessionChanged(runtime);
    return runtime.pendingAttachments;
  }

  function removePendingAttachment(attachmentId) {
    const runtime = getConnectedSession(activeSessionId.value);
    if (!runtime) {
      return;
    }

    runtime.pendingAttachments = runtime.pendingAttachments.filter(
      (attachment) => attachment.id !== attachmentId
    );
    notifyConnectedSessionChanged(runtime);
  }

  function clearPendingAttachments(sessionId = activeSessionId.value) {
    const runtime = getConnectedSession(sessionId);
    if (!runtime) {
      return;
    }

    runtime.pendingAttachments = [];
    notifyConnectedSessionChanged(runtime);
  }

  async function sendPrompt(text, attachments = null) {
    const runtime = getConnectedSession(activeSessionId.value);
    if (!runtime) {
      throw new Error('No active session');
    }

    const normalizedText = typeof text === 'string' ? text.trim() : '';
    const nextAttachments =
      attachments === null ? cloneAttachments(runtime.pendingAttachments) : cloneAttachments(attachments);

    if (!normalizedText && nextAttachments.length === 0) {
      return;
    }

    error.value = null;

    runtime.messages.push({
      ...createChatMessage('user'),
      content: normalizedText,
      timestamp: Date.now(),
      attachments: cloneAttachments(nextAttachments),
      parts: buildPromptParts(normalizedText, nextAttachments),
    });
    refreshRuntimeCollections(runtime);

    const previousPendingAttachments = cloneAttachments(runtime.pendingAttachments);
    runtime.pendingAttachments = [];
    runtime.isLoading = true;
    notifyConnectedSessionChanged(runtime);
    try {
      const response = await runtime.client.prompt({
        sessionId: runtime.session.sessionId,
        prompt: buildPromptPayload(normalizedText, nextAttachments),
      });

      trackEvent('PromptSent', {
        messageLength: String(normalizedText.length),
        attachmentCount: String(nextAttachments.length),
        stopReason: response.stopReason || 'unknown',
      });

      if (runtime.messages.length === 2) {
        const titleSource = normalizedText || nextAttachments[0]?.name || 'Image';
        runtime.session.title = titleSource.slice(0, 50) + (titleSource.length > 50 ? '...' : '');
      }

      touchSavedSession(runtime.session);
      syncRuntimeSnapshot(runtime);
      await saveSessionsToStore();
    } catch (e) {
      runtime.pendingAttachments = previousPendingAttachments;
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

    touchSavedSession(runtime.session);
    syncRuntimeSnapshot(runtime);
    await saveSessionsToStore();
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
    currentPlanEntries,
    pendingAttachments,
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
    selectImageFiles,
    removePendingAttachment,
    clearPendingAttachments,
    sendPrompt,
    cancelOperation,
    cancelConnection,
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
