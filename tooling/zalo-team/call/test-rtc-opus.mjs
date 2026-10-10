// Isolated WebRTC + Opus roundtrip. No account, microphone, speaker or Zalo call.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { callDependency } from './dependencies.mjs';
const wrtc = callDependency('@roamhq/wrtc');
import { BrowserAudio } from '../../../apps/backend/integrations/zalo/call/rtc-audio.mjs';
import { OpusBridge } from '../../../apps/backend/integrations/zalo/call/opus-bridge.mjs';
import { startRealtimeAudioClock } from '../../../apps/backend/integrations/zalo/call/audio-clock.mjs';
const jitterTest=process.argv.includes('--jitter');let sequence=0;
const bridge = new OpusBridge(packet => {
  if(!jitterTest)return bridge.receive(packet);
  const seq=sequence++, timestamp=(seq*320)>>>0;
  if(seq%23===12)return;
  setTimeout(()=>bridge.receiveNetwork(packet,timestamp,seq&65535),[0,35,5,25,0][seq%5]);
}); bridge.active = true;
let failure, sink, stop, received = 0, peak = 0, sampleIndex = 0;
const server = new BrowserAudio({ bridge, onFailure: code => { failure = code; } });
server.receive({bitsPerSample:2.727448393343e-312,sampleRate:16000,channelCount:1,samples:new Int16Array(160)});
assert.equal(server.closed,false); // observed invalid first callback must not kill ICE
const peer = new wrtc.RTCPeerConnection({ iceServers: [] });
const source = new wrtc.nonstandard.RTCAudioSource(), track = source.createTrack(); peer.addTrack(track);
peer.ontrack = event => {
  sink = new wrtc.nonstandard.RTCAudioSink(event.track);
  sink.ondata = data => { received++; for (const sample of data.samples) peak = Math.max(peak, Math.abs(sample)); };
};
let code = 0;
try {
  await peer.setLocalDescription(await peer.createOffer());
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('ICE_TIMEOUT')), 5000);
    const check = () => { if (peer.iceGatheringState === 'complete') { clearTimeout(timeout); resolve(); } };
    peer.onicegatheringstatechange = check; check();
  });
  await peer.setRemoteDescription(await server.answer(peer.localDescription, '127.0.0.1'));
  stop = startRealtimeAudioClock(() => {
    const samples = new Int16Array(480);
    for (let i = 0; i < 480; i++) samples[i] = Math.round(2000 * Math.sin(2 * Math.PI * 440 * sampleIndex++ / 48000));
    source.onData({ samples, sampleRate: 48000, bitsPerSample: 16, channelCount: 1, numberOfFrames: 480 });
  }, value => { failure = value; });
  await new Promise(resolve => setTimeout(resolve, 5000));
  assert.equal(failure, undefined); assert.equal(peer.connectionState, 'connected');
  assert.ok(received >= 450 && peak > 1000);
  assert.ok(server.stats.droppedFrames < 20, `Unexpected playout drops: ${server.stats.droppedFrames}`);
  if(jitterTest){assert.ok(bridge.playout.stats.reordered>0);assert.ok(bridge.playout.stats.concealed>0);assert.equal(server.stats.underflows,0);}
  const proof = { synthetic: true, realZaloCall: false, jitterTest, receivedFrames: received, peak, worker: server.stats, playout:bridge.playout.stats };
  fs.writeFileSync('.local/zalo-call-assets/'+(jitterTest?'rtc-opus-jitter-proof.json':'rtc-opus-proof.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
} catch (error) { code = 1; console.error(error.message); }
finally { stop?.(); sink?.stop(); track.stop(); peer.close(); server.close(); }
// wrtc keeps a native dispatcher alive after its peers close on some builds.
setTimeout(() => process.exit(code), 100);
