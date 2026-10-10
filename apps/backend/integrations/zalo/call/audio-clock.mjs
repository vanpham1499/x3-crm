import { Worker } from 'node:worker_threads';

// An audio clock thread avoids Windows' coarse event-loop timer resolution.
// Atomics.wait sleeps only this worker; the signaling/UI server never blocks.
export function startRealtimeAudioClock(callback, onFailure = () => {}) {
  const state = new Int32Array(new SharedArrayBuffer(4));
  const worker = new Worker(new URL('./audio-clock-worker.mjs', import.meta.url), { workerData: state.buffer });
  let stopped = false;
  worker.on('message', timestamp => {
    if (!stopped && performance.now() - timestamp < 30) callback();
  });
  worker.on('error', () => { if (!stopped) onFailure('AUDIO_CLOCK_FAILED'); });
  worker.unref();
  return () => {
    stopped = true; Atomics.store(state, 0, 1); Atomics.notify(state, 0);
    worker.removeAllListeners('message');
  };
}

