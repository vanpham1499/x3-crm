const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(name, stubs = {}) {
  const out = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../apps/frontend/src/features/zalo-team',name+'.ts'),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('exports','require',code)(out, id => stubs[id] || load(id.replace('./',''),stubs));
  return out;
}
const {mergeSearchPages} = load('message-search');
const {mergeInfoMedia, readConversationInfo} = load('info-api', {'./archive':{archiveRequest:async body => ({accountId:1,conversationId:'23',items:[{id:body.section+':0',messageId:'1',kind:body.section==='images'?'image':body.section==='files'?'file':'link',time:1,name:'fixture',size:1}],cursor:null})}});
const page=(items,cursor=null)=>({accountId:1,conversationId:'23',items,cursor});
const hit=(id,time)=>({id,time,text:'fixture',kind:'text',sender:{id:'1',name:'Fixture'}});
test('search merges Web and imported history at a safe common boundary',()=>{
  const merged=mergeSearchPages(page([hit('3',3),hit('2',2),hit('1',1)],{id:'1',time:'1'}),page([hit('4',4),hit('3',3)],{id:'3',time:'3'}));
  assert.deepEqual(merged.items.map(x=>x.id),['4','3']);
  assert.deepEqual(merged.cursor,{id:'3',time:'3'});
  assert.throws(()=>mergeSearchPages(page([]),{...page([]),accountId:2}),/IDENTITY/);
});
test('media preserves every attachment index and prefers verified stored files',()=>{
  const base={id:'1:0',messageId:'1',kind:'file',name:'fixture.pdf',size:10,time:1};
  const stored=[{...base,url:'/api/zalo-team/archive/assets/abc'},{...base,id:'1:1'}];
  const result=mergeInfoMedia(stored,[{...base,url:'https://example.test/new'},{...base,id:'2:0',messageId:'2',time:2}]);
  assert.equal(result.length,3);
  assert.equal(result.find(x=>x.id==='1:0').url,'/api/zalo-team/archive/assets/abc');
  assert.equal(mergeInfoMedia([{...base,url:'https://example.test/expired'}],[{...base,url:'https://example.test/new'}])[0].url,'https://example.test/new');
});
test('archive-only overview loads all three libraries without requiring native metadata',async()=>{
  const result=await readConversationInfo({accountId:1,conversationId:'23',archiveOnly:true,name:'Fixture'},new AbortController().signal);
  assert.equal(Object.keys(result.sections).length,3);
  assert.equal(result.sections.images.items[0].kind,'image');
  assert.equal(result.sections.files.items[0].kind,'file');
  assert.equal(result.sections.links.items[0].kind,'link');
});
