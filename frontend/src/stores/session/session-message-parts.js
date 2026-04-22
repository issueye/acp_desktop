import { clonePlanEntries } from './session-models';

function cloneToolCall(toolCall) {
  return {
    ...toolCall,
    locations: toolCall.locations?.map((location) => ({ ...location })),
  };
}

function applyToolCallUpdate(target, update) {
  if ('status' in update) target.status = update.status;
  if ('title' in update) target.title = update.title;
  if ('kind' in update) target.kind = update.kind || 'other';
  if ('locations' in update) {
    target.locations = Array.isArray(update.locations)
      ? update.locations.map((location) => ({ ...location }))
      : update.locations;
  }
}

export function ensureMessageParts(message) {
  if (!message.parts) {
    const parts = [];
    if (message.content) {
      parts.push({
        type: 'content',
        content: message.content,
      });
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
          toolCall: cloneToolCall(toolCall),
        }))
      );
    }
    message.parts = parts;
  }
  return message.parts;
}

export function createChatMessage(role) {
  return {
    id: crypto.randomUUID(),
    role,
    content: '',
    timestamp: Date.now(),
    parts: [],
  };
}

export function getOrCreateTrailingMessage(runtime, role) {
  const lastMessage = runtime.messages[runtime.messages.length - 1];
  if (lastMessage && lastMessage.role === role) {
    ensureMessageParts(lastMessage);
    return lastMessage;
  }

  const nextMessage = createChatMessage(role);
  runtime.messages.push(nextMessage);
  return nextMessage;
}

export function appendTextPart(message, type, text) {
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

export function appendToolCallPart(message, toolCall) {
  const nextToolCall = cloneToolCall(toolCall);

  const parts = ensureMessageParts(message);
  const existingPart = parts.find(
    (part) => part.type === 'tool_call' && part.toolCall?.toolCallId === nextToolCall.toolCallId
  );
  if (existingPart) {
    existingPart.toolCall = nextToolCall;
  } else {
    parts.push({
      type: 'tool_call',
      toolCall: nextToolCall,
    });
  }

  if (!message.toolCalls) {
    message.toolCalls = [];
  }
  const existingToolCallIndex = message.toolCalls.findIndex(
    (entry) => entry.toolCallId === nextToolCall.toolCallId
  );
  if (existingToolCallIndex >= 0) {
    message.toolCalls.splice(existingToolCallIndex, 1, nextToolCall);
  } else {
    message.toolCalls.push(nextToolCall);
  }
}

export function upsertPlanMessage(runtime, entries) {
  const nextEntries = entries.map((entry) => ({ ...entry }));
  runtime.currentPlanEntries = nextEntries;
  runtime.session.currentPlanEntries = clonePlanEntries(nextEntries);
}

export function updateToolCallParts(messages, update) {
  for (const msg of messages) {
    if (msg.toolCalls) {
      const toolCall = msg.toolCalls.find((entry) => entry.toolCallId === update.toolCallId);
      if (toolCall) {
        applyToolCallUpdate(toolCall, update);
      }
    }

    const parts = ensureMessageParts(msg);
    for (const part of parts) {
      if (part.type !== 'tool_call' || part.toolCall.toolCallId !== update.toolCallId) {
        continue;
      }
      applyToolCallUpdate(part.toolCall, update);
    }
  }
}
