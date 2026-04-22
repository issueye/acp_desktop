import { scanAgentSessions } from '../../lib/wails';
import {
  buildWorkspaceId,
  getWorkspaceName,
  normalizeWorkspacePath,
} from './session-models';

export function normalizeAgentNames(agentNames = []) {
  return [...new Set((agentNames || []).filter(Boolean))];
}

export function normalizeTargetWorkspace(workspace) {
  return workspace
    ? {
        ...workspace,
        id: workspace.id || buildWorkspaceId(workspace.cwd),
        cwd: normalizeWorkspacePath(workspace.cwd),
      }
    : null;
}

export function createScannedSession(agentName, item, options = {}) {
  const { ensureWorkspace = true, ensureWorkspaceForCwd } = options;
  const rawPath = item?.path || item?.cwd || '.';
  const cwd = normalizeWorkspacePath(item?.cwd || rawPath);
  const workspace = ensureWorkspace
    ? ensureWorkspaceForCwd(cwd, false)
    : { id: buildWorkspaceId(cwd) };
  const rawId = String(item?.id || rawPath || crypto.randomUUID());
  const updatedAt = Number(item?.updatedAt);

  return {
    id: `scan:${agentName}:${rawId}`,
    external: true,
    source: 'scan',
    agentName,
    sessionId: rawId,
    title: item?.title || getWorkspaceName(cwd),
    path: rawPath,
    cwd,
    workspaceId: workspace.id,
    lastUpdated: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now(),
    supportsLoadSession: false,
    messages: [],
  };
}

export async function collectScannedSessions(agentNames = [], options = {}) {
  const { workspace = null, ensureWorkspaceForCwd } = options;
  const names = normalizeAgentNames(agentNames);
  const targetWorkspace = normalizeTargetWorkspace(workspace);

  if (names.length === 0 || (workspace && !targetWorkspace?.id)) {
    return {
      names,
      targetWorkspace,
      nextSessions: [],
      errors: [],
    };
  }

  const nextSessions = [];
  const errors = [];

  for (const agentName of names) {
    try {
      const results = await scanAgentSessions(agentName);
      (Array.isArray(results) ? results : []).forEach((item) => {
        if (targetWorkspace?.id) {
          const session = createScannedSession(agentName, item, {
            ensureWorkspace: false,
            ensureWorkspaceForCwd,
          });
          if (session.workspaceId === targetWorkspace.id) {
            nextSessions.push(
              createScannedSession(agentName, item, {
                ensureWorkspace: true,
                ensureWorkspaceForCwd,
              })
            );
          }
          return;
        }

        nextSessions.push(
          createScannedSession(agentName, item, {
            ensureWorkspace: true,
            ensureWorkspaceForCwd,
          })
        );
      });
    } catch (e) {
      errors.push(`${agentName}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    names,
    targetWorkspace,
    nextSessions,
    errors,
  };
}

export function mergeScannedSessions(existingSessions, names, nextSessions, targetWorkspace = null) {
  const nameSet = new Set(names);

  if (targetWorkspace?.id) {
    return [
      ...existingSessions.filter(
        (session) => !(nameSet.has(session.agentName) && session.workspaceId === targetWorkspace.id)
      ),
      ...nextSessions,
    ];
  }

  return [
    ...existingSessions.filter((session) => !nameSet.has(session.agentName)),
    ...nextSessions,
  ];
}
