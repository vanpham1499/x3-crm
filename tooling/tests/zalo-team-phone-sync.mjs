import assert from 'node:assert/strict';
import vm from 'node:vm';
import {historySync,validHistorySync} from '../../apps/backend/integrations/zalo/web/history-sync.mjs';
import {validCommand} from '../../apps/backend/integrations/zalo/web/guards.mjs';
const id='11111111-1111-4111-8111-111111111111', id2='22222222-2222-4222-8222-222222222222';
let starts=0,cancels=0,current=null,ready=true,running=false;
const handlers=new Map();
const controller={
  canSync:()=>ready&&!running?0:6,isWorkerReady:()=>ready,
  machine:{isRunning:()=>running,getCurrentSyncMachineInfo:()=>({userSyncSessionId:current,tempKey:'NEVER_EXPORT'}),interpreter:{state:{value:'waitingForConfirm',context:{privateKey:'NEVER_EXPORT'}}}},
  syncEventsHandler:{receivedBatchCount:0},
  addEventListener:(event,fn)=>{if(!handlers.has(event))handlers.set(event,new Set());handlers.get(event).add(fn);},
  removeEventListener:(event,fn)=>handlers.get(event)?.delete(fn),
  sync:async()=>{starts++;current='native-'+starts;running=true;},
  cancelSyncIfRunning:async()=>{cancels++;running=false;},
};
const api={SyncController:'controller',SyncConfigService:'config',SyncSource:{MANUAL:11},CanSyncResult:{OK:0,WORKER_NOT_READY:6},
  SyncMessageEvent:{ON_SUCCESS:'success',ON_FAILED:'failure'},SyncSuccessType:{NO_NEED_SYNC:'no_need_sync'},SyncCancelReason:{USER_CANCELLED:'USER_CANCELLED'}};
const modules={dThN:{default:{userId:'123'}},fdn9:{a:{userId:'123'}},Qx9e:api,jDHv:{ModuleContainer:{resolve:key=>key==='controller'?controller:{getThresholdRanges:()=>Object.fromEntries(['conversationsList','previewAndRecentMessages','otherMessages'].map(k=>[k,{fromTs:100,toTs:Number.MAX_SAFE_INTEGER}]))}}}};
const require={c:Object.fromEntries(Object.entries(modules).map(([k,exports])=>[k,{exports}])),m:{}};
const chunk=[];chunk.push=function(value){Array.prototype.push.call(this,value);Object.values(value[1])[0]({}, {},require);};
const context=vm.createContext({webpackJsonp:chunk,Date,Map,Set});
const frame={url:()=> 'https://chat.zalo.me/',evaluate:async(fn,args)=>{context.args=args;return vm.runInContext('('+fn.toString()+')(args)',context);}};
const page={frames:()=>[frame]};
const run=(operation='status',jobId)=>historySync(page,'123',{sync:{operation,...(jobId?{id:jobId}:{})}});
assert(validHistorySync({operation:'start',id}));
assert(!validHistorySync({operation:'start'}));
assert(!validHistorySync({operation:'status',range:0}));
const cmd={action:'history-sync',owner:'a'.repeat(64),accountId:1,sync:{operation:'status'}};
assert(validCommand(cmd));assert(!validCommand({...cmd,accountId:undefined}));assert(!validCommand({...cmd,conversationId:'123'}));
assert(!validCommand({...cmd,action:'status'}));
assert((await run()).available);assert.equal(starts,0);
let r=await run('start',id);assert.equal(r.job.state,'running');assert.equal(starts,1);
await run('start',id);assert.equal(starts,1,'replayed start must reuse receipt');
assert(!JSON.stringify(await run('status',id)).includes('NEVER_EXPORT'));
assert.equal((await run('status',id2)).job,null,'unknown receipt is not success');
await run('cancel',id2);assert.equal(cancels,0,'cannot cancel a foreign or unknown transfer');
controller.syncEventsHandler.receivedBatchCount=3;running=false;
for(const fn of handlers.get('success'))fn({getSuccessType:()=> 'success'});
r=await run('status',id);assert.equal(r.job.state,'received');assert.equal(r.job.batches,3);assert.equal(handlers.get('success').size,0);
await run('start',id2);running=false;for(const fn of handlers.get('success'))fn({getSuccessType:()=> 'no_need_sync'});
assert.equal((await run('status',id2)).job.state,'no_changes');
const id3='33333333-3333-4333-8333-333333333333';await run('start',id3);
current='another-native-job';assert.equal((await run('cancel',id3)).job.state,'interrupted');assert.equal(cancels,0);
running=false;const id4='44444444-4444-4444-8444-444444444444';await run('start',id4);await run('cancel',id4);assert.equal(cancels,1);
await assert.rejects(()=>historySync(page,'999'),/WEB_IDENTITY_MISMATCH/);
ready=false;await assert.rejects(()=>run('start','55555555-5555-4555-8555-555555555555'),/WEB_SYNC_NOT_READY/);
console.log('PASS phone adapter: replay, identity, privacy, native ownership, cancellation, explicit no-change and source limits');
