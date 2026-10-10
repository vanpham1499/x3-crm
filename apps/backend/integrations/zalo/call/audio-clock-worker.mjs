import { parentPort, workerData } from 'node:worker_threads';
const state = new Int32Array(workerData);
let deadline = performance.now() + 10;
while (!Atomics.load(state, 0)) {
  Atomics.wait(state, 0, 0, Math.max(0, deadline - performance.now()));
  if (Atomics.load(state, 0)) break;
  const now = performance.now();
  if (now - deadline > 30) deadline = now;
  parentPort.postMessage(now);
  deadline += 10;
}
