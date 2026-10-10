// SSH-controlled synthetic Opus loopback; never creates a Zalo connector/session.
import readline from 'node:readline';
const modules = process.env.CALL_PROBE_MODULE_ROOT || new URL('../../../apps/backend/integrations/zalo/call/', import.meta.url).href;
const { BrowserAudio } = await import(new URL('rtc-audio.mjs', modules));
const { OpusBridge } = await import(new URL('opus-bridge.mjs', modules));
let audio;
const timeout = setTimeout(() => finish(1), 45000);
function finish(code) { clearTimeout(timeout); audio?.close(); setTimeout(() => process.exit(code), 100); }
const lines = readline.createInterface({ input: process.stdin });
lines.on('line', async line => {
  try {
    const message = JSON.parse(line);
    if (message.action === 'end') {
      console.log(JSON.stringify({ type: 'proof', stats: audio?.stats })); finish(0); return;
    }
    if (audio || message.action !== 'offer') throw Error('INVALID_PROBE_ACTION');
    const bridge = new OpusBridge(packet => bridge.receive(packet)); bridge.active = true;
    audio = new BrowserAudio({ bridge, onFailure: code => { console.error(code); finish(1); } });
    console.log(JSON.stringify({ type: 'answer', answer: await audio.answer(message.offer, process.env.CALL_MEDIA_ADDRESS) }));
  } catch (error) { console.error(error.message); finish(1); }
});
lines.on('close', () => finish(0));
