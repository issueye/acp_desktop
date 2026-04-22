export async function handleSessionLifecycleFailure({
  error,
  runtime,
  client,
  removeConnectedSession,
  setError,
  trackEvent,
  trackError,
  eventName,
  eventProperties = {},
}) {
  const nextError = error instanceof Error ? error.message : String(error);
  setError(nextError);

  if (runtime) {
    removeConnectedSession(runtime.session.id);
  }
  if (client && !runtime) {
    await client.disconnect();
  }

  trackEvent(eventName, {
    ...eventProperties,
    success: 'false',
  });
  trackError(error instanceof Error ? error : new Error(nextError));
  throw error;
}

export async function initializeSessionClient(client, appVersion, protocolVersion) {
  return client.initialize({
    protocolVersion,
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
}

export function isAuthenticationRequiredSessionError(sessionError) {
  const errorMessage = sessionError instanceof Error ? sessionError.message : String(sessionError);
  return (
    errorMessage.toLowerCase().includes('authentication required') ||
    errorMessage.includes('-32000')
  );
}

export async function executeSessionActionWithAuth({
  client,
  availableAuthMethods = [],
  agentName,
  promptForAuthMethod,
  execute,
}) {
  try {
    return await execute();
  } catch (sessionError) {
    if (
      !isAuthenticationRequiredSessionError(sessionError) ||
      availableAuthMethods.length === 0
    ) {
      throw sessionError;
    }

    const selectedMethodId = await promptForAuthMethod(availableAuthMethods, agentName);
    await client.authenticate({
      methodId: selectedMethodId,
    });
    return await execute();
  }
}
