export const AUTHORIZATION_MODES = {
  MANUAL: 'manual',
  POPUP_AUTO_FIRST: 'popup_auto_first',
};

const AUTO_CONFIRM_ALLOW_KIND_PRIORITY = ['allow_once', 'allow_always'];

export function normalizeAuthorizationMode(value) {
  if (value === AUTHORIZATION_MODES.POPUP_AUTO_FIRST) {
    return AUTHORIZATION_MODES.POPUP_AUTO_FIRST;
  }
  return AUTHORIZATION_MODES.MANUAL;
}

function getPermissionOptions(request) {
  return Array.isArray(request?.options) ? request.options : [];
}

export function getAutoConfirmOptionId(request, mode) {
  if (normalizeAuthorizationMode(mode) !== AUTHORIZATION_MODES.POPUP_AUTO_FIRST) {
    return '';
  }

  const options = getPermissionOptions(request);

  for (const kind of AUTO_CONFIRM_ALLOW_KIND_PRIORITY) {
    const option = options.find((item) => item?.kind === kind && item?.optionId);
    if (option) {
      return option.optionId;
    }
  }

  return '';
}

export function buildPermissionRequestKey(request) {
  const sessionId = request?.sessionId ?? '';
  const toolCallId = request?.toolCall?.toolCallId ?? '';
  const optionId = getAutoConfirmOptionId(request, AUTHORIZATION_MODES.POPUP_AUTO_FIRST);
  return [sessionId, toolCallId, optionId].join('::');
}
