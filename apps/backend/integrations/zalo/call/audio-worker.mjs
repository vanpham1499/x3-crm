import http from 'node:http';
import fs from 'node:fs';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { BrowserAudio } from './rtc-audio.mjs';

const token = fs.readFileSync(process.env.CALL_TOKEN_FILE || '/run/secrets/call_token', 'utf8').trim();
if (!/^[a-f0-9]{64}$/.test(token)) throw Error('INVALID_CALL_TOKEN');
const address = process.env.CALL_MEDIA_ADDRESS || '127.0.0.1';
const portable = process.env.CALL_ENGINE === 'zrtc';
// Validate codec dependencies before advertising a usable call capability.
const PortableEngine = portable ? (await import('./portable-call.mjs')).PortableCall : null;
let active;
let draining = null;
const close = () => {
  const previous = active; active = null;
  if (previous && process.env.CALL_PROBE_REPORT_FILE) {
    const report = { provider: portable ? 'zrtc' : 'native', browserState: previous.audio?.pc.connectionState,
      callState: previous.native?.state, connected: !!previous.native?.connectedAt,
      durationMs: previous.native?.connectedAt ? Date.now() - previous.native.connectedAt : 0,
      browserAudio: previous.audio?.stats, zaloMedia: previous.native?.stats, playout:previous.native?.bridge?.playout?.stats, error: previous.error };
    try { fs.writeFileSync(process.env.CALL_PROBE_REPORT_FILE, JSON.stringify(report, null, 2)); } catch {}
  }
  previous?.audio?.close();
  if (previous) console.info(JSON.stringify({event:'call-ended',error:previous.error,connected:!!previous.native?.connectedAt,audio:previous.audio?.stats,media:previous.native?.stats,playout:previous.native?.bridge?.playout?.stats}));
  if (previous?.native) {
    const pending = previous.native.close().then(() => {
      const historyRecorded = previous.native.historyAccepted;
      console.info(JSON.stringify({event:'call-history',recorded:historyRecorded ?? null}));
      return {historyRecorded};
    }).catch(() => ({}));
    draining = pending;
    void pending.finally(() => { if (draining === pending) draining = null; });
    return pending;
  }
};
const timer = setInterval(() => { if (active && Date.now() > active.expires) close(); }, 1000);
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  const reply = (value, code = 200) => { res.writeHead(code); res.end(JSON.stringify(value)); };
  if (req.url === '/health' && req.method === 'GET') return reply({ ok: true, provider: portable ? 'zrtc' : 'webrtc-audio', callReady: portable, busy: !!active || !!draining });
  const auth = Buffer.from(req.headers.authorization || ''), expected = Buffer.from('Bearer ' + token);
  if (req.headers.origin || auth.length !== expected.length || !timingSafeEqual(auth, expected)) return reply({ error: 'FORBIDDEN' }, 403);
  if (req.method !== 'POST') return reply({ error: 'INVALID_METHOD' }, 405);
  try {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 70000) throw Error('BODY_TOO_LARGE'); }
    const body = JSON.parse(raw);
    if (!/^[a-f0-9]{64}$/.test(body.actor || '')) throw Error('INVALID_CALL_ACTOR');
    if (!/^[a-f0-9]{64}$/.test(body.owner || '') || !Number.isSafeInteger(body.accountId) || body.accountId < 1 || !/^\d{1,30}$/.test(body.conversationId || '')) throw Error('INVALID_CALL_SCOPE');
    if (req.url === '/offer') {
      if (active || draining) throw Error('CALL_WORKER_BUSY');
      const current = active = { actor: body.actor, owner: body.owner, accountId: body.accountId, conversationId: body.conversationId, id: randomUUID(), expires: Date.now() + 45000, error: null };
      try {
        let bridge;
        if (portable) {
          const {CallConnector}=await import('./connector-client.mjs');
          const connector=new CallConnector({owner:body.owner,accountId:body.accountId,conversationId:body.conversationId,crmSender:body.crmSender,
            token:fs.readFileSync(process.env.CALL_CONNECTOR_TOKEN_FILE || 'tooling/zalo-team/.local/web-token','utf8').trim()});
          current.native=new PortableEngine(connector,error=>{current.error=error.message;current.audio?.close();});
          await current.native.prepare();bridge=current.native.bridge;
        } else bridge = process.platform === 'win32'
          ? await (await import('./windows-audio.mjs')).createWindowsAudio({
            inputName: process.env.CALL_VIRTUAL_INPUT,
            outputName: process.env.CALL_VIRTUAL_OUTPUT,
          }) : null;
        if (active !== current) { bridge?.close(); throw Error('CALL_SESSION_EXPIRED'); }
        current.audio = new BrowserAudio({ bridge, onFailure: error => {
          current.error = error;
          void current.native?.close().catch(() => {});
        } });
        if (!portable && process.platform === 'win32' && process.env.CALL_NATIVE_ENGINE) {
          const { prepareWindowsCall } = await import('./windows-call.mjs');
          const native = await prepareWindowsCall({ owner: body.owner, accountId: body.accountId, conversationId: body.conversationId },
            error => { current.error = error.message; if (active === current) { current.audio.close(); void current.native?.close().catch(() => {}); } });
          if (active !== current || current.error) { await native.close(); throw Error(current.error || 'CALL_SESSION_EXPIRED'); }
          current.native = native;
        }
        const answer = await current.audio.answer(body.offer, address);
        if (active !== current) throw Error('CALL_SESSION_EXPIRED');
        return reply({ sessionId: current.id, answer, nativeLinked: !!current.native, callConnected: false });
      } catch (error) { if (active === current) close(); throw error; }
    }
    if (!active || active.actor !== body.actor || active.owner !== body.owner || active.accountId !== body.accountId || active.conversationId !== body.conversationId || active.id !== body.sessionId) throw Error('CALL_SESSION_NOT_FOUND');
    if (req.url === '/end') { const result=await close(); return reply({ ended: true, ...result }); }
    if (req.url === '/start') {
      active.expires = Date.now() + 45000;
      if (!active.native) throw Error('CALL_NATIVE_UNAVAILABLE');
      if (active.error) throw Error(active.error);
      if (active.audio.pc.connectionState !== 'connected') throw Error('CALL_AUDIO_NOT_CONNECTED');
      if (!active.started) { active.started = true; await active.native.start(); }
      return reply({ startRequested: true, callConnected: active?.native?.state === 'connected' });
    }
    if (req.url === '/status') {
      active.expires = Date.now() + 20000;
      return reply({ state: active.audio?.pc.connectionState || 'new', stats: active.audio?.stats, mediaStats:active.native?.stats, error: active.error, nativeLinked: !!active.native, startRequested: !!active.started, callState:active.native?.state, callConnected: active.native?.state==='connected', connectedAt:active.native?.connectedAt });
    }
    throw Error('INVALID_CALL_ACTION');
  } catch (error) { const code=/^[A-Z_]+$/.test(error.message)?error.message:'CALL_AUDIO_FAILED';console.info(JSON.stringify({event:'call-error',action:req.url,code}));reply({ error: code }, 409); }
});
server.requestTimeout = 15000;
server.listen(9260, process.env.CALL_BIND_ADDRESS || '127.0.0.1', () => console.log(portable ? 'Zalo Team WebRTC / ZRTC call worker ready' : 'Zalo Team audio worker ready; native calling unavailable'));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { clearInterval(timer); close(); server.close(); });
