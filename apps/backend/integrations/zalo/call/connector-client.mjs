import { randomUUID } from 'node:crypto';
import { validCall, SIGNAL_FIELDS } from '../web/call-session.mjs';

export class CallConnector {
  constructor({ url = process.env.CALL_CONNECTOR_URL || 'http://127.0.0.1:9250', token, owner, accountId, conversationId, crmSender }) {
    if (!/^[a-f0-9]{64}$/.test(token) || !/^[a-f0-9]{64}$/.test(owner) ||
      !Number.isSafeInteger(accountId) || accountId < 1 || !/^\d{1,30}$/.test(conversationId)) throw Error('INVALID_CALL_SCOPE');
    const endpoint = new URL(url);
    const configured = process.env.CALL_CONNECTOR_URL;
    const trusted = configured ? endpoint.origin === new URL(configured).origin : ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname);
    if (!trusted || !['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw Error('LOCAL_CALL_CONNECTOR_REQUIRED');
    this.url = endpoint.origin; this.token = token;
    this.scope = { owner, accountId, conversationId, ...(crmSender ? { crmSender } : {}) }; this.sessionId = randomUUID();
    this.sequence = 0; this.cursor = 0; this.closed = false;
  }
  async command(call) {
    if (this.closed) throw Error('CALL_CONNECTOR_CLOSED');
    call = { ...call, sessionId: this.sessionId };
    if (!validCall(call)) throw Error('INVALID_CALL_PACKET');
    const response = await fetch(this.url + '/command', { method: 'POST', redirect: 'error',
      headers: { Authorization: 'Bearer ' + this.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...this.scope, action: 'call-session', call }), signal: AbortSignal.timeout(12000) });
    const value = await response.json();
    if (!response.ok || value.error) {
      const error = Error(value.error || 'CALL_CONNECTOR_FAILED');
      error.upstreamCode = value.upstreamCode; throw error;
    }
    return value;
  }
  prepare() { return this.command({ kind: 'prepare' }); }
  signal(packet) { return this.command({ kind: 'signal', sequence: ++this.sequence, packet }); }
  async poll(deliver) {
    const value = await this.command({ kind: 'poll', cursor: this.cursor });
    // Advance only after every event reaches the owned native engine.
    for (const item of value.events) await deliver(item.event);
    this.cursor = value.cursor;
  }
  async close() {
    if (this.closed) return;
    try { await this.command({ kind: 'close' }); }
    finally { this.closed = true; this.token = ''; }
  }
}

export function attachNativeRelay(native, connector, onFailure) {
  let stopped = false, queue = Promise.resolve(), timer, waiting = 0;
  const fail = error => { if (!stopped) { stop(); onFailure(error); } };
  const receive = packet => {
    if (stopped || packet.type !== 'sendSignal') return;
    const fields = SIGNAL_FIELDS[packet.command];
    if (!fields || !packet.data) return fail(Error('CALL_SIGNAL_UNSUPPORTED'));
    packet = { type: 'sendSignal', command: packet.command,
      data: Object.fromEntries(fields.filter(k => packet.data[k] !== undefined).map(k => [k, packet.data[k]])) };
    // Sequence serially like the PC request queue; never retry a mutation.
    if (++waiting > 32) return fail(Error('CALL_SIGNAL_BACKPRESSURE'));
    queue = queue.then(async () => {
      if (stopped) return;
      const response = await connector.signal(packet);
      if (!stopped) native.receiveSignal(response);
    }).catch(fail).finally(() => { waiting--; });
  };
  const poll = async () => {
    try { await connector.poll(event => { if (!stopped) native.receiveControl(event); }); }
    catch (error) { fail(error); }
    if (!stopped) timer = setTimeout(poll, 250);
  };
  const nativeFailure = code => fail(Error(code));
  function stop() { stopped = true; clearTimeout(timer); native.off('packet', receive); native.off('failure', nativeFailure); }
  native.on('packet', receive); native.on('failure', nativeFailure);
  timer = setTimeout(poll, 0);
  return stop;
}
