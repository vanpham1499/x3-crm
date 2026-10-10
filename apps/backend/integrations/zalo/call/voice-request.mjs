import { randomInt } from 'node:crypto';

// PC 26.9.10 command 401 captured from the isolated core and accepted by Zalo.
// This is only session negotiation, not an invitation or a media connection.
export function createVoiceRequest(calleeId) {
  if (typeof calleeId !== 'string' || !/^[1-9]\d{0,29}$/.test(calleeId)) throw Error('INVALID_CALLEE_ID');
  return { type: 'sendSignal', command: 401, data: {
    calleeId, callId: randomInt(1, 0x80000000), codec: '[]\n', type: 1,
  } };
}
