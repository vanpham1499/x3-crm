import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SendReceipts } from './send.mjs';
import { SenderAttribution } from './sender-attribution.mjs';
import { validCommand } from './guards.mjs';

const owner = 'a'.repeat(64), sender = { userId: 42, name: 'Nguyễn Duy Anh' };
const body = { action: 'send-text', owner, accountId: 5, conversationId: 'g123',
  requestId: '11111111-1111-4111-8111-111111111111', text: 'fixture', crmSender: sender };
const message = { id: '456', clientId: '123', mine: true, sender: { id: '900' } };
async function fixture(run) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zt-sender-'));
  try { await run(root); } finally {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('zt-sender-'));
    await fs.rm(root, { recursive: true, force: true });
  }
}
test('sender is durable before native send, retained across restart and duplicate requests', () => fixture(async root => {
  let count = 0;
  const adapter = async (_, args) => {
    if (args.phase === 'prepare') return { clientId: '123' };
    const mapped = await new SenderAttribution(path.join(root, 'senders')).decorate(owner, '900', 'g123', { messages: [message] });
    assert.deepEqual(mapped.messages[0].crmSender, sender);
    count++;
    return { status: 'sent', messageId: '456' };
  };
  const result = await new SendReceipts(root, adapter).send({}, '900', body);
  assert.deepEqual(result.crmSender, sender);
  const retried = await new SendReceipts(root, adapter).send({}, '900', { ...body, crmSender: { ...sender, name: 'Tên mới' } });
  assert.deepEqual(retried.crmSender, sender);
  assert.equal(count, 1);
  await assert.rejects(new SendReceipts(root, adapter).send({}, '900', { ...body, crmSender: { userId: 43, name: 'Người khác' } }), /CONFLICT/);
}));
test('native mobile messages stay unlabelled; owner, sender, conversation and client ID are exact', () => fixture(async root => {
  const index = new SenderAttribution(root);
  await index.record(owner, '900', 'g123', '123', sender);
  for (const [o, account, conversation, m] of [
    [owner, '900', 'g123', { ...message, clientId: '999' }],
    ['b'.repeat(64), '900', 'g123', message],
    [owner, '901', 'g123', message],
    [owner, '900', 'g124', message],
    [owner, '900', 'g123', { ...message, mine: false, sender: { id: '901' } }],
  ]) {
    const result = await index.decorate(o, account, conversation, { messages: [{ ...m, crmSender: sender }] });
    assert.equal(result.messages[0].crmSender, undefined);
  }
  // Another linked account observing the same group sees the original CRM sender.
  const group = await index.decorate(owner, '901', 'g123', { messages: [{ ...message, mine: false }] });
  assert.deepEqual(group.messages[0].crmSender, sender);
  await assert.rejects(index.record(owner, '900', 'g123', '123', { userId: 43, name: 'Other' }), /CONFLICT/);
}));
test('lost acknowledgement keeps attribution without sending twice', () => fixture(async root => {
  let writes = 0;
  const adapter = async (_, args) => {
    if (args.phase === 'prepare') return { clientId: '123' };
    if (args.phase === 'check') return { status: 'sent', messageId: '456' };
    writes++; throw Error('lost response');
  };
  assert.equal((await new SendReceipts(root, adapter).send({}, '900', body)).status, 'unknown');
  const result = await new SendReceipts(root, adapter).send({}, '900', body);
  assert.equal(result.status, 'sent'); assert.deepEqual(result.crmSender, sender); assert.equal(writes, 1);
}));
test('text, sticker and media all accept only bounded trusted sender metadata', () => {
  assert.ok(validCommand(body));
  assert.ok(validCommand({ ...body, action: 'send-sticker', text: undefined, sticker: { id: 1, categoryId: 0 } }));
  assert.ok(validCommand({ ...body, action: 'send-media', text: undefined, media: { uploadId: body.requestId } }));
  for (const crmSender of [null, {}, { ...sender, userId: -1 }, { ...sender, name: '' }, { ...sender, name: 'x'.repeat(256) }, { ...sender, admin: true }])
    assert.equal(validCommand({ ...body, crmSender }), false);
});
test('outgoing calls use exact call ID, never message IDs, time, mine flag or incoming calls', () => fixture(async root => {
  const index = new SenderAttribution(root);
  await index.record(owner, '900', '123', '987', sender, 'call');
  const call = { ...message, kind: 'call', mine: false, call: { id: '987', direction: 'outgoing' } };
  assert.deepEqual((await index.decorate(owner, '900', '123', { messages: [call] })).messages[0].crmSender, sender);
  for (const m of [
    { ...call, call: { id: '987', direction: 'incoming' } },
    { ...call, call: { id: '986', direction: 'outgoing' } },
    { ...call, call: { direction: 'outgoing' } },
    { ...message, clientId: '987' },
  ]) assert.equal((await index.decorate(owner, '900', '123', { messages: [m] })).messages[0].crmSender, undefined);
  assert.equal((await index.decorate(owner, '901', '123', { messages: [call] })).messages[0].crmSender, undefined);
}));
