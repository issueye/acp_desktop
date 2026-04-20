export const AUTHORIZATION_MODES = {
  MANUAL: 'manual',
  POPUP_AUTO_FIRST: 'popup_auto_first',
};

export function normalizeAuthorizationMode(value) {
  if (value === AUTHORIZATION_MODES.POPUP_AUTO_FIRST) {
    return AUTHORIZATION_MODES.POPUP_AUTO_FIRST;
  }
  return AUTHORIZATION_MODES.MANUAL;
}

export function getAutoConfirmOptionId(request, mode) {
  if (normalizeAuthorizationMode(mode) !== AUTHORIZATION_MODES.POPUP_AUTO_FIRST) {
    return '';
  }

  const options = Array.isArray(request?.options) ? request.options : [];
  if (options.length < 2) {
    return '';
  }

  return options[0]?.optionId ?? '';
}

export function buildPermissionRequestKey(request) {
  const sessionId = request?.sessionId ?? '';
  const toolCallId = request?.toolCall?.toolCallId ?? '';
  const optionId = Array.isArray(request?.options) ? request.options[0]?.optionId ?? '' : '';
  return [sessionId, toolCallId, optionId].join('::');
}
