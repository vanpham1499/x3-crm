import { spawn } from 'node:child_process';
import wrtc from '@roamhq/wrtc';
import { startRealtimeAudioClock } from './audio-clock.mjs';
import { validPcmFrame } from './pcm-frame.mjs';

// One audio session per isolated worker. No hardware audio device is selected.
// PulseAudio maps the two null sinks to the native engine's input/output.
export class BrowserAudio {
  constructor({ onFailure = () => {}, portMin = 41000, portMax = 41031, bridge = null } = {}) {
    this.closed = false;
    this.onFailure = onFailure;
    this.bridge = bridge;
    this.stats = { receivedFrames: 0, transmittedFrames: 0, droppedFrames: 0, underflows: 0, invalidInputFrames:0, receivedPeak: 0, capturedPeak: 0 };
    this.pc = new wrtc.RTCPeerConnection({ iceServers: [], portRange: { min: portMin, max: portMax } });
    this.source = new wrtc.nonstandard.RTCAudioSource();
    this.track = this.source.createTrack();
    this.pc.addTrack(this.track);
    this.pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(this.pc.connectionState) && !this.closed) this.fail('AUDIO_CONNECTION_LOST');
    };
    this.pc.ontrack = event => {
      if (event.track.kind !== 'audio' || this.sink) return this.fail('INVALID_AUDIO_TRACK');
      this.sink = new wrtc.nonstandard.RTCAudioSink(event.track);
      this.sink.ondata = data => this.receive(data);
    };
    this.queue = Buffer.alloc(0);
    const capture = chunk => {
      this.queue = Buffer.concat([this.queue, chunk]);
      if (this.queue.length > 48000 / 5 * 2) {
        const drop = Math.floor((this.queue.length - 9600) / 960) * 960;
        this.queue = this.queue.subarray(drop);
        this.stats.droppedFrames += drop / 960;
      }
    };
    if (bridge) {
      try { bridge.open(capture, code => this.fail(code)); }
      catch (error) { this.close(); throw error; }
    } else {
      this.capture = spawn('parec', ['--device=zalo_to_browser.monitor', '--raw', '--format=s16le', '--rate=48000', '--channels=1', '--latency-msec=20'], { stdio: ['ignore', 'pipe', 'ignore'] });
      this.capture.on('error', () => this.fail('AUDIO_CAPTURE_FAILED'));
      this.capture.on('exit', () => { if (!this.closed) this.fail('AUDIO_CAPTURE_STOPPED'); });
      this.capture.stdout.on('data', capture);
    }
    this.stopClock = startRealtimeAudioClock(() => {
      if (this.closed) return;
      try { this.bridge?.tick?.(); } catch { return this.fail('AUDIO_DECODE_FAILED'); }
      const samples = new Int16Array(480);
      // Two 20 ms frames absorb scheduler phase differences without replacing
      // a real frame with silence whenever an RTP packet arrives just late.
      if (!this.primed && this.queue.length >= 3840) this.primed = true;
      if (this.primed && this.queue.length >= 960) {
        for (let i = 0; i < 480; i++) samples[i] = this.queue.readInt16LE(i * 2);
        for (const sample of samples) this.stats.capturedPeak = Math.max(this.stats.capturedPeak, Math.abs(sample));
        this.queue = this.queue.subarray(960);
      } else if(this.primed) { this.stats.underflows++;this.primed=false; }
      this.source.onData({ samples, sampleRate: 48000, bitsPerSample: 16, channelCount: 1, numberOfFrames: 480 });
      this.stats.transmittedFrames++;
    }, code => this.fail(code));
  }
  receive(data) {
    if (this.closed) return;
    if (!validPcmFrame(data)) {
      this.stats.invalidInputFrames++;
      this.invalidInputStreak=(this.invalidInputStreak||0)+1;
      if(this.invalidInputStreak>=100)this.fail('AUDIO_FORMAT_UNSUPPORTED');
      return;
    }
    this.invalidInputStreak=0;
    data={...data,bitsPerSample:16};
    this.stats.receivedFormat = { bitsPerSample: data.bitsPerSample, sampleRate: data.sampleRate, channelCount: data.channelCount };
    const format = `${data.sampleRate}:${data.channelCount}`;
    for (const sample of data.samples) this.stats.receivedPeak = Math.max(this.stats.receivedPeak, Math.abs(sample));
    if (this.bridge) {
      try { this.bridge.write(data); this.stats.receivedFrames++; }
      catch { this.fail('AUDIO_FORMAT_UNSUPPORTED'); }
      return;
    }
    if (this.format !== format) {
      this.playback?.stdin.end();
      this.playback?.kill();
      this.format = format;
      const child = this.playback = spawn('pacat', ['--playback', '--device=browser_to_zalo', '--raw', '--format=s16le', `--rate=${data.sampleRate}`, `--channels=${data.channelCount}`, '--latency-msec=20'], { stdio: ['pipe', 'ignore', 'ignore'] });
      child.on('error', () => this.fail('AUDIO_PLAYBACK_FAILED'));
      child.stdin.on('error', () => { if (!this.closed && child === this.playback) this.fail('AUDIO_PLAYBACK_STOPPED'); });
    }
    // Bound latency rather than allowing queued microphone audio to grow forever.
    if (this.playback.stdin.writableLength > data.sampleRate * data.channelCount / 5 * 2) { this.stats.droppedFrames++; return; }
    this.playback.stdin.write(Buffer.from(data.samples.buffer, data.samples.byteOffset, data.samples.byteLength));
    this.stats.receivedFrames++;
  }
  async answer(offer, publicAddress) {
    if (offer?.type !== 'offer' || typeof offer.sdp !== 'string' || offer.sdp.length > 64000) throw Error('INVALID_AUDIO_OFFER');
    if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(publicAddress)) throw Error('INVALID_AUDIO_ADDRESS');
    await this.pc.setRemoteDescription(offer);
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    if (this.closed) throw Error('AUDIO_CONNECTION_LOST');
    if (this.pc.iceGatheringState !== 'complete') await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pc.onicegatheringstatechange = null; reject(Error('AUDIO_ICE_TIMEOUT')); }, 8000);
      this.pc.onicegatheringstatechange = () => { if (this.pc.iceGatheringState === 'complete') { clearTimeout(timer); this.pc.onicegatheringstatechange = null; resolve(); } };
    });
    // Explicit 1:1 UDP port mapping for this local worker. Remote deployments
    // require a reachable configured address/TURN; no public STUN service is used.
    return { type: 'answer', sdp: this.pc.localDescription.sdp.replace(/^(a=candidate:[^\r\n]+? UDP \d+ )[^ ]+( \d+ typ host.*)$/gim, `$1${publicAddress}$2`) };
  }
  fail(code) { if (!this.closed) { this.close(); this.onFailure(code); } }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.stopClock?.();
    this.sink?.stop(); this.track.stop(); this.pc.close();
    this.capture?.kill(); this.playback?.stdin.end(); this.playback?.kill();
    this.bridge?.close();
    this.queue = Buffer.alloc(0);
  }
}
