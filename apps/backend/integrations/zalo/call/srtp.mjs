import { createCipheriv, createHmac, timingSafeEqual } from 'node:crypto';

// RFC 3711 AES_CM_128_HMAC_SHA1_80, KDR=0, no MKI. Verified against the
// pinned PC core with a dummy session. This is the media cipher, not ZRTC framing.
export function deriveSrtpKeys(master) {
  if (!Buffer.isBuffer(master) || master.length !== 30) throw Error('INVALID_SRTP_MASTER');
  const derive = (label, length) => {
    const iv = Buffer.alloc(16); master.copy(iv, 0, 16); iv[7] ^= label;
    const cipher = createCipheriv('aes-128-ctr', master.subarray(0, 16), iv);
    return Buffer.concat([cipher.update(Buffer.alloc(length)), cipher.final()]);
  };
  return { encryption: derive(0, 16), authentication: derive(1, 20), salt: derive(2, 14) };
}

// Core 0x8e9b60 uses session.substr(0, profileKeyLength) when no explicit
// srtpKey is configured. Reject unsupported profiles instead of downgrading.
export function masterFromSession(session, config = {}) {
  if (config.srtpMode !== 1 || config.srtpNoSeq || config.srtpRTCP) throw Error('UNSUPPORTED_SRTP_PROFILE');
  const source = config.srtpKey || session;
  if (typeof source !== 'string' || !/^[\x21-\x7e]+$/.test(source) || source.length < 30 || (config.srtpKey && source.length !== 30))
    throw Error('INVALID_SRTP_KEY_SOURCE');
  return Buffer.from(source.slice(0, 30), 'ascii');
}

function header(packet) {
  if (!Buffer.isBuffer(packet) || packet.length < 12 || packet.length > 65535 || packet[0] >>> 6 !== 2) throw Error('INVALID_RTP_PACKET');
  let length = 12 + (packet[0] & 15) * 4;
  if (length > packet.length) throw Error('INVALID_RTP_HEADER');
  if (packet[0] & 16) {
    if (length + 4 > packet.length) throw Error('INVALID_RTP_EXTENSION');
    length += 4 + packet.readUInt16BE(length + 2) * 4;
    if (length > packet.length) throw Error('INVALID_RTP_EXTENSION');
  }
  return { length, seq: packet.readUInt16BE(2), ssrc: packet.readUInt32BE(8) };
}

function indexFor(highest, seq) {
  if (highest === undefined) return seq;
  const last = highest % 65536;
  let roc = Math.floor(highest / 65536);
  if (last < 32768 && seq - last > 32768) roc--;
  else if (last >= 32768 && last - seq > 32768) roc++;
  if (roc < 0 || roc > 0xffffffff) throw Error('SRTP_INDEX_EXHAUSTED');
  return roc * 65536 + seq;
}

export class SrtpContext {
  #keys; #send = new Map(); #receive = new Map();
  constructor(master) { this.#keys = deriveSrtpKeys(master); }
  #check() { if (!this.#keys) throw Error('SRTP_CLOSED'); }
  #crypt(packet, info, index) {
    const iv = Buffer.alloc(16); this.#keys.salt.copy(iv);
    const mask = Buffer.alloc(16); mask.writeUInt32BE(info.ssrc, 4); mask.writeUIntBE(index, 8, 6);
    for (let i = 0; i < 16; i++) iv[i] ^= mask[i];
    const cipher = createCipheriv('aes-128-ctr', this.#keys.encryption, iv);
    return Buffer.concat([packet.subarray(0, info.length), cipher.update(packet.subarray(info.length)), cipher.final()]);
  }
  #tag(packet, index) {
    const roc = Buffer.alloc(4); roc.writeUInt32BE(Math.floor(index / 65536));
    return createHmac('sha1', this.#keys.authentication).update(packet).update(roc).digest().subarray(0, 10);
  }
  protect(packet) {
    this.#check(); const info = header(packet), highest = this.#send.get(info.ssrc);
    if (highest === undefined && this.#send.size >= 8) throw Error('SRTP_STREAM_LIMIT');
    const index = indexFor(highest, info.seq);
    // Retransmit the existing protected datagram; never reuse an IV with new data.
    if (highest !== undefined && index <= highest) throw Error('SRTP_SEND_SEQUENCE_REUSED');
    const encrypted = this.#crypt(packet, info, index);
    this.#send.set(info.ssrc, index);
    return Buffer.concat([encrypted, this.#tag(encrypted, index)]);
  }
  unprotect(packet) {
    this.#check();
    if (!Buffer.isBuffer(packet) || packet.length < 22) throw Error('INVALID_SRTP_PACKET');
    const encrypted = packet.subarray(0, -10), info = header(encrypted), state = this.#receive.get(info.ssrc);
    if (!state && this.#receive.size >= 8) throw Error('SRTP_STREAM_LIMIT');
    const index = indexFor(state?.highest, info.seq);
    if (!timingSafeEqual(this.#tag(encrypted, index), packet.subarray(-10))) throw Error('SRTP_AUTH_FAILED');
    const delta = state ? index - state.highest : 1;
    if (state && (delta <= -64 || (delta <= 0 && state.window & (1n << BigInt(-delta))))) throw Error('SRTP_REPLAY');
    const plain = this.#crypt(encrypted, info, index);
    if (plain[0] & 32) {
      const padding = plain.at(-1);
      if (!padding || padding > plain.length - info.length) throw Error('INVALID_RTP_PADDING');
    }
    const window = !state || delta >= 64 ? 1n : delta > 0 ? ((state.window << BigInt(delta)) | 1n) & ((1n << 64n) - 1n) : state.window | (1n << BigInt(-delta));
    this.#receive.set(info.ssrc, { highest: Math.max(state?.highest ?? index, index), window });
    return plain;
  }
  close() {
    if (this.#keys) for (const value of Object.values(this.#keys)) value.fill(0);
    this.#keys = null; this.#send.clear(); this.#receive.clear();
  }
}
