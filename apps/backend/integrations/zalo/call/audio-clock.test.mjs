import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startRealtimeAudioClock } from './audio-clock.mjs';
test('audio clock maintains 100 frames per second after startup and stops cleanly', async () => {
  let frames = 0, stop, started = false;
  try {
    await new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(Error('CLOCK_START_TIMEOUT')), 5000);
      stop = startRealtimeAudioClock(() => {
        if (!started) { started = true; clearTimeout(deadline); setTimeout(resolve, 1000); }
        frames++;
      }, code => { clearTimeout(deadline); reject(Error(code)); });
    });
    assert.ok(frames >= 95 && frames <= 105, `Unexpected 10 ms clock frame count: ${frames}`);
    stop(); const stoppedAt = frames;
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(frames, stoppedAt);
  } finally { stop?.(); }
});
