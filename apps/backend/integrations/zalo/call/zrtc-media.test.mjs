import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeMediaPacket,decodeMediaPacket } from './zrtc-media.mjs';
test('PC packetMode 2 has five byte routing prefix',()=>{
 const payload=Buffer.from('807000010000014012345678dd860520548cbe189c5ff206a4','hex');
 const packet=encodeMediaPacket(0x11223344,payload);
 assert.equal(packet.subarray(0,5).toString('hex'),'0344332211');
 assert.deepEqual(decodeMediaPacket(packet,0x11223344),{kind:'rtp',payload});
 assert.throws(()=>decodeMediaPacket(packet,1),/TOKEN_MISMATCH/);
 assert.throws(()=>decodeMediaPacket(packet.subarray(0,25),0x11223344),/INVALID_ZRTC_MEDIA/);
});
