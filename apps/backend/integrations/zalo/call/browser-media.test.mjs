import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../../../../frontend/src/features/zalo-team/call-media.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const stream = () => {
  const track = { enabled: true, stopped: false, stop() { this.stopped = true; } };
  return { track, getTracks: () => [track], getAudioTracks: () => [track] };
};
function setup(capture) {
  let peer, output;
  class Peer extends EventTarget {
    constructor() { super(); peer = this; this.iceGatheringState = 'complete'; }
    addTrack(track) { this.track = track; return { replaceTrack: async next => { if (this.replaceError) throw Error('REPLACE_FAILED'); this.track = next; } }; }
    async createOffer() { if (this.offerError) throw Error('OFFER_FAILED'); return { type: 'offer', sdp: 'test' }; }
    async setLocalDescription(value) { this.localDescription = { toJSON: () => value }; }
    async setRemoteDescription(value) { this.remote = value; }
    close() { this.closed = true; }
  }
  class Audio {
    constructor() { output = this; }
    async play() { this.played = true; }
    pause() { this.paused = true; }
    remove() {}
    async setSinkId(id) { this.sinkId = id; }
  }
  const context = { exports: {}, RTCPeerConnection: Peer, Audio, MediaStream: class { constructor(tracks) { this.tracks = tracks; } },
    navigator: { mediaDevices: { getUserMedia: capture } }, AbortController, setTimeout, clearTimeout };
  vm.runInNewContext(code, context);
  const states = [];
  const media = new context.exports.CallMedia(state => states.push(state));
  return { media, peer, output, states };
}

test('hangup while permission is pending stops a late microphone stream', async () => {
  let allow;
  const mic = stream();
  const { media, peer } = setup(() => new Promise(resolve => { allow = resolve; }));
  const pending = media.offer(); media.close(); allow(mic);
  await assert.rejects(pending, /CALL_MEDIA_CLOSED/);
  assert.equal(mic.track.stopped, true); assert.equal(peer.closed, true);
});

test('mute persists across device changes, speaker routing and remote playback work', async () => {
  const first = stream(), second = stream(); let captures = 0;
  const { media, peer, output } = setup(async () => ++captures === 1 ? first : second);
  await media.offer(); media.setMuted(true);
  assert.equal(first.track.enabled, false);
  await media.setMicrophone('next');
  assert.equal(first.track.stopped, true); assert.equal(second.track.enabled, false);
  await media.setSpeaker('speaker'); assert.equal(output.sinkId, 'speaker');
  peer.ontrack({ track: { kind: 'audio' } });
  assert.equal(output.played, true);
  media.close(); media.close();
  assert.equal(second.track.stopped, true); assert.equal(output.srcObject, null);
});

test('failed device replacement stops new track and preserves current microphone', async () => {
  const first = stream(), second = stream(); let captures = 0;
  const { media, peer } = setup(async () => ++captures === 1 ? first : second);
  await media.offer(); peer.replaceError = true;
  await assert.rejects(media.setMicrophone('next'), /REPLACE_FAILED/);
  assert.equal(second.track.stopped, true); assert.equal(first.track.stopped, false);
  media.close();
});

test('SDP failure releases microphone and peer', async () => {
  const mic = stream(); const { media, peer } = setup(async () => mic);
  peer.offerError = true;
  await assert.rejects(media.offer(), /OFFER_FAILED/);
  assert.equal(mic.track.stopped, true); assert.equal(peer.closed, true);
});
