import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceRequest } from './voice-request.mjs';
import { validCall } from '../web/call-session.mjs';

test('voice request preserves large peer IDs as strings and fits the native int32 call ID', () => {
  const request = createVoiceRequest('7516398194504291479');
  assert.equal(request.data.calleeId, '7516398194504291479');
  assert.ok(Number.isSafeInteger(request.data.callId) && request.data.callId > 0 && request.data.callId <= 0x7fffffff);
  assert.equal(validCall({ kind: 'signal', sequence: 1, sessionId: 'd21f4ef9-4b08-4914-bb86-e3f40602a246', packet: request }), true);
});
test('voice request rejects number peer IDs instead of rounding them', () => {
  for (const value of [7516398194504291479, '', '0', '-1', '1e20', null]) assert.throws(() => createVoiceRequest(value), /INVALID_CALLEE_ID/);
});
