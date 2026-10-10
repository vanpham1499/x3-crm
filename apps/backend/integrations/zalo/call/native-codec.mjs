import { createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import path from 'node:path';
import { readAsarEntry } from '../shared/asar.mjs';

const MAIN_SHA256 = '927aaaabaaac16fcb280c538f375cd822bc6deb81319c5d65a5c3e29e6abac09';
export const CALL_SHA256 = '55cee16dc74bb1a592f0683b4b805f3af383d56eeade3e69a605a1e2480be9c9';

// Read only this build's IPC transport constant. Never evaluate the vendor bundle,
// load account profiles, export the constant, or include it in diagnostics.
export function readTransportKey(installation) {
  const main = readAsarEntry(path.join(installation, 'resources', 'app.asar'), 'main-dist/main.js');
  if (createHash('sha256').update(main).digest('hex') !== MAIN_SHA256)
    throw new Error('UNVERIFIED_NATIVE_BUILD');
  const matches = [...main.toString().matchAll(/callV2TransportAesKey\s*:\s*"([A-Za-z0-9+/=]+)"/g)];
  if (matches.length !== 1) throw new Error('NATIVE_TRANSPORT_KEY_UNAVAILABLE');
  const key = Buffer.from(matches[0][1], 'base64');
  if (key.length !== 16) throw new Error('NATIVE_TRANSPORT_KEY_INVALID');
  return key;
}

// This cipher/framing mirrors the pinned native IPC only. It must not be used as
// authentication/encryption for a network-facing Team API.
export function createNativeCodec(key, { maxFrameBytes = 1024 * 1024 } = {}) {
  if (!Buffer.isBuffer(key) || key.length !== 16) throw new Error('INVALID_KEY');
  let pending = '';
  return {
    encode(packet) {
      const cipher = createCipheriv('aes-128-cbc', key, Buffer.alloc(16));
      const frame = Buffer.concat([cipher.update(JSON.stringify(packet)), cipher.final()]).toString('hex');
      if (frame.length > maxFrameBytes) throw new Error('NATIVE_FRAME_TOO_LARGE');
      return frame + '$';
    },
    push(chunk) {
      const packets = [];
      for (const part of chunk.toString('ascii').split(/(?<=\$)/)) {
        pending += part;
        if (pending.length > maxFrameBytes + 1) { pending = ''; throw new Error('NATIVE_FRAME_TOO_LARGE'); }
        if (!pending.endsWith('$')) continue;
        const frame = pending.slice(0, -1);
        pending = '';
        if (!frame.length) continue;
        if (!/^(?:[a-fA-F0-9]{32})+$/.test(frame)) throw new Error('NATIVE_FRAME_INVALID');
        try {
          const decipher = createDecipheriv('aes-128-cbc', key, Buffer.alloc(16));
          const json = Buffer.concat([decipher.update(Buffer.from(frame, 'hex')), decipher.final()]).toString().replace(/\0/g, '');
          const packet = JSON.parse(json);
          if (!packet || typeof packet !== 'object' || Array.isArray(packet)) throw new Error();
          packets.push(packet);
        } catch { throw new Error('NATIVE_PACKET_INVALID'); }
      }
      return packets;
    },
  };
}
