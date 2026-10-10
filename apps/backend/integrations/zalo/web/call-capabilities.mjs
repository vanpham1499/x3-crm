// Read-only preflight. Presence of signaling methods does not prove that this
// Web session is accepted for calls, or that a media engine is connected.
export async function readCallCapabilities(page, expectedId, { conversationId }) {
  const frame = page.frames().find(f => /^https:\/\/chat\.zalo\.me\//.test(f.url()));
  if (!frame) throw Error('WEB_CALL_NOT_READY');
  return frame.evaluate(({ expectedId, conversationId }) => {
    let require;
    const id = 'zalo-team-call-capabilities-' + Date.now();
    const chunk = [[id], { [id]: (m, e, r) => { require = r; } }, [[id]]];
    if (!Array.isArray(globalThis.webpackJsonp)) throw Error('WEB_CALL_NOT_READY');
    globalThis.webpackJsonp.push(chunk);
    if (!require) throw Error('WEB_CALL_NOT_READY');
    delete require.c[id];
    delete require.m[id];
    globalThis.webpackJsonp.splice(globalThis.webpackJsonp.indexOf(chunk), 1);
    const get = k => require.c[k]?.exports || (require.m[k] ? require(k) : undefined);
    const fetcher = get('dThN')?.default;
    if (String(fetcher?.userId) !== expectedId) throw Error('WEB_IDENTITY_MISMATCH');
    const visible = get('jDHv')?.ModuleContainer
      ?.resolve(get('iZzu')?.ConvListController)?.getList({ key: get('3xbP')?.c });
    if ((!visible?.includes(conversationId) && !globalThis.__zaloTeamPhonePeers?.allows(expectedId,conversationId))) throw Error('WEB_CONVERSATION_NOT_FOUND');
    const names = [
      'requestCall', 'sendRequestCall', 'sendRingRingCall', 'sendAnswerCall',
      'sendAnswerACKCall', 'sendCancelCall', 'sendEndCall', 'sendLogEndCall',
      'bindCallbackVideoCall',
    ];
    return {
      canCall: false,
      reason: conversationId.startsWith('g') ? 'GROUP_CALL_NOT_IMPLEMENTED'
        : conversationId === expectedId ? 'SELF_CALL_UNAVAILABLE' : 'CALL_MEDIA_BRIDGE_NOT_CONNECTED',
      signalingMethods: Object.fromEntries(names.map(name => [name, typeof fetcher?.[name] === 'function'])),
      sessionCallingVerified: false,
      mediaConnected: false,
    };
  }, { expectedId, conversationId });
}
