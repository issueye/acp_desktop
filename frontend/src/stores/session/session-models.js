export function sanitizeProxyConfig(proxy) {
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

export function buildProxyEnv(proxy) {
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

export function normalizeModes(modes) {
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

export function normalizeModels(models) {
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

export function cloneMessagePart(part) {
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

  return { ...part };
}

export function cloneMessages(messages) {
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
    parts: message.parts
      ?.filter((part) => part?.type !== 'image')
      .map((part) => cloneMessagePart(part))
      .filter((part) => part !== null),
  }));
}

export function clonePlanEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries.map((entry) => ({ ...entry }));
}

export function normalizeSessionMetadata(session = {}) {
  const now = Date.now();
  const git = session.git && typeof session.git === 'object' ? session.git : {};
  const tags = Array.isArray(session.tags)
    ? session.tags
        .map((tag) => String(tag || '').trim())
        .filter(Boolean)
    : [];
  const status = ['active', 'archived'].includes(session.status) ? session.status : 'active';
  return {
    summary: typeof session.summary === 'string' ? session.summary : '',
    status,
    tags,
    git: {
      lastCommitHash: typeof git.lastCommitHash === 'string' ? git.lastCommitHash : '',
      lastCommitSubject: typeof git.lastCommitSubject === 'string' ? git.lastCommitSubject : '',
      lastCommittedAt: Number.isFinite(git.lastCommittedAt) ? git.lastCommittedAt : 0,
    },
    createdAt: Number.isFinite(session.createdAt) ? session.createdAt : now,
    metadataUpdatedAt: Number.isFinite(session.metadataUpdatedAt) ? session.metadataUpdatedAt : now,
  };
}

export function normalizeSession(session = {}) {
  const metadata = normalizeSessionMetadata(session);
  return {
    ...session,
    ...metadata,
    proxy: sanitizeProxyConfig(session.proxy),
    messages: cloneMessages(session.messages),
    currentPlanEntries: clonePlanEntries(session.currentPlanEntries),
  };
}

export function applySessionGitMetadata(session, commit) {
  if (!session || !commit) {
    return session;
  }
  const normalized = normalizeSessionMetadata(session);
  return {
    ...session,
    ...normalized,
    git: {
      ...normalized.git,
      lastCommitHash: commit.hash || '',
      lastCommitSubject: commit.subject || '',
      lastCommittedAt: Date.now(),
    },
    metadataUpdatedAt: Date.now(),
  };
}

export function buildPromptParts(text) {
  const parts = [];
  if (text) {
    parts.push({
      type: 'content',
      content: text,
    });
  }

  return parts;
}

export function buildPromptPayload(text) {
  const payload = [];
  if (text) {
    payload.push({
      type: 'text',
      text,
    });
  }

  return payload;
}

export function normalizeWorkspacePath(cwd) {
  const raw = typeof cwd === 'string' && cwd.trim() ? cwd.trim() : '.';
  const normalized = raw.replace(/\\/g, '/').replace(/\/+$/g, '');
  return normalized || '.';
}

export function buildWorkspaceId(cwd) {
  return normalizeWorkspacePath(cwd).toLowerCase();
}

export function getWorkspaceName(cwd) {
  const normalized = normalizeWorkspacePath(cwd);
  if (normalized === '.') {
    return '.';
  }
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || normalized;
}

export function normalizeWorkspace(workspace) {
  const cwd = normalizeWorkspacePath(workspace?.cwd);
  return {
    id: workspace?.id || buildWorkspaceId(cwd),
    name: workspace?.name || getWorkspaceName(cwd),
    cwd,
    createdAt: Number.isFinite(workspace?.createdAt) ? workspace.createdAt : Date.now(),
    lastUpdated: Number.isFinite(workspace?.lastUpdated) ? workspace.lastUpdated : Date.now(),
  };
}
