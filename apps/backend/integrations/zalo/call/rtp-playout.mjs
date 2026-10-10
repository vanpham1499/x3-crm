// Bounded 60 ms playout buffer for authenticated 16 kHz RTP timestamps.
// Decode in timestamp order, never arrival order. Decode/PLC returns samples
// in the RTP clock domain so 10/20/40/60 ms Opus packets keep their duration.
const distance = (a, b) => (a - b) | 0;
export class RtpPlayout {
  constructor(decode, conceal, now = () => performance.now()) {
    this.decode = decode; this.conceal = conceal; this.now = now;
    this.packets = new Map(); this.next = null; this.duration = 320;
    this.stats = { played: 0, reordered: 0, late: 0, concealed: 0, resyncs: 0 };
  }
  push(payload, timestamp, sequence) {
    const now = this.now(); timestamp >>>= 0;
    if (this.next === null) {
      this.next = timestamp; this.due = now + 60; this.started = false; this.missing = 0;
    }
    const delta = distance(timestamp, this.next);
    if (delta < 0) {
      if (!this.started && delta >= -1600) this.next = timestamp;
      else { this.stats.late++; return; }
    }
    if (delta > 32000 || this.packets.size >= 50) {
      this.packets.clear(); this.next = timestamp; this.due = now + 60; this.started = false; this.stats.resyncs++;
    }
    if (this.lastSequence !== undefined && ((sequence - this.lastSequence + 32768) & 65535) - 32768 < 0) this.stats.reordered++;
    this.lastSequence = sequence;
    this.packets.set(timestamp, payload);
  }
  tick() {
    const now = this.now();
    if (this.next === null || now < this.due) return;
    // A suspended server resumes live media instead of emitting a long burst.
    if (now - this.due > 120) { this.packets.clear(); this.next = null; this.stats.resyncs++; return; }
    for (let count = 0; count < 6 && this.next !== null && now >= this.due; count++) {
      this.started = true;
      const packet = this.packets.get(this.next);
      let samples;
      if (packet) {
        this.packets.delete(this.next); samples = this.decode(packet);
        this.duration = samples; this.missing = 0; this.stats.played++;
      } else {
        if (++this.missing > 3 && !this.packets.size) { this.next = null; return; }
        const ahead = [...this.packets.keys()].map(ts => distance(ts, this.next)).filter(n => n > 0);
        samples = Math.min(this.duration, ...ahead);
        this.conceal(samples); this.stats.concealed++;
      }
      if (![40,80,160,320,640,960].includes(samples)) throw Error('INVALID_RTP_AUDIO_DURATION');
      this.next = (this.next + samples) >>> 0; this.due += samples / 16;
    }
  }
  close() { this.packets.clear(); this.next = null; }
}
