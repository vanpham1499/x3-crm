const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = 'apps/frontend/src/features/zalo-team/request.ts';
function load() {
  const code = ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const m={exports:{}}; new Function('require','module','exports',code)(require,m,m.exports); return m.exports;
}
const tick = () => new Promise(r => setImmediate(r));
const read = (action, signal) => ({method:'POST',body:JSON.stringify({action}),signal});
test('simultaneous readers share one request; one cancellation does not abort another',async()=>{
 const original=global.fetch, calls=[]; const api=load();
 global.fetch=(_,options)=>new Promise(resolve=>calls.push({options,resolve}));
 try {
  const controller=new AbortController();
  const a=api.teamFetch('/api/zalo-team/web',read('conversations',controller.signal));
  const b=api.teamFetch('/api/zalo-team/web',read('conversations'));
  controller.abort(); await assert.rejects(a,{name:'AbortError'});
  assert.equal(calls.length,1); assert.equal(calls[0].options.signal.aborted,false);
  calls[0].resolve(Response.json({ok:true}));
  assert.deepEqual(await (await b).json(),{ok:true});
 } finally { api.cancelTeamReads(); global.fetch=original; }
});
test('background cap reserves foreground capacity; queued cancelled work is never sent',async()=>{
 const original=global.fetch,calls=[];const api=load();
 global.fetch=(_,options)=>new Promise((resolve,reject)=>{ calls.push({options,resolve});options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}); });
 try {
  const stops=Array.from({length:7},()=>new AbortController());
  const jobs=stops.map((c,i)=>api.teamFetch('/api/zalo-team/web',{method:'POST',body:JSON.stringify({action:'directory',accountId:i,directory:{kind:'friends'}}),signal:c.signal}).catch(e=>e.name));
  assert.equal(calls.length,2);
  const foreground=api.teamFetch('/api/zalo-team/web',read('conversations'));
  assert.equal(calls.length,3);
  stops[6].abort();
  calls[2].resolve(Response.json({ok:true})); await foreground;
  for(const c of stops) c.abort(); await Promise.all(jobs); await tick();
  assert.equal(calls.length,3);
 } finally { api.cancelTeamReads();global.fetch=original; }
});
test('different accounts never coalesce; duplicate commands never coalesce or auto retry',async()=>{
 const original=global.fetch;const api=load();let calls=0;
 global.fetch=async()=>{calls++;return Response.json({ok:true});};
 try {
  await Promise.all([1,2].map(accountId=>api.teamFetch('/api/zalo-team/web',{method:'POST',body:JSON.stringify({action:'conversations',accountId})})));
  assert.equal(calls,2);
  global.fetch=async()=>{calls++;throw Error('offline');};
  await Promise.allSettled([1,2].map(()=>api.teamFetch('/api/zalo-team/web',read('send-text'))));
  assert.equal(calls,4);
 } finally {api.cancelTeamReads();global.fetch=original;}
});
test('deadline aborts a stalled body; session cleanup cancels shared reads',async()=>{
 const original=global.fetch;const api=load();api.teamApiPolicy.readTimeout=25;
 global.fetch=async(_,options)=>new Response(new ReadableStream({start(c){options.signal.addEventListener('abort',()=>c.error(options.signal.reason));}}));
 try {
  await assert.rejects(api.teamFetch('/api/zalo-team/web',read('conversations')),{name:'TimeoutError'});
  const a=api.teamFetch('/api/zalo-team/web',read('status'));
  api.cancelTeamReads();await assert.rejects(a,{name:'AbortError'});
 } finally {api.cancelTeamReads();global.fetch=original;}
});
test('stream is not buffered or placed in the JSON pool',async()=>{
 const original=global.fetch;const api=load();const response=new Response('{}\n',{headers:{'Content-Type':'application/x-ndjson'}});
 global.fetch=async()=>response;
 try {assert.equal(await api.teamFetch('/api/zalo-team/web',{...read('events'),headers:{Accept:'application/x-ndjson'}}),response);}
 finally {global.fetch=original;}
});
test('background polling pauses hidden/offline and does not overlap or run after disposal',async()=>{
 const oldDoc=global.document, oldWindow=global.window;
 const doc=new EventTarget(),win=new EventTarget();doc.hidden=true;global.document=doc;global.window=win;
 let release,calls=0;const api=load();
 const stop=api.backgroundRead(()=>{calls++;return new Promise(r=>release=r);},10);
 try {
  await tick();assert.equal(calls,0);
  doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));await tick();assert.equal(calls,1);
  doc.dispatchEvent(new Event('visibilitychange'));await new Promise(r=>setTimeout(r,20));assert.equal(calls,1);
  stop();release();await new Promise(r=>setTimeout(r,20));assert.equal(calls,1);
 } finally {stop();global.document=oldDoc;global.window=oldWindow;}
});
