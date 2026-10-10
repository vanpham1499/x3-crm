// Internal connector API only. Browser clients cannot submit native packets.
// Mappings pinned to PC 26.9.10 OU7N.handleSendSignal.
export const SIGNAL_FIELDS = {
  401: ['calleeId', 'callId', 'codec', 'type'],
  416: ['calleeId', 'rtcpAddress', 'rtpAddress', 'codec', 'extendData', 'session', 'callId'],
  407: ['callerId', 'callId'],
  408: ['calleeId', 'callId'],
  402: ['callerId', 'callId', 'status', 'codec', 'extendData', 'rtcpAddress', 'rtpAddress', 'session'],
  405: ['toId', 'callId', 'callType'],
  406: ['callId', 'partnerId', 'status', 'data', 'duration', 'role'],
  409: ['toId', 'callId'],
};
export function validCall(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (!/^[a-f0-9-]{36}$/.test(value.sessionId || '')) return false;
  const keys = Object.keys(value).sort().join(',');
  if (['prepare', 'close'].includes(value.kind)) return keys === 'kind,sessionId';
  if (value.kind === 'poll') return keys === 'cursor,kind,sessionId' && Number.isSafeInteger(value.cursor) && value.cursor >= 0;
  if (value.kind !== 'signal' || keys !== 'kind,packet,sequence,sessionId' || !Number.isSafeInteger(value.sequence) || value.sequence < 1) return false;
  const p = value.packet, fields = p && Object.hasOwn(SIGNAL_FIELDS, p.command) ? SIGNAL_FIELDS[p.command] : null;
  return !!fields && p.type === 'sendSignal' && Object.keys(p).sort().join(',') === 'command,data,type' &&
    p.data && typeof p.data === 'object' && !Array.isArray(p.data) &&
    Object.keys(p.data).every(k => fields.includes(k)) &&
    (typeof p.data.callId === 'string' || Number.isSafeInteger(p.data.callId)) && /^\d{1,30}$/.test(String(p.data.callId)) && JSON.stringify(p).length < 16000;
}

// Exported to exercise the actual browser-side implementation with fake modules.
export async function callInPage({ expectedId, conversationId, call, fields }) {
  let require;
  const id = 'zalo-team-call-' + crypto.randomUUID();
  const chunk = [[id], { [id]: (m, e, r) => { require = r; } }, [[id]]];
  if (!Array.isArray(globalThis.webpackJsonp)) throw Error('WEB_CALL_NOT_READY');
  globalThis.webpackJsonp.push(chunk);
  if (!require) throw Error('WEB_CALL_NOT_READY');
  delete require.c[id]; delete require.m[id];
  globalThis.webpackJsonp.splice(globalThis.webpackJsonp.indexOf(chunk), 1);
  const get = k => require.c[k]?.exports || (require.m[k] ? require(k) : undefined);
  const fetcher = get('dThN')?.default, users = get('UiPd')?.default;
  if (String(fetcher?.userId) !== expectedId) throw Error('WEB_IDENTITY_MISMATCH');
  const key = '__x3TeamCallSession';
  let state = globalThis[key];
  if (state && Date.now() > state.expires) { state.dispose(); state = null; }
  if (call.kind === 'prepare') {
    if (state) {
      if (state.id !== call.sessionId || state.peer !== conversationId) throw Error('CALL_SESSION_BUSY');
      if (fetcher.callbackVideoCallEvent !== state.wrapper) throw Error('CALL_CALLBACK_CHANGED');
      state.expires = Date.now() + 30000;
      return state.metadata;
    }
    const visible = get('jDHv')?.ModuleContainer?.resolve(get('iZzu')?.ConvListController)?.getList({ key: get('3xbP')?.c });
    if (!/^\d+$/.test(conversationId) || (!visible?.includes(conversationId) && !globalThis.__zaloTeamPhonePeers?.allows(expectedId,conversationId))) throw Error('WEB_CONVERSATION_NOT_FOUND');
    if (conversationId === expectedId || conversationId === String(get('NDmK')?.default?.sendToMeId) ||
        !users || users.isBlocked(conversationId) || users.isOA(conversationId) || users.isZaloBot(conversationId)) throw Error('CALL_PEER_UNAVAILABLE');
    if (typeof fetcher.bindCallbackVideoCall !== 'function') throw Error('WEB_CALL_NOT_READY');
    const profile = uid => { const p = users.getMiniInfo(uid) || {}; return { id: uid, name: users.getDName(uid) || p.dName || '', avatar: users.getAvatar(uid) || p.avatar || '' }; };
    state = { id: call.sessionId, peer: conversationId, expires: Date.now() + 30000, callId: null, events: [], cursor: 0, requests: new Map(), previous: fetcher.callbackVideoCallEvent,
      metadata: { local: profile(expectedId), peer: profile(conversationId), clientVersion: get('NDmK')?.default?.apiVersion, signalingVerified: false } };
    state.wrapper = function(events, ...args) {
      // Preserve the connector's existing native event consumer.
      try { if (typeof state.previous === 'function') state.previous.call(this, events, ...args); }
      finally {
        if (globalThis[key] === state && Date.now() < state.expires && Array.isArray(events)) {
          for (const event of events) {
            if (!state.callId || String(event?.data?.callId) !== state.callId || event.act_type !== 'voip') continue;
            if (state.events.length >= 128) { state.overflow = true; break; }
            state.events.push({ cursor: ++state.cursor, event });
          }
        }
      }
    };
    state.dispose = () => {
      clearInterval(state.timer);
      if (fetcher.callbackVideoCallEvent === state.wrapper) fetcher.bindCallbackVideoCall(state.previous);
      if (globalThis[key] === state) delete globalThis[key];
      state.events.length = 0; state.requests.clear();
      if (state.callId && !state.endRequested) {
        state.endRequested = true;
        // Best effort on lease expiry/worker loss. The native worker still owns
        // its media cleanup. Never leave an outgoing session deliberately live.
        Promise.resolve().then(() => fetcher.sendEndCall(state.peer, state.callId)).catch(() => {});
      }
    };
    fetcher.bindCallbackVideoCall(state.wrapper);
    state.timer = setInterval(() => { if (Date.now() > state.expires) state.dispose(); }, 1000);
    globalThis[key] = state;
    return state.metadata;
  }
  if (!state || state.id !== call.sessionId || state.peer !== conversationId) throw Error('CALL_SESSION_NOT_FOUND');
  if (call.kind === 'close') { state.dispose(); return { closed: true }; }
  if (fetcher.callbackVideoCallEvent !== state.wrapper) throw Error('CALL_CALLBACK_CHANGED');
  state.expires = Date.now() + 30000;
  if (call.kind === 'poll') {
    if (state.overflow || call.cursor > state.cursor) throw Error('CALL_EVENT_GAP');
    state.events = state.events.filter(e => e.cursor > call.cursor);
    return { events: state.events, cursor: state.cursor };
  }
  const packet = call.packet, data = packet.data;
  const methods = { 401: 'requestCall', 416: 'sendRequestCall', 407: 'sendRingRingCall', 408: 'sendAnswerACKCall', 402: 'sendAnswerCall', 405: 'sendCancelCall', 406: 'sendLogEndCall', 409: 'sendEndCall' };
  const method = methods[packet.command];
  if (!method || typeof fetcher[method] !== 'function') throw Error('CALL_SIGNAL_UNSUPPORTED');
  const peerKey = fields[packet.command].find(k => ['calleeId', 'callerId', 'toId', 'partnerId'].includes(k));
  if (String(data[peerKey]) !== conversationId) throw Error('CALL_PEER_MISMATCH');
  if (packet.command === 401 && !state.callId) state.callId = String(data.callId);
  if (!state.callId || String(data.callId) !== state.callId) throw Error('CALL_ID_MISMATCH');
  const fingerprint = JSON.stringify(packet), previous = state.requests.get(call.sequence);
  if (previous) {
    if (previous.fingerprint !== fingerprint) throw Error('CALL_SIGNAL_CONFLICT');
    return previous.promise;
  }
  if (state.requests.size >= 64) throw Error('CALL_SIGNAL_LIMIT');
  if (packet.command === 409) state.endRequested = true;
  // Cache before dispatch, including rejection: a lost HTTP response must never
  // turn into a second request/call. No blind retries of signaling mutations.
  const promise = Promise.resolve().then(() => fetcher[method](...fields[packet.command].map(k => data[k])))
    .then(result => ({ type: 'recvSignal', command: packet.command, data: result }))
    .catch(error => ({ type: 'signalError', command: packet.command, error: 'ZALO_CALL_SIGNAL_FAILED',
      upstreamCode: String(error?.error_code ?? error?.code ?? 'UNKNOWN').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) }));
  state.requests.set(call.sequence, { fingerprint, promise });
  return promise;
}

export async function callSession(page, expectedId, { conversationId, call }) {
  const frame = page.frames().find(f => /^https:\/\/chat\.zalo\.me\//.test(f.url()));
  if (!frame || !validCall(call)) throw Error('WEB_CALL_NOT_READY');
  try { return await frame.evaluate(callInPage, { expectedId, conversationId, call, fields: SIGNAL_FIELDS }); }
  catch (error) {
    const code = error.message?.match(/\b(?:CALL|WEB)_[A-Z_]+\b/)?.[0];
    throw Error(code || 'WEB_CALL_OPERATION_FAILED');
  }
}
