// RTCAudioSink's contract is 10 ms Int16 PCM. Some native startup callbacks
// contain invalid metadata; reject the frame without terminating the session.
export function validPcmFrame(data) {
  return data?.samples instanceof Int16Array &&
    (data.bitsPerSample === undefined || data.bitsPerSample === 16) &&
    [8000,12000,16000,24000,32000,44100,48000].includes(data.sampleRate) &&
    [1,2].includes(data.channelCount) &&
    data.samples.length === data.sampleRate / 100 * data.channelCount;
}
