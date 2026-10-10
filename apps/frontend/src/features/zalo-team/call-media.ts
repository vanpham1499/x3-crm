// Browser media transport only. The caller must separately verify the account,
// peer, media gateway and signaling before starting a real Zalo call.
export class CallMedia {
  private pc: RTCPeerConnection;
  private stream: MediaStream | null = null;
  private sender: RTCRtpSender | null = null;
  private output: HTMLAudioElement;
  private closed = false;
  private started = false;
  private muted = false;
  private switchingInput = false;
  private abort = new AbortController();

  constructor(private onState: (state: RTCPeerConnectionState | 'playback-blocked' | 'microphone-ended') => void) {
    this.pc = new RTCPeerConnection({ iceServers: [] });
    this.output = new Audio();
    this.output.autoplay = true;
    this.pc.onconnectionstatechange = () => {
      if (!this.closed) this.onState(this.pc.connectionState);
    };
    this.pc.ontrack = event => {
      if (this.closed || event.track.kind !== 'audio') return;
      this.output.srcObject = new MediaStream([event.track]);
      void this.resumePlayback().catch(() => {
        if (!this.closed) this.onState('playback-blocked');
      });
    };
  }

  private ensureOpen() { if (this.closed) throw Error('CALL_MEDIA_CLOSED'); }

  private async capture(deviceId?: string) {
    if (!navigator.mediaDevices?.getUserMedia) throw Error('MICROPHONE_UNAVAILABLE');
    const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: {
      echoCancellation: true, noiseSuppression: true, autoGainControl: true,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    } });
    // A permission prompt can complete after the user has already hung up.
    if (this.closed) { stream.getTracks().forEach(track => track.stop()); throw Error('CALL_MEDIA_CLOSED'); }
    for (const track of stream.getAudioTracks()) {
      track.enabled = !this.muted;
      track.onended = () => { if (!this.closed && this.stream === stream) this.onState('microphone-ended'); };
    }
    return stream;
  }

  async offer(deviceId?: string): Promise<RTCSessionDescriptionInit> {
    this.ensureOpen();
    if (this.started) throw Error('CALL_MEDIA_ALREADY_STARTED');
    this.started = true;
    try {
      this.stream = await this.capture(deviceId);
      this.sender = this.pc.addTrack(this.stream.getAudioTracks()[0], this.stream);
      await this.pc.setLocalDescription(await this.pc.createOffer());
      this.ensureOpen();
      if (this.pc.iceGatheringState !== 'complete') await new Promise<void>((resolve, reject) => {
        const finish = (error?: Error) => {
          clearTimeout(timer);
          this.pc.removeEventListener('icegatheringstatechange', check);
          this.abort.signal.removeEventListener('abort', cancel);
          error ? reject(error) : resolve();
        };
        const check = () => { if (this.pc.iceGatheringState === 'complete') finish(); };
        const cancel = () => finish(Error('CALL_MEDIA_CLOSED'));
        const timer = setTimeout(() => finish(Error('CALL_MEDIA_ICE_TIMEOUT')), 8000);
        this.pc.addEventListener('icegatheringstatechange', check);
        this.abort.signal.addEventListener('abort', cancel, { once: true });
        check();
      });
      this.ensureOpen();
      return this.pc.localDescription!.toJSON();
    } catch (error) { this.close(); throw error; }
  }

  async accept(answer: RTCSessionDescriptionInit) {
    this.ensureOpen();
    if (!this.started || answer.type !== 'answer') throw Error('INVALID_CALL_ANSWER');
    await this.pc.setRemoteDescription(answer);
    this.ensureOpen();
  }

  setMuted(muted: boolean) {
    this.ensureOpen(); this.muted = muted;
    this.stream?.getAudioTracks().forEach(track => { track.enabled = !muted; });
  }

  async setMicrophone(deviceId: string) {
    this.ensureOpen();
    if (!this.sender) throw Error('CALL_MEDIA_NOT_STARTED');
    if (this.switchingInput) throw Error('MICROPHONE_SWITCH_BUSY');
    this.switchingInput = true;
    let next: MediaStream | null = null;
    try {
      next = await this.capture(deviceId);
      await this.sender.replaceTrack(next.getAudioTracks()[0]);
      this.ensureOpen();
      const previous = this.stream;
      this.stream = next;
      previous?.getTracks().forEach(track => track.stop());
    } catch (error) { next?.getTracks().forEach(track => track.stop()); throw error; }
    finally { this.switchingInput = false; }
  }

  async setSpeaker(deviceId: string) {
    this.ensureOpen();
    const output = this.output as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    if (!output.setSinkId) throw Error('SPEAKER_SELECTION_UNAVAILABLE');
    await output.setSinkId(deviceId);
  }

  async resumePlayback() { this.ensureOpen(); await this.output.play(); }

  close() {
    if (this.closed) return;
    this.closed = true; this.abort.abort();
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    this.pc.ontrack = null; this.pc.onconnectionstatechange = null; this.pc.close();
    this.output.pause(); this.output.srcObject = null; this.output.remove();
  }
}
