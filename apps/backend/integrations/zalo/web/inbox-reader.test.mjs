import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InboxReader } from './inbox-reader.mjs';
const slot = { id: 1 };
const reader = () => new InboxReader({timeout: 15, log: () => {}});

test('concurrent callers share a native read; timeout does not start overlapping work', async () => {
  const r = reader(), session = {handle: {}}, rows = [{id:'one'}];
  let finish, calls = 0;
  const task = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const [a,b] = await Promise.all([r.read(slot,session,task),r.read(slot,session,task)]);
  assert.equal(calls,1); assert.equal(a.error,'WEB_READ_TIMEOUT'); assert.deepEqual(a,b);
  await r.read(slot,session,task); assert.equal(calls,1);
  finish(rows); await new Promise(resolve => setImmediate(resolve));
  assert.equal((await r.read(slot,session,async()=>rows)).error,null);
});

test('a slow account does not block a healthy one, stale rows are explicit and identity errors clear them', async () => {
  const r = reader(), session = {handle:{}}, rows = [{id:'one'}];
  const stalled = r.read(slot,session,()=>new Promise(()=>{}));
  const ready = await r.read({id:2},{handle:{}},async()=>rows);
  assert.deepEqual(ready.rows,rows); assert.equal(ready.error,null);
  await stalled;
  const r2 = reader(); await r2.read(slot,session,async()=>rows);
  const failed = await r2.read(slot,session,async()=>{throw Error('vendor secret WEB_CONVERSATIONS_NOT_READY:preview_loading');});
  assert.equal(failed.readiness.stage,'preview_loading'); assert.equal(failed.readiness.stale,true);
  assert.ok(failed.readiness.lastSuccessAt); assert.ok(failed.readiness.nextRetryAt);
  const identity = await r2.read(slot,session,async()=>{throw Error('WEB_IDENTITY_MISMATCH');});
  assert.deepEqual(identity.rows,[]); assert.equal(identity.readiness.nextRetryAt,null);
});

test('late results from a stopped or replaced profile cannot repopulate the list', async () => {
  const r = reader(), session = {handle:{}};
  let finish;
  const pending = r.read(slot,session,()=>new Promise(resolve=>{finish=resolve;}));
  await new Promise(resolve=>setImmediate(resolve));
  session.handle = null; finish([{id:'private'}]);
  const result = await pending;
  assert.equal(result.error,'WEB_IDENTITY_MISMATCH'); assert.deepEqual(result.rows,[]);
});


test('same-profile reload retains last good rows and timestamp while waiting, not another profile', async () => {
  const r = reader(), session = {handle:{inboxGeneration:0}};
  const good = await r.read(slot,session,async()=>[{id:'one'}]);
  session.handle.inboxGeneration++;
  const fail = async()=>{throw Error('WEB_CONVERSATIONS_NOT_READY:frame_loading');};
  const stale = await r.read(slot,session,fail);
  assert.deepEqual(stale.rows,good.rows); assert.equal(stale.readiness.lastSuccessAt,good.readiness.lastSuccessAt);
  session.handle = {};
  assert.deepEqual((await r.read(slot,session,fail)).rows,[]);
});
