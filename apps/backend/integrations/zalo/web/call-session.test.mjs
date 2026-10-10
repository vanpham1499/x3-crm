import test from 'node:test';
import assert from 'node:assert/strict';
import { callInPage, validCall, SIGNAL_FIELDS } from './call-session.mjs';
import { validCommand } from './guards.mjs';
const sessionId = '11111111-1111-4111-8111-111111111111';
const packet = { type: 'sendSignal', command: 401, data: { calleeId: '222', callId: '12345', codec: '[]', type: 1 } };
test('call commands require strict owner/account/personal scope and bounded packets', () => {
  const body = { action: 'call-session', owner: 'a'.repeat(64), accountId: 1, conversationId: '222', call: { kind: 'prepare', sessionId } };
  assert.ok(validCommand(body));
  for (const patch of [{accountId:undefined}, {owner:'x'}, {conversationId:'g222'}, {call:{...body.call,code:'arbitrary'}}]) assert.ok(!validCommand({...body,...patch}));
  assert.ok(validCall({ kind: 'signal', sessionId, sequence: 1, packet }));
  assert.ok(!validCall({ kind: 'signal', sessionId, sequence: 1, packet: {...packet, command: 12433} }));
  assert.ok(!validCall({ kind: 'signal', sessionId, sequence: 1, packet: {...packet, data:{...packet.data, extra: true}} }));
});
test('relay preserves callback, isolates peer/call, deduplicates signals and restores callback', async () => {
  const previousGlobal = globalThis.webpackJsonp;
  let signals = 0, previousEvents = 0;
  const previous = () => { previousEvents++; };
  const fetcher = { userId: '111', callbackVideoCallEvent: previous,
    bindCallbackVideoCall(fn) { this.callbackVideoCallEvent = fn; },
    requestCall: async () => { signals++; return { accepted: true }; } };
  const modules = { dThN:{default:fetcher}, UiPd:{default:{ isBlocked:()=>false,isOA:()=>false,isZaloBot:()=>false,getMiniInfo:()=>({}),getDName:id=>id,getAvatar:()=>'' }},
    jDHv:{ModuleContainer:{resolve:()=>({getList:()=>['222']})}},iZzu:{ConvListController:{}},'3xbP':{c:'all'},NDmK:{default:{sendToMeId:'111'}} };
  const require = () => undefined;
  require.c = Object.fromEntries(Object.entries(modules).map(([k,exports])=>[k,{exports}])); require.m = {};
  globalThis.webpackJsonp = [];
  globalThis.webpackJsonp.push = function(chunk) { Array.prototype.push.call(this,chunk);Object.values(chunk[1])[0]({}, {}, require); };
  const run = call => callInPage({expectedId:'111',conversationId:'222',call:{sessionId,...call},fields:SIGNAL_FIELDS});
  try {
    await run({kind:'prepare'});
    await assert.rejects(run({kind:'signal',sequence:1,packet:{...packet,data:{...packet.data,calleeId:'333'}}}),/CALL_PEER_MISMATCH/);
    const signal = {kind:'signal',sequence:1,packet};
    const results = await Promise.all([run(signal),run(signal)]);
    assert.equal(signals,1); assert.deepEqual(results[0],results[1]);
    await assert.rejects(run({...signal,packet:{...packet,data:{...packet.data,codec:'changed'}}}),/CALL_SIGNAL_CONFLICT/);
    fetcher.callbackVideoCallEvent([{act_type:'voip',act:'ringring',data:{callId:'12345'}},{act_type:'voip',data:{callId:'999'}}]);
    assert.equal(previousEvents,1);
    const poll = await run({kind:'poll',cursor:0}); assert.equal(poll.events.length,1);
    assert.equal((await run({kind:'poll',cursor:poll.cursor})).events.length,0);
    await run({kind:'close'}); assert.equal(fetcher.callbackVideoCallEvent,previous);
    await assert.rejects(run({kind:'poll',cursor:0}),/CALL_SESSION_NOT_FOUND/);
  } finally { globalThis.__x3TeamCallSession?.dispose(); globalThis.webpackJsonp=previousGlobal; }
});
