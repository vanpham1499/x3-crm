import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const module = {exports:{}};
const code = ts.transpileModule(fs.readFileSync(new URL('../../apps/frontend/src/features/zalo-team/group-links.ts', import.meta.url),'utf8'), {
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
new Function('require','module','exports',code)(name=>{
 if(name==='./request')return {teamFetch:()=>{throw Error('Unexpected network in grouping test');}};
 throw Error('Unexpected dependency: '+name);
},module,module.exports);
const {groupRows}=module.exports;
const row=(id,extra={})=>({id,accountId:Number(id.split(':')[0]),accountName:id.startsWith('1:')?'Duy':'Ánh',conversationId:id.split(':')[1],group:true,name:'Same name',preview:'Bạn: Xin chào',updatedAt:1,time:'',color:'',...extra});
const links=[{id:'shared',sources:['1:g1','3:g9'],preferredAccountId:null}];
test('only explicit links merge; newest preview uses real account name; unread is not summed',()=>{
 const grouped=groupRows([row('1:g1',{unread:4}),row('3:g9',{unread:5,updatedAt:2}),row('1:g8')],links);
 assert.equal(grouped.length,2);const g=grouped.find(g=>g.link);assert.equal(g.sources.length,2);assert.equal(g.conversation.unread,0);assert.equal(g.conversation.unreadMarked,true);assert.equal(g.conversation.preview,'Ánh: Xin chào');
 assert.equal(groupRows([row('1:g1'),row('3:g9')],[]).length,2);
});
test('account filtering keeps source identity; single remaining source retains association; personal chats stay separate',()=>{
 assert.equal(groupRows([row('1:g1')],links)[0].link.id,'shared');
 assert.equal(groupRows([row('1:g1',{group:false}),row('3:g9',{group:false})],links).length,2);
 const a=row('1:g1',{pinned:true,updatedAt:1}),b=row('3:g9',{updatedAt:2,muted:true});
 const g=groupRows([a,b],links)[0];assert.equal(g.conversation.pinned,true);assert.equal(g.conversation.muted,false);assert.equal(g.sources[0].id,'1:g1');assert.equal(a.preview,'Bạn: Xin chào');
});
