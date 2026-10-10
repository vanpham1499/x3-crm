import audify from 'audify';
import { RtpPlayout } from './rtp-playout.mjs';

// Codec only: no RtAudio object, OS microphone, speaker or virtual driver.
// BrowserAudio owns WebRTC PCM; Opus handles the negotiated 16 kHz clock while
// the decoder produces 48 kHz PCM for the browser's 10 ms source frames.
export class OpusBridge {
  constructor(send) {
    this.send=send;this.closed=false;this.active=false;this.pending=Buffer.alloc(0);
    this.decoder=new audify.OpusDecoder(48000,1);
    this.stats={encoded:0,decoded:0};
    this.playout=new RtpPlayout(payload=>this.receive(payload),samples=>this.conceal(samples));
  }
  open(capture,onFailure) { this.capture=capture;this.onFailure=onFailure; }
  write(data) {
    if(this.closed || !this.active) return;
    if(data.bitsPerSample!==16 || ![8000,12000,16000,24000,48000].includes(data.sampleRate) || ![1,2].includes(data.channelCount)) throw Error('OPUS_PCM_FORMAT');
    if(this.rate!==data.sampleRate) {
      this.rate=data.sampleRate;this.pending=Buffer.alloc(0);
      this.encoder=new audify.OpusEncoder(this.rate,1,audify.OpusApplication.OPUS_APPLICATION_VOIP);
      this.encoder.bitrate=20000;
    }
    const frames=data.samples.length/data.channelCount;
    const mono=Buffer.alloc(frames*2);
    for(let i=0;i<frames;i++) mono.writeInt16LE(data.channelCount===1?data.samples[i]:Math.round((data.samples[2*i]+data.samples[2*i+1])/2),i*2);
    this.pending=Buffer.concat([this.pending,mono]);
    const frameSize=this.rate/50,bytes=frameSize*2;
    while(this.pending.length>=bytes) {
      const encoded=this.encoder.encode(this.pending.subarray(0,bytes),frameSize);
      this.pending=this.pending.subarray(bytes);
      this.send(encoded);this.stats.encoded++;
    }
  }
  receive(payload) {
    if(this.closed || !this.active) return;
    if(!Buffer.isBuffer(payload) || payload.length<1 || payload.length>1275) throw Error('INVALID_OPUS_PACKET');
    const pcm=this.decoder.decode(payload,2880); // up to negotiated maxFT=60 ms
    if(pcm.length<240 || pcm.length>5760 || pcm.length%2) throw Error('INVALID_OPUS_PCM');
    this.capture?.(pcm);this.stats.decoded++;return pcm.length/6;
  }
  receiveNetwork(payload,timestamp,sequence) { if(!this.closed&&this.active)this.playout.push(payload,timestamp,sequence); }
  tick() { if(!this.closed&&this.active)this.playout.tick(); }
  conceal(samples) {
    const pcm=this.decoder.decode(Buffer.alloc(0),samples*3);
    this.capture?.(pcm);
  }
  close() {
    if(this.closed)return;this.closed=true;this.active=false;
    this.pending.fill(0);this.pending=Buffer.alloc(0);this.encoder=null;this.decoder=null;this.capture=null;this.send=null;
    this.playout.close();
  }
}
