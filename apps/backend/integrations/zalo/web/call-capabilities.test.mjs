import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCallCapabilities } from './call-capabilities.mjs';
import { validCommand } from './guards.mjs';

test('call preflight requires account/conversation scope and rejects call payloads', () => {
  const body = { action: 'call-capabilities', owner: 'a'.repeat(64), accountId: 1, conversationId: '222' };
  assert.ok(validCommand(body));
  assert.ok(!validCommand({ ...body, accountId: undefined }));
  assert.ok(!validCommand({ ...body, conversationId: undefined }));
  assert.ok(!validCommand({ ...body, calleeId: '333' }));
  assert.ok(!validCommand({ ...body, action: 'call-start' }));
});

test('preflight is read-only, refuses identity/inbox mismatch and never claims call readiness', async () => {
  let calls = 0;
  const names = ['requestCall', 'sendRequestCall', 'sendRingRingCall', 'sendAnswerCall', 'sendAnswerACKCall', 'sendCancelCall', 'sendEndCall', 'sendLogEndCall', 'bindCallbackVideoCall'];
  const fetcher = { userId: '111', ...Object.fromEntries(names.map(name => [name, () => { calls++; }])) };
  const modules = {
    dThN: { default: fetcher },
    jDHv: { ModuleContainer: { resolve: () => ({ getList: () => ['111', '222', 'g333'] }) } },
    iZzu: { ConvListController: {} }, '3xbP': { c: 'all' },
  };
  const require = () => { throw Error('UNEXPECTED_MODULE_LOAD'); };
  require.c = Object.fromEntries(Object.entries(modules).map(([k, exports]) => [k, { exports }]));
  require.m = {};
  const previous = globalThis.webpackJsonp;
  globalThis.webpackJsonp = [];
  globalThis.webpackJsonp.push = function (chunk) {
    Array.prototype.push.call(this, chunk);
    Object.values(chunk[1])[0]({}, {}, require);
  };
  const page = { frames: () => [{ url: () => 'https://chat.zalo.me/', evaluate: (fn, args) => fn(args) }] };
  try {
    const result = await readCallCapabilities(page, '111', { conversationId: '222' });
    assert.equal(result.canCall, false);
    assert.equal(result.sessionCallingVerified, false);
    assert.ok(Object.values(result.signalingMethods).every(Boolean));
    await assert.rejects(readCallCapabilities(page, '999', { conversationId: '222' }), /WEB_IDENTITY_MISMATCH/);
    await assert.rejects(readCallCapabilities(page, '111', { conversationId: '999' }), /WEB_CONVERSATION_NOT_FOUND/);
    assert.equal((await readCallCapabilities(page, '111', { conversationId: '111' })).reason, 'SELF_CALL_UNAVAILABLE');
    assert.equal((await readCallCapabilities(page, '111', { conversationId: 'g333' })).reason, 'GROUP_CALL_NOT_IMPLEMENTED');
    assert.equal(calls, 0);
    assert.equal(globalThis.webpackJsonp.length, 0);
  } finally { globalThis.webpackJsonp = previous; }
});
