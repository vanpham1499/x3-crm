// Initial caller datagram observed from PC 26.9.10 on an isolated loopback
// server. Opaque header constants are pinned, not a general ZRTC implementation.
export function encodeCallerInit({ callerId, calleeId, callId, session }) {
  for (const id of [callerId, calleeId, callId]) {
    if (!Number.isInteger(id) || id <= 0 || id > 0xffffffff) throw Error('INVALID_ZRTC_ID');
  }
  if (typeof session !== 'string' || !session.length) throw Error('INVALID_ZRTC_SESSION');
  const bytes = Buffer.from(session, 'utf8');
  if (bytes.length > 1269) throw Error('ZRTC_SESSION_TOO_LARGE');
  const packet = Buffer.alloc(31 + bytes.length);
  packet[0] = 1; packet[1] = 126;
  packet.writeUInt32LE(callerId, 10);
  packet.writeUInt16LE(11, 18); packet[20] = 2;
  packet.writeUInt32LE(callId, 21); packet.writeUInt32LE(calleeId, 25);
  packet.writeUInt16LE(bytes.length, 29); bytes.copy(packet, 31);
  return packet;
}

// PC parser at 0x8934fa / response-11 branch 0x893810 in the pinned x86 build.
// The token is connection material: callers must never put it in diagnostics.
export function decodeCallerInitResponse(packet, expectedCallId) {
  if (!Buffer.isBuffer(packet) || packet.length < 25 || packet[0] !== 2 || packet[1] !== 126 ||
      packet.readUInt16LE(18) !== 11 || packet[20] !== 2) throw Error('INVALID_ZRTC_INIT_RESPONSE');
  const status = packet.readInt32LE(21);
  if (status !== 0) return {status};
  if (packet.length < 35 || packet.length !== 35 + packet.readUInt16LE(33)) throw Error('TRUNCATED_ZRTC_INIT_RESPONSE');
  const callId = packet.readUInt32LE(25);
  if (callId !== expectedCallId) throw Error('ZRTC_CALL_ID_MISMATCH');
  // The core stores the remaining string as packet+0x44. Its interpretation
  // has not been verified; do not label it as an IP address or an SRTP key.
  return {status,callId,token:packet.readUInt32LE(29),extra:packet.subarray(35).toString('utf8')};
}
