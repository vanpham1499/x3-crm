import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validPcmFrame } from './pcm-frame.mjs';
test('rejects observed corrupt startup metadata while accepting the following valid frame',()=>{
 const frame={bitsPerSample:2.727448393343e-312,sampleRate:16000,channelCount:1,samples:new Int16Array(160)};
 assert.equal(validPcmFrame(frame),false);assert.equal(validPcmFrame({...frame,bitsPerSample:16}),true);
});
test('validates actual typed samples and duration instead of trusting native metadata',()=>{
 const frame={bitsPerSample:16,sampleRate:48000,channelCount:1,samples:new Int16Array(480)};
 assert.equal(validPcmFrame(frame),true);
 assert.equal(validPcmFrame({...frame,samples:new Uint8Array(960)}),false);
 assert.equal(validPcmFrame({...frame,samples:new Int16Array(400)}),false);
 assert.equal(validPcmFrame({...frame,channelCount:2,samples:new Int16Array(960)}),true);
});
