import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CallConnector } from './connector-client.mjs';

test('call connector trusts only loopback or the exact server-configured origin', () => {
  const saved = process.env.CALL_CONNECTOR_URL;
  const scope = { token: 'a'.repeat(64), owner: 'b'.repeat(64), accountId: 1, conversationId: '123' };
  try {
    delete process.env.CALL_CONNECTOR_URL;
    assert.equal(new CallConnector(scope).url, 'http://127.0.0.1:9250');
    assert.throws(() => new CallConnector({ ...scope, url: 'http://connector:9250' }));
    process.env.CALL_CONNECTOR_URL = 'http://connector:9250';
    assert.equal(new CallConnector(scope).url, 'http://connector:9250');
    assert.throws(() => new CallConnector({ ...scope, url: 'http://attacker.invalid:9250' }));
    assert.throws(() => new CallConnector({ ...scope, url: 'http://user:pass@connector:9250' }));
  } finally {
    if (saved === undefined) delete process.env.CALL_CONNECTOR_URL;
    else process.env.CALL_CONNECTOR_URL = saved;
  }
});
test('call signaling retains authenticated CRM sender without adding it to native packets', async () => {
  const original = globalThis.fetch;
  let body;
  globalThis.fetch = async (_url, options) => { body = JSON.parse(options.body); return Response.json({ type: 'recvSignal' }); };
  try {
    const crmSender = { userId: 42, name: 'Admin X3' };
    const connector = new CallConnector({ token: 'a'.repeat(64), owner: 'b'.repeat(64), accountId: 5, conversationId: '123', crmSender });
    await connector.signal({ type: 'sendSignal', command: 401, data: { callId: 987, calleeId: '123', codec: '[]', type: 1 } });
    assert.deepEqual(body.crmSender, crmSender);
    assert.equal(body.call.packet.data.crmSender, undefined);
    assert.equal(body.call.packet.data.callId, 987);
  } finally { globalThis.fetch = original; }
});
