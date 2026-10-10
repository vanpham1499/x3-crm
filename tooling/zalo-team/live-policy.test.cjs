function loadChanges(){const e={};new Function('exports',ts.transpileModule(fs.readFileSync('apps/frontend/src/features/zalo-team/changes.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(e);return e;}
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
function load() {
 const out={};
 const code=ts.transpileModule(fs.readFileSync('apps/frontend/src/features/zalo-team/live.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',code)(name=>name==='./changes'?loadChanges():({teamFetch:(...a)=>fetch(...a),teamApiPolicy:{eventBatch:5}}),out);return out;
}
const tick=()=>new Promise(r=>setTimeout(r,15));
test('unchanged reconnect does not reload lists; changed revision does and bursts are combined',async()=>{
 const original=global.fetch, streams=[],events=[];const live=load();
 global.fetch=async()=>new Response(new ReadableStream({start(c){streams.push(c);}}),{headers:{'Content-Type':'application/x-ndjson'}});
 const off=live.subscribeChanges(e=>events.push(e));
 const emit=(value)=>streams.at(-1).enqueue(new TextEncoder().encode(JSON.stringify(value)+'\n'));
 try {
  emit({resync:true,revision:10});await tick();assert.equal(events.length,0);
  live.reconnectChanges();await tick();emit({resync:true,revision:10});await tick();assert.equal(events.length,0);
  emit({revision:11,accountId:1});emit({revision:12,accountId:2});await tick();
  assert.equal(events.length,1);assert.equal(events[0].accountId,undefined);assert.equal(events[0].revision,12);
  live.reconnectChanges();await tick();emit({resync:true,revision:15});await tick();assert.equal(events.length,2);
 }finally{off();for(const stream of streams)try{stream.close();}catch{}global.fetch=original;}
});
test('hidden tab buffers changes and refreshes once when visible',async()=>{
 const original=global.fetch,oldDoc=global.document; const doc=new EventTarget();doc.hidden=false;global.document=doc;
 let stream;const events=[],live=load();
 global.fetch=async()=>new Response(new ReadableStream({start(c){stream=c;}}),{headers:{'Content-Type':'application/x-ndjson'}});
 const off=live.subscribeChanges(e=>events.push(e));
 const emit=value=>stream.enqueue(new TextEncoder().encode(JSON.stringify(value)+'\n'));
 try{
  emit({resync:true,revision:0});await tick();doc.hidden=true;
  emit({revision:1,accountId:1});emit({revision:2,accountId:1});await tick();assert.equal(events.length,0);
  doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));await tick();assert.equal(events.length,1);assert.equal(events[0].revision,2);
 }finally{off();try{stream.close();}catch{}global.fetch=original;global.document=oldDoc;}
});
