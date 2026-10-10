const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const source=fs.readFileSync('apps/frontend/src/features/zalo-team/account-access.ts','utf8');
const context={exports:{}};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const {authorizeWeb,filterWeb}=context.exports;
const base={admin:false,owner:'a'.repeat(64),userId:1,teams:[],loginIds:['own'],accounts:{7:{read:true,write:false}}};
test('read grant allows reads but denies sending and other accounts',()=>{
 for(const action of ['messages','message-search','conversation-info'])assert.doesNotThrow(()=>authorizeWeb(base,{action,accountId:7}));
 for(const action of ['send-text','send-media','send-sticker','message-action'])assert.throws(()=>authorizeWeb(base,{action,accountId:7}),/WEB_ACCESS_DENIED/);
 assert.throws(()=>authorizeWeb(base,{action:'messages',accountId:8}),/WEB_ACCESS_DENIED/);
});
test('operator cannot execute destructive or administrative actions',()=>{
 const operator={...base,accounts:{7:{read:true,write:true}}};
 assert.doesNotThrow(()=>authorizeWeb(operator,{action:'send-text',accountId:7}));
 for(const body of [{action:'message-action',operation:'delete'},{action:'message-action',operation:'recall'},{action:'conversation-settings',settings:{kind:'clear-history'}},{action:'conversation-settings',settings:{kind:'ttl'}},{action:'group-action',group:{kind:'remove'}},{action:'group-action',group:{kind:'leave'}},{action:'directory',directory:{kind:'remove'}},{action:'stop'},{action:'group-links'}])assert.throws(()=>authorizeWeb(operator,{...body,accountId:7}),/WEB_ACCESS_DENIED/);
});
test('aggregate and QR packets are scoped even for streaming responses',()=>{
 const output=filterWeb(base,{accounts:[{id:7},{id:8}],conversations:[{accountId:7},{accountId:8}],groups:[{sources:['7:10']},{sources:['7:10','8:10']}],login:{id:'another',qr:'secret'}});
 assert.equal(output.accounts.length,1);assert.equal(output.conversations.length,1);assert.equal(output.groups.length,1);assert.equal(output.login,null);
 assert.equal(filterWeb({...base,admin:true},{login:{id:'another',qr:'secret'}}).login,null);
 assert.equal(filterWeb(base,{login:{id:'own',qr:'mine'}}).login.qr,'mine');
});
