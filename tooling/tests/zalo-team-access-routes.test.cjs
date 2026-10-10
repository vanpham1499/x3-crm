const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), ts=require('typescript');
const root=path.resolve('apps/frontend/src');
function harness(scope,reply) {
  let upstream=0;
  const cache=new Map();
  function load(filename) {
    if(cache.has(filename))return cache.get(filename);
    const module={exports:{}};cache.set(filename,module.exports);
    const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    vm.runInNewContext(code,{module,exports:module.exports,Error,Response,Request,Headers,URL,AbortSignal,ReadableStream,TransformStream,TextDecoder,TextEncoder,Buffer,process,console,crypto:require('node:crypto').webcrypto,
      fetch:async(...args)=>{upstream++;if(!reply)throw Error('Unexpected upstream');return reply(...args);},
      require:(name)=>{
        if(name==='next/server')return {NextResponse:{json:(v,o)=>Response.json(v,o)}};
        if(name==='node:fs/promises')return {readFile:async()=> 'a'.repeat(64)};
        if(name==='../access')return {authenticatedAccess:async()=>typeof scope==='function'?scope():scope,accessCommand:async()=>Response.json({ok:true}),connectorAccess:async()=>({token:'a'.repeat(64),url:'http://connector.invalid'})};
        if(name==='./gateway')return {ensureLocalGateway:async()=>{throw Error('Unexpected gateway launch');}};
        if(name.startsWith('@/')||name.startsWith('.'))return load((name.startsWith('@/')?path.join(root,name.slice(2)):path.resolve(path.dirname(filename),name))+'.ts');
        return require(name);
      }},{filename});
    return module.exports;
  }
  return {route:name=>load(path.join(root,'app/api/zalo-team',name,'route.ts')).POST,count:()=>upstream};
}
const scope={admin:false,owner:'a'.repeat(64),userId:2,teams:[],canLink:false,loginIds:[],accounts:{7:{read:true,write:false}}};
const request=(body,headers={})=>new Request('http://localhost/api/zalo-team/web',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('sender identity comes from CRM authentication; browser cannot forge it',async()=>{
 const operator={...scope,userName:'Nguyễn Duy Anh',accounts:{7:{read:true,write:true}}};
 const body={action:'send-text',accountId:7,conversationId:'42',text:'fixture',requestId:'11111111-1111-4111-8111-111111111111'};
 let sent;
 const h=harness(operator,(_url,options)=>{sent=JSON.parse(options.body);return Response.json({status:'sent'});});
 assert.equal((await h.route('web')(request({...body,crmSender:{userId:1,name:'Admin'}}))).status,400);
 assert.equal(h.count(),0);
 assert.equal((await h.route('web')(request(body))).status,200);
 assert.deepEqual(sent.crmSender,{userId:2,name:'Nguyễn Duy Anh'});
});
test('web route rejects read-only send before any connector request',async()=>{
 const h=harness(scope),res=await h.route('web')(request({action:'send-text',accountId:7,conversationId:'42',text:'fixture',requestId:'11111111-1111-4111-8111-111111111111'}));
 assert.equal(res.status,403);assert.equal(h.count(),0);
});
test('call route rejects read-only offer before opening audio or native Zalo',async()=>{
 const h=harness(scope),res=await h.route('call')(request({action:'offer',accountId:7,conversationId:'42',offer:{type:'offer',sdp:'fixture'}}));
 assert.equal(res.status,403);assert.equal(h.count(),0);
});
test('call gateway receives CRM authenticated sender, ignoring browser supplied identity',async()=>{
 let sent;
 const h=harness({...scope,userName:'Admin X3',accounts:{7:{read:true,write:true}}},(_url,options)=>{sent=JSON.parse(options.body);return Response.json({sessionId:'fixture'});});
 const res=await h.route('call')(request({action:'offer',accountId:7,conversationId:'42',offer:{type:'offer',sdp:'fixture'},crmSender:{userId:999,name:'Forged'}}));
 assert.equal(res.status,200);assert.deepEqual(sent.crmSender,{userId:2,name:'Admin X3'});
});
test('upload route rejects read-only user before consuming file upstream',async()=>{
 const h=harness(scope),res=await h.route('upload')(new Request('http://localhost/api/zalo-team/upload',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/octet-stream','X-Zalo-Upload':encodeURIComponent(JSON.stringify({accountId:7,conversationId:'42',name:'fixture.txt',mime:'text/plain',size:1,kind:'file'}))},body:'a'}));
 assert.equal(res.status,403);assert.equal(h.count(),0);
});
test('NDJSON cannot bypass account filtering or expose another login QR',async()=>{
 const h=harness(scope,()=>new Response(JSON.stringify({accounts:[{id:7},{id:8}],conversations:[{accountId:7},{accountId:8}],login:{id:'other',qr:'secret'}})+'\n',{headers:{'Content-Type':'application/x-ndjson'}}));
 const res=await h.route('web')(request({action:'conversations'},{Accept:'application/x-ndjson'}));
 const packet=JSON.parse(await res.text());
 assert.equal(res.status,200);assert.equal(packet.accounts.length,1);assert.equal(packet.conversations.length,1);assert.equal(packet.login,null);
});


test('stream rechecks grants on the next chunk after permission revocation',async()=>{
 let allowed=true, upstream;
 const h=harness(()=>({...scope,accounts:allowed?scope.accounts:{}}),()=>new Response(new ReadableStream({start(c){upstream=c}}),{headers:{'Content-Type':'application/x-ndjson'}}));
 const response=await h.route('web')(request({action:'events'},{Accept:'application/x-ndjson'}));
 const reader=response.body.getReader(), encode=v=>new TextEncoder().encode(JSON.stringify(v)+'\n');
 upstream.enqueue(encode({accountId:7,inbox:{account:{id:7},upserts:[{accountId:7,id:'7:2'}],removed:[]}}));
 const first=await reader.read();assert.equal(JSON.parse(new TextDecoder().decode(first.value)).inbox.upserts.length,1);
 allowed=false;upstream.enqueue(encode({accountId:7,inbox:{account:{id:7},upserts:[{accountId:7,id:'7:3'}],removed:[]}}));upstream.close();
 assert.equal((await reader.read()).done,true);
});
