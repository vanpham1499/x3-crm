import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNativeCodec } from './native-codec.mjs';

test('handles fragmented and coalesced native packets without losing boundaries', () => {
  const codec = createNativeCodec(Buffer.alloc(16, 7));
  const first = { type: 'update', command: 'native-ready', data: { name: 'Tiếng Việt' } };
  const second = { type: 'response', command: 'listDevice', data: {} };
  const wire = codec.encode(first) + codec.encode(second);
  const packets = [];
  for (let i = 0; i < wire.length; i += 13) packets.push(...codec.push(Buffer.from(wire.slice(i, i + 13))));
  assert.deepEqual(packets, [first, second]);
  assert.deepEqual(codec.push(Buffer.from(wire)), [first, second]);
});

test('rejects malformed, oversized and wrong-key frames without exposing payloads', () => {
  const codec = createNativeCodec(Buffer.alloc(16, 7), { maxFrameBytes: 64 });
  assert.throws(() => codec.push(Buffer.from('not-hex$')), /NATIVE_FRAME_INVALID/);
  assert.throws(() => codec.push(Buffer.from('a'.repeat(66))), /NATIVE_FRAME_TOO_LARGE/);
  const other = createNativeCodec(Buffer.alloc(16, 9));
  assert.throws(() => codec.push(Buffer.from(other.encode({ a: 1 }))), /NATIVE_PACKET_INVALID/);
  assert.deepEqual(codec.push(Buffer.from(codec.encode({ ok: true }))), [{ ok: true }]);
});
