// PC 26.9.10 packetMode 2: one type byte + little-endian connection token.
// RTP remains network byte order inside the SRTP payload.
export function encodeMediaPacket(token, payload, kind = 'rtp') {
  if (!Number.isInteger(token) || token < 1 || token > 0xffffffff) throw Error('INVALID_ZRTC_TOKEN');
  if (!Buffer.isBuffer(payload) || payload.length < (kind === 'rtp' ? 22 : 8) || payload.length > 1295) throw Error('INVALID_ZRTC_MEDIA');
  if (!['rtp','rtcp'].includes(kind)) throw Error('INVALID_ZRTC_MEDIA_KIND');
  const prefix=Buffer.alloc(5);prefix[0]=kind==='rtp'?3:5;prefix.writeUInt32LE(token,1);
  return Buffer.concat([prefix,payload]);
}
export function decodeMediaPacket(packet, token) {
  if (!Buffer.isBuffer(packet) || packet.length < 13 || packet.length > 1300 || ![3,5].includes(packet[0])) throw Error('INVALID_ZRTC_MEDIA');
  if (packet.readUInt32LE(1)!==token) throw Error('ZRTC_TOKEN_MISMATCH');
  if (packet[0]===3 && packet.length<27) throw Error('INVALID_ZRTC_MEDIA');
  return {kind:packet[0]===3?'rtp':'rtcp',payload:packet.subarray(5)};
}

// Native parser 0x89369d: server audio type 4 carries no routing token.
// Validate UDP source before this decoder, then authenticate SRTP before use.
export function decodeIncomingMedia(packet, token) {
  if (!Buffer.isBuffer(packet) || packet.length > 1300) throw Error('INVALID_ZRTC_MEDIA');
  if (packet[0] === 4 && packet.length >= 23) return {kind:'rtp',payload:packet.subarray(1)};
  if (packet[0] === 5) return decodeMediaPacket(packet,token);
  throw Error('INVALID_ZRTC_MEDIA');
}
