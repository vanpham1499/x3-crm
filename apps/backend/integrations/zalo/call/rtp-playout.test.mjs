import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RtpPlayout } from './rtp-playout.mjs';
import { OpusBridge } from './opus-bridge.mjs';
import audify from 'audify';

test('jitter buffer reorders across RTP wrap and preserves packet deadlines', () => {
  let now = 0; const played = [], base = 0xffffff00;
  const jitter = new RtpPlayout(p => { played.push(p); return 320; }, () => assert.fail('Unexpected loss'), () => now);
  jitter.push('a', base, 65534); now = 25; jitter.push('c', (base + 640) >>> 0, 0);
  now = 35; jitter.push('b', (base + 320) >>> 0, 65535);
  now = 59; jitter.tick(); assert.deepEqual(played, []);
  now = 60; jitter.tick(); now = 80; jitter.tick(); now = 100; jitter.tick();
  assert.deepEqual(played, ['a','b','c']); assert.equal(jitter.stats.reordered, 1);
});
test('lost audio uses concealment, and late packets cannot corrupt decoder order', () => {
  let now = 0; const played = [], losses = [];
  const jitter = new RtpPlayout(p => { played.push(p); return 320; }, n => losses.push(n), () => now);
  jitter.push('a',0,1); jitter.push('c',640,3);
  now=60;jitter.tick();now=80;jitter.tick();now=85;jitter.push('late b',320,2);now=100;jitter.tick();
  assert.deepEqual(played,['a','c']);assert.deepEqual(losses,[320]);assert.equal(jitter.stats.late,1);
  jitter.close(); assert.equal(jitter.packets.size,0);
});
test('60 ms packets do not advance as 20 ms packets',()=>{
  let now=0;const played=[];const jitter=new RtpPlayout(p=>{played.push(p);return 960;},()=>assert.fail('Unexpected PLC'),()=>now);
  jitter.push('a',0,1);jitter.push('b',960,2);now=60;jitter.tick();now=100;jitter.tick();assert.deepEqual(played,['a']);now=120;jitter.tick();assert.deepEqual(played,['a','b']);
});
test('Opus PLC produces correctly sized audio for one missing 20 ms packet',()=>{
  const encoder=new audify.OpusEncoder(48000,1,audify.OpusApplication.OPUS_APPLICATION_VOIP);
  const pcm=Buffer.alloc(1920);for(let i=0;i<960;i++)pcm.writeInt16LE(Math.round(2000*Math.sin(2*Math.PI*440*i/48000)),i*2);
  const bridge=new OpusBridge(()=>{});bridge.active=true;const output=[];bridge.open(data=>output.push(data));
  bridge.receive(encoder.encode(pcm,960));bridge.conceal(320);
  assert.equal(output[1].length,1920);assert.ok(output[1].some(byte=>byte!==0));bridge.close();
});
