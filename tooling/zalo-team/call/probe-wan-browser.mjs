// Real Chrome -> public VPS UDP -> Opus -> Chrome, with a generated tone only.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { callDependency } from './dependencies.mjs';
const { chromium } = callDependency('playwright');
import ts from 'typescript';
const repo = path.resolve(new URL('../../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const source = await fs.readFile(path.join(repo, 'apps/frontend/src/features/zalo-team/call-media.ts'), 'utf8');
const mediaCode = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText.replace('export class CallMedia', 'class CallMedia') + '\nglobalThis.CallMedia = CallMedia;';
const remote = 'docker run --rm -i --name x3-zalo-team-call-wan-probe --memory 384m --cpus 1 --cap-drop ALL --security-opt no-new-privileges --read-only -e CALL_MEDIA_ADDRESS=14.225.198.183 -e CALL_PROBE_MODULE_ROOT=file:///app/call/ -p 41000-41031:41000-41031/udp -v /opt/x3-zalo-team/incoming/probe-wan-server.mjs:/app/call/probe-wan-server.mjs:ro x3-zalo-team-call:local node probe-wan-server.mjs';
const child = spawn('C:/Windows/System32/OpenSSH/ssh.exe', ['-T', '-i', path.join(repo, 'tooling/deployment/.work/zalo-vps/id_ed25519'), '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'UserKnownHostsFile=' + path.join(repo, 'tooling/deployment/.work/server/known_hosts'), 'root@14.225.198.183', remote], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
child.stderr.on('data', data => process.stderr.write(data));
const messages = [], waiters = [];
const lines = readline.createInterface({ input: child.stdout });
lines.on('line', line => { try { const value = JSON.parse(line); const resolve = waiters.shift(); resolve ? resolve(value) : messages.push(value); } catch { console.log(line); } });
function receive() { return Promise.race([messages.length ? Promise.resolve(messages.shift()) : new Promise(resolve => waiters.push(resolve)), new Promise((_, reject) => { const timer = setTimeout(() => reject(Error('PROBE_TIMEOUT')), 20000); timer.unref(); })]); }
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage(); await page.addScriptTag({ content: mediaCode });
  const offer = await page.evaluate(async () => {
    const context = new AudioContext({ sampleRate: 48000 }); await context.resume();
    const tone = context.createOscillator(); tone.frequency.value = 440;
    const gain = context.createGain(); gain.gain.value = 0.2;
    const destination = context.createMediaStreamDestination(); tone.connect(gain).connect(destination); tone.start();
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => destination.stream }, configurable: true });
    const media = new CallMedia(() => {}); media.output.volume = 0;
    const analyser = context.createAnalyser(); analyser.fftSize = 2048;
    const silent = context.createGain(); silent.gain.value = 0; analyser.connect(silent).connect(context.destination);
    media.pc.addEventListener('track', event => context.createMediaStreamSource(new MediaStream([event.track])).connect(analyser));
    globalThis.probe = { context, tone, media, analyser }; return media.offer();
  });
  child.stdin.write(JSON.stringify({ action: 'offer', offer }) + '\n');
  const answer = await receive(); if (answer.type !== 'answer') throw Error('PROBE_NO_ANSWER');
  if (!answer.answer.sdp.includes('14.225.198.183')) throw Error('PROBE_WRONG_MEDIA_HOST');
  await page.evaluate(answer => probe.media.accept(answer), answer.answer);
  await page.waitForFunction(() => probe.media.pc.connectionState === 'connected', undefined, { timeout: 15000 });
  await page.waitForFunction(() => { const bins = new Float32Array(probe.analyser.frequencyBinCount); probe.analyser.getFloatFrequencyData(bins); return Math.max(...bins) > -45; }, undefined, { timeout: 10000 });
  const proof = await page.evaluate(async () => {
    const bins = new Float32Array(probe.analyser.frequencyBinCount); probe.analyser.getFloatFrequencyData(bins);
    const peak = Math.max(...bins); const all = [...(await probe.media.pc.getStats()).values()];
    const pair = all.find(s => s.type === 'candidate-pair' && s.state === 'succeeded' && s.nominated);
    const remote = all.find(s => s.id === pair?.remoteCandidateId);
    const frequency = bins.indexOf(peak) * probe.context.sampleRate / probe.analyser.fftSize;
    const result = { connection: probe.media.pc.connectionState, frequency, peak, remote: { address: remote?.address, port: remote?.port, protocol: remote?.protocol }, rtp: all.filter(s => ['inbound-rtp', 'outbound-rtp'].includes(s.type)).map(s => ({ type: s.type, packetsSent: s.packetsSent, packetsReceived: s.packetsReceived })) };
    probe.media.close(); probe.tone.stop(); await probe.context.close(); return result;
  });
  child.stdin.write(JSON.stringify({ action: 'end' }) + '\n');
  const server = await receive();
  if (Math.abs(proof.frequency - 440) > 30 || server.stats?.receivedFrames < 10 || server.stats?.transmittedFrames < 10 || proof.remote.address !== '14.225.198.183') throw Error('WAN_AUDIO_NOT_VERIFIED');
  const evidence = { ...proof, server: server.stats, synthetic: true, realZaloCall: false };
  await fs.writeFile(path.join(repo, '.local/zalo-call-assets/wan-proof.json'), JSON.stringify(evidence, null, 2)); console.log(JSON.stringify(evidence));
} finally { child.stdin.end(); await browser.close(); }
