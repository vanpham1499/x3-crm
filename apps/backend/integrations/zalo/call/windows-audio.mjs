// Explicit virtual endpoints only. Never fall back to a physical/default device.
export function selectVirtualDevices(devices, { inputName, outputName }) {
  if (!inputName || !outputName || inputName === outputName ||
      ![inputName, outputName].every(name => /VB-Audio/i.test(name) && /Cable/i.test(name)))
    throw Error('VIRTUAL_AUDIO_CONFIGURATION_REQUIRED');
  const inputs = devices.filter(d => d.name === inputName && d.inputChannels >= 1);
  const outputs = devices.filter(d => d.name === outputName && d.outputChannels >= 1);
  if (inputs.length !== 1 || outputs.length !== 1) throw Error('VIRTUAL_AUDIO_DEVICES_MISSING');
  return { input: inputs[0], output: outputs[0] };
}

export function toMono48k(data) {
  const { samples, sampleRate, channelCount } = data;
  const frames = sampleRate / 100;
  if (data.bitsPerSample !== 16 || ![8000, 16000, 32000, 44100, 48000].includes(sampleRate) ||
      ![1, 2].includes(channelCount) || samples.length !== frames * channelCount)
    throw Error('AUDIO_FORMAT_UNSUPPORTED');
  const output = Buffer.alloc(960);
  const at = frame => {
    const offset = Math.min(frame, frames - 1) * channelCount;
    return channelCount === 1 ? samples[offset] : (samples[offset] + samples[offset + 1]) / 2;
  };
  for (let i = 0; i < 480; i++) {
    const position = i * frames / 480, left = Math.floor(position), fraction = position - left;
    output.writeInt16LE(Math.round(at(left) * (1 - fraction) + at(left + 1) * fraction), i * 2);
  }
  return output;
}

export async function createWindowsAudio(config) {
  if (process.platform !== 'win32') throw Error('WINDOWS_REQUIRED');
  const { default: api } = await import('audify');
  const audio = new api.RtAudio(api.RtAudioApi.WINDOWS_WASAPI);
  const { input, output } = selectVirtualDevices(audio.getDevices(), config);
  let closed = false, queue = Buffer.alloc(0), frameBytes = 960;
  return {
    open(onData, onError) {
      try {
        const frames = audio.openStream(
          { deviceId: output.id, nChannels: 1, firstChannel: 0 },
          { deviceId: input.id, nChannels: 1, firstChannel: 0 },
          api.RtAudioFormat.RTAUDIO_SINT16, 48000, 480, 'Zalo Team WebRTC',
          data => { if (!closed) onData(Buffer.from(data)); },
          () => {
            if (closed) return;
            const chunk = Buffer.alloc(frameBytes);
            const size = Math.min(queue.length, frameBytes);
            queue.copy(chunk, 0, 0, size); queue = queue.subarray(size);
            audio.write(chunk);
          },
          0, () => { if (!closed) onError('WINDOWS_AUDIO_FAILED'); },
        );
        frameBytes = frames * 2;
        audio.write(Buffer.alloc(frameBytes));
        audio.start();
      } catch { this.close(); throw Error('WINDOWS_AUDIO_OPEN_FAILED'); }
    },
    write(data) {
      if (closed) return;
      const pcm = toMono48k(data);
      queue = Buffer.concat([queue, pcm]);
      if (queue.length > 19200) queue = queue.subarray(queue.length - 9600);
    },
    close() {
      if (closed) return; closed = true;
      if (audio.isStreamRunning()) audio.stop();
      if (audio.isStreamOpen()) audio.closeStream();
      queue = Buffer.alloc(0);
    },
  };
}
