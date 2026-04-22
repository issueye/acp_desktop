export function diagnoseError(input) {
  const text = normalizeErrorText(input);
  const lower = text.toLowerCase();
  if (!lower) {
    return '';
  }
  if (lower.includes('request timeout: initialize')) {
    return 'Agent initialization timed out. Check startup logs, authentication prompts, and whether the agent speaks ACP.';
  }
  if (lower.includes('request timeout: session/new')) {
    return 'Creating the ACP session timed out. The agent may still be starting, blocked on auth, or unable to open the workspace.';
  }
  if (lower.includes('request timeout: session/prompt')) {
    return 'The prompt request timed out. The agent may still be working; check the process output before retrying.';
  }
  if (lower.includes('method not found') || lower.includes('-32601')) {
    return 'The agent did not recognize this ACP method. Verify the agent version and protocol compatibility.';
  }
  if (lower.includes('authentication cancelled')) {
    return 'Authentication was cancelled. Start a new session and complete the selected authentication method.';
  }
  if (lower.includes('connection cancelled')) {
    return 'The connection flow was cancelled before the session was ready.';
  }
  if (
    lower.includes('executable file not found') ||
    lower.includes('command not found') ||
    lower.includes('not recognized as an internal or external command')
  ) {
    return 'The agent command could not be found. Check the command path, Node/npm installation, and PATH environment.';
  }
  return '';
}

function normalizeErrorText(input) {
  if (!input) {
    return '';
  }
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof Error) {
    return input.message;
  }
  if (typeof input === 'object') {
    return [
      input.message,
      input.error?.message,
      input.error?.data,
      input.data,
      input.payload?.error?.message,
      input.payload?.error?.data,
    ]
      .filter(Boolean)
      .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
      .join('\n');
  }
  return String(input);
}
