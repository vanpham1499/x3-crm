const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
function load(path){const e={};new Function('require','exports',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(require,e);return e;}
const {mergeChanges,affects,applyInboxDelta}=load('apps/frontend/src/features/zalo-team/changes.ts');
const {filterWeb}=load('apps/frontend/src/features/zalo-team/account-access.ts');
const row=(a,id,preview='hello')=>({id:`${a}:${id}`,accountId:a,conversationId:id,preview,updatedAt:1});
const delta=(id,upserts=[],removed=[])=>({account:{id},upserts,removed});
test('batched deltas retain latest row, deletion and separate account scope',()=>{
 let event=mergeChanges(undefined,{accountId:1,revision:1,inbox:delta(1,[row(1,'2')]),changes:[{accountId:1,areas:['messages'],conversationIds:['2']}]});
 event=mergeChanges(event,{accountId:2,revision:2,inbox:delta(2,[row(2,'2')]),changes:[{accountId:2,areas:['info'],conversationIds:['2']}]});
 event=mergeChanges(event,{accountId:1,revision:3,inbox:delta(1,[],['1:2']),changes:[]});
 assert.equal(event.accountId,undefined);assert.equal(affects(event,'messages',2,'2'),false);assert.equal(affects(event,'messages',1,'2'),true);
 assert.equal(affects(event,'messages',1,'3'),false);assert.equal(affects(event,'inbox'),false);
 const data=applyInboxDelta({accounts:[{id:1}],conversations:[row(1,'2'),row(1,'4')],fetchedAt:''},event.inboxes);
 assert.deepEqual(data.conversations.map(r=>r.id).sort(),['1:4','2:2']);
 assert.equal(affects({resync:true},'inbox'),true);assert.equal(affects({error:'lost'},'inbox'),false);
});
test('legacy events and unknown scope invalidate conservatively, newer upsert reverses deletion',()=>{
 const e=mergeChanges({inboxes:[delta(1,[],['1:2'])],changes:[]},{inbox:delta(1,[row(1,'2')]),changes:[]});
 assert.deepEqual(e.inboxes[0].removed,[]);
 assert.equal(mergeChanges(e,{revision:3}).changes,undefined);
 const all=mergeChanges({changes:[{accountId:1,areas:['messages']}]},{changes:[{accountId:1,areas:['messages'],conversationIds:['2']}]});
 assert.equal(all.changes[0].conversationIds,undefined);
});
test('ACL filters nested delta rows and changes, not just outer accountId',()=>{
 const access={admin:false,accounts:{1:{read:true}},loginIds:[]};
 const result=filterWeb(access,{inbox:delta(1,[row(1,'2'),row(2,'3')],['1:9','2:9']),inboxes:[delta(2,[row(2,'3')])],changes:[{accountId:1},{accountId:2}]});
 assert.deepEqual(result.inbox.upserts,[row(1,'2')]);assert.deepEqual(result.inbox.removed,['1:9']);assert.deepEqual(result.inboxes,[]);assert.deepEqual(result.changes,[{accountId:1}]);
});
test('CRM auth coalesces only concurrent identical credentials, never caches completed grants',async()=>{
 const old=global.fetch;let count=0,releases=[];
 global.fetch=()=>{count++;return new Promise(resolve=>releases.push(()=>{
   const user={id:1,is_active:true,zalo_access:{owner:'a'.repeat(64),userId:1}};
   resolve(new Response(JSON.stringify({user})));
 }))};
 const {authenticatedAccess}=load('apps/frontend/src/app/api/zalo-team/access.ts');
 const req=c=>new Request('http://localhost:3000/api/zalo-team/web',{headers:{origin:'http://localhost:3000',cookie:c}});
 try{
  const jobs=Array.from({length:10},()=>authenticatedAccess(req('session=a')));assert.equal(count,1);
  const other=authenticatedAccess(req('session=b'));assert.equal(count,2);releases.splice(0).forEach(r=>r());
  const results=await Promise.all(jobs);await other;results[0].userId=99;assert.equal(results[1].userId,1);
  const fresh=authenticatedAccess(req('session=a'));assert.equal(count,3);releases.shift()();await fresh;
  await assert.rejects(authenticatedAccess(new Request('http://localhost:3000/api/zalo-team/web',{headers:{origin:'http://evil.example'}})),/INVALID_ORIGIN/);
 }finally{global.fetch=old;}
});
