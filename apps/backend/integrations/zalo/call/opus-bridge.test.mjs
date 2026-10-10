import {test} from 'node:test';
import assert from 'node:assert/strict';
import audify from 'audify';
import {OpusBridge} from './opus-bridge.mjs';
test('browser 48 kHz PCM produces Opus consumable by the negotiated 16 kHz peer',()=>{
 const decoder=new audify.OpusDecoder(16000,1), frames=[];
 const bridge=new OpusBridge(packet=>frames.push(decoder.decode(packet,960)));
 bridge.active=true;
 for(let n=0;n<30;n++) {
  const samples=Int16Array.from({length:480},(_,i)=>Math.round(8000*Math.sin(2*Math.PI*440*(n*480+i)/48000)));
  bridge.write({samples,sampleRate:48000,channelCount:1,bitsPerSample:16});
 }
 assert.equal(frames.length,15);assert.ok(frames.every(f=>f.length===640));
 const pcm=Buffer.concat(frames).subarray(2000);let changes=0;
 for(let i=2;i<pcm.length;i+=2) if((pcm.readInt16LE(i)>=0)!==(pcm.readInt16LE(i-2)>=0))changes++;
 const frequency=changes/2/(pcm.length/2/16000);assert.ok(Math.abs(frequency-440)<15, String(frequency));
 bridge.close();
});
test('16 kHz Opus decodes to 48 kHz browser PCM without a device',()=>{
 const encoder=new audify.OpusEncoder(16000,1,audify.OpusApplication.OPUS_APPLICATION_VOIP);
 const bridge=new OpusBridge(()=>{});let size=0;
 bridge.open(pcm=>{size=pcm.length;},()=>{});bridge.active=true;
 bridge.receive(encoder.encode(Buffer.alloc(640),320));assert.equal(size,1920);
 bridge.close();bridge.close();
});
