import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const root = new URL('../../apps/frontend/src/features/zalo-team/', import.meta.url);
function load(name, imports = {}, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(new URL(name, root), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module = {exports:{}};
  vm.runInNewContext(source, {module, exports:module.exports, require:n=>imports[n], console, setTimeout, clearTimeout, AbortController, AbortSignal, DOMException, ...globals});
  return module.exports;
}
const {mergeTimelinePage:merge,mergeTimelineMessages:mergeMessages,compareMessages:compare} = load('timeline-merge.ts');
const message = (n, archived = false) => ({id:String(n).padStart(4,'0'),clientId:'client-'+n,time:100000+n,archived,text:'same text',attachments:[]});
function page(rows,before,accountId=1,size=50) {
  const all=rows.filter(m=>!before||m.time<Number(before.time)||(m.time===Number(before.time)&&m.id<before.id)).sort(compare);
  const messages=all.slice(-size),first=messages[0],hasMore=all.length>size;
  return {accountId,conversationId:'g1',messages,hasMore,cursor:hasMore?{id:first.id,time:String(first.time)}:null,warning:null};
}
test('scroll across both boundaries without skipped or repeated messages',()=>{
  const saved=Array.from({length:220},(_,i)=>message(i+1,true)),live=Array.from({length:150},(_,i)=>message(i+101));
  let cursor,seen=[];
  for(let i=0;i<10;i++){const p=merge(page(live,cursor),page(saved,cursor),cursor);seen.push(...p.messages.map(m=>m.id));cursor=p.cursor;if(!cursor)break;}
  assert.equal(seen.length,250);assert.equal(new Set(seen).size,250);assert.equal(seen.sort()[0],'0001');
});
test('equal timestamps and dotted IDs preserve a stable cursor',()=>{
  const saved=Array.from({length:110},(_,i)=>({...message(i),time:123,id:`event.${String(i).padStart(3,'0')}`,archived:true}));
  let cursor,seen=[];
  do {const p=merge(page([],cursor),page(saved,cursor),cursor);seen.push(...p.messages.map(m=>m.id));cursor=p.cursor;}while(cursor);
  assert.equal(seen.length,110);assert.equal(new Set(seen).size,110);
});
test('native 15-row pages and incomplete 50-row archive pages never skip a gap',()=>{
  const live=Array.from({length:250},(_,i)=>message(i+1));
  const saved=live.filter((_,i)=>i%3===0).map(m=>({...m,archived:true}));
  let cursor,seen=[];
  for(let i=0;i<30;i++){const p=merge(page(live,cursor,1,15),page(saved,cursor),cursor);seen.push(...p.messages.map(m=>m.id));cursor=p.cursor;if(!cursor)break;}
  assert.equal(seen.length,250);assert.equal(new Set(seen).size,250);
});
test('live recall wins over archived content and old media',()=>{
  const stored={...message(1,true),attachments:[{kind:'image',name:'photo',size:2,url:'/api/zalo-team/archive/assets/abc',archiveState:'ready'}]};
  const live={...message(1),kind:'recalled',attachments:[]};
  const p=merge(page([live]),page([stored]));assert.equal(p.messages.length,1);assert.equal(p.messages[0].kind,'recalled');assert.equal(p.messages[0].attachments.length,0);
});
test('matching attachment keeps saved bytes and live reaction state',()=>{
  const file={kind:'image',name:'photo',size:2};
  const stored={...message(1,true),attachments:[{...file,url:'/api/zalo-team/archive/assets/abc',archiveState:'ready'}]};
  const live={...message(1),reactions:['heart'],attachments:[{...file,url:'https://expired.invalid/photo'}]};
  const [m]=mergeMessages([stored],[live]);assert.equal(m.attachments[0].url,stored.attachments[0].url);assert.equal(m.reactions[0],'heart');assert.equal(m.archived,false);
  assert.equal(mergeMessages([m],[stored])[0].archived,false);
});
test('same text and reused client ID at another time do not collapse',()=>{
  const a=message(1,true),b={...message(2),clientId:a.clientId};assert.equal(mergeMessages([a],[b]).length,2);
});
test('different account responses cannot be merged',()=>assert.throws(()=>merge(page([message(1)]),page([message(2)],null,2)),/IDENTITY/));

function reader(saved, native, fetchOverride) {
  return load('timeline.ts',{
    './archive':{archiveRequest:async()=>{if(saved instanceof Error)throw saved;return saved;}},
    './live':{packets:async(response,receive)=>{if(native instanceof Error)throw native;receive(native);}},
    './timeline-merge':{mergeTimelinePage:merge,compareMessages:compare},
  },{fetch:fetchOverride|| (async()=>({})),setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,25))}).readTimelinePage;
}
test('native offline continues reading saved history',async()=>{
  const p=await reader(page([message(1,true)]),new Error('WEB_ACCOUNT_OFFLINE'))(1,'g1',null,false,new AbortController().signal);
  assert.equal(p.messages[0].archived,true);assert.equal(p.warning,'ARCHIVE_FALLBACK');assert.ok(p.cursor);
});
test('non-advancing native cursor cannot block readable archived history',async()=>{
  const before={id:'0002',time:'100002'};
  const stalled={...page([message(2)]),hasMore:true,cursor:before};
  const p=await reader(page([message(1,true)]),stalled)(1,'g1',before,false,new AbortController().signal);
  assert.equal(p.messages[0].id,'0001');assert.equal(p.warning,'ARCHIVE_FALLBACK');
});
test('archive failure still shows live messages and preserves retry boundary',async()=>{
  const p=await reader(new Error('storage offline'),page([message(1)]))(1,'g1',null,false,new AbortController().signal);
  assert.equal(p.warning,'ARCHIVE_UNAVAILABLE');assert.equal(p.messages[0].archived,false);assert.ok(p.cursor);
});
test('empty surviving source does not falsely claim history finished',async()=>{
  await assert.rejects(()=>reader(page([]),new Error('offline'))(1,'g1',null,false,new AbortController().signal),/offline/);
});
test('slow native source is bounded when saved data is ready',async()=>{
  const fetchWait=(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))));
  const p=await reader(page([message(1,true)]),null,fetchWait)(1,'g1',null,false,new AbortController().signal);assert.equal(p.warning,'ARCHIVE_FALLBACK');
});
test('account switch abort discards the entire previous request',async()=>{
  const abort=new AbortController();abort.abort();
  await assert.rejects(()=>reader(page([message(1,true)]),page([message(1)]))(1,'g1',null,false,abort.signal),{name:'AbortError'});
});
test('past a proven native history boundary, scrolling uses only the archive',async()=>{
  let calls=0;
  const p=await reader(page([message(1,true)]),null,async()=>{calls++;throw Error('should not fetch');})(1,'g1',{id:'0002',time:'100002'},false,new AbortController().signal,{id:'0002',time:'100002'});
  assert.equal(calls,0);assert.equal(p.messages[0].id,'0001');assert.equal(p.warning,null);
});
test('a latest refresh always checks native again after reaching the old boundary',async()=>{
  let calls=0;
  await reader(page([message(1,true)]),page([message(2)]),async()=>{calls++;return {};})(1,'g1',null,true,new AbortController().signal,{id:'0002',time:'100002'});
  assert.equal(calls,1);
});
