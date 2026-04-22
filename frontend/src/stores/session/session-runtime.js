import {
  cloneMessages,
  clonePlanEntries,
  normalizeModels,
  normalizeModes,
} from './session-models';
import {
  appendTextPart,
  appendToolCallPart,
  getOrCreateTrailingMessage,
  updateToolCallParts,
  upsertPlanMessage,
} from './session-message-parts';

export function createConnectedSessionState(session, client) {
  return {
    session,
    client,
    isLoading: false,
    messages: [],
    currentPlanEntries: clonePlanEntries(session.currentPlanEntries),
    toolCalls: new Map(),
    availableModes: [],
    currentModeId: '',
    availableCommands: [],
    availableModels: [],
    currentModelId: '',
  };
}

export function bindRuntimeToClient(runtime, options) {
  const {
    handleSessionUpdate,
    notifyConnectedSessionChanged,
    attachPermissionWatcher,
    upsertConnectedSession,
  } = options;

  runtime.client.onSessionUpdate = (notification) =>
    handleSessionUpdate(runtime, notification, notifyConnectedSessionChanged);
  attachPermissionWatcher(runtime);
  upsertConnectedSession(runtime);
  return runtime;
}

export function createBoundRuntime(session, client, options) {
  const runtime = createConnectedSessionState(session, client);
  return bindRuntimeToClient(runtime, options);
}

export function applySessionCapabilities(runtime, response, notifyConnectedSessionChanged) {
  const normalizedModes = normalizeModes(response?.modes);
  runtime.availableModes = normalizedModes.availableModes;
  runtime.currentModeId = normalizedModes.currentModeId;

  const normalizedModels = normalizeModels(response?.models);
  runtime.availableModels = normalizedModels.availableModels;
  runtime.currentModelId = normalizedModels.currentModelId;
  notifyConnectedSessionChanged(runtime);
}

export async function persistSavedSession(savedSessions, session, saveSessionsToStore) {
  savedSessions.push(session);
  await saveSessionsToStore();
}

export function touchSavedSession(session) {
  session.lastUpdated = Date.now();
}

export function syncRuntimeSnapshot(runtime) {
  runtime.session.messages = cloneMessages(runtime.messages);
  runtime.session.currentPlanEntries = clonePlanEntries(runtime.currentPlanEntries);
}

export async function persistRuntimeSession(runtime, saveSessionsToStore) {
  touchSavedSession(runtime.session);
  syncRuntimeSnapshot(runtime);
  await saveSessionsToStore();
}

export function refreshRuntimeCollections(runtime) {
  runtime.messages = [...runtime.messages];
  runtime.currentPlanEntries = [...runtime.currentPlanEntries];
}

export function handleSessionUpdate(runtime, notification, notifyConnectedSessionChanged) {
  const update = notification.update;
  const targetMessages = runtime.messages;
  const targetToolCalls = runtime.toolCalls;

  switch (update.sessionUpdate) {
    case 'user_message_chunk': {
      if (update.content?.type === 'text') {
        const message = getOrCreateTrailingMessage(runtime, 'user');
        appendTextPart(message, 'content', update.content.text);
      }
      break;
    }

    case 'agent_message_chunk': {
      if (update.content?.type === 'text') {
        const message = getOrCreateTrailingMessage(runtime, 'assistant');
        appendTextPart(message, 'content', update.content.text);
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
        locations: Array.isArray(update.locations)
          ? update.locations.map((location) => ({ ...location }))
          : update.locations,
      };
      const message = getOrCreateTrailingMessage(runtime, 'assistant');
      appendToolCallPart(message, nextToolCall);
      targetToolCalls.set(update.toolCallId, nextToolCall);
      break;
    }

    case 'tool_call_update': {
      const existing = targetToolCalls.get(update.toolCallId);
      if (existing) {
        if ('status' in update) existing.status = update.status;
        if ('title' in update) existing.title = update.title;
        if ('kind' in update) existing.kind = update.kind || 'other';
        if ('locations' in update) {
          existing.locations = Array.isArray(update.locations)
            ? update.locations.map((location) => ({ ...location }))
            : update.locations;
        }
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
