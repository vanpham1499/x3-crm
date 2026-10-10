import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMessage} from './messages.mjs';
const raw={id:'123',clientId:'456',time:1234567890000,type:'MSG_CONTACT',mine:false,sender:{id:'99',name:'Test'}};
test('native calltime params override legacy duration and infer incoming independently of mine',()=>{
 const m=normalizeMessage({...raw,message:{action:'recommened.calltime',duration:900,params:JSON.stringify({duration:11,isCaller:0,calltype:0,isEnableCallback:1})}});
 assert.equal(m.kind,'call');assert.deepEqual(m.call,{direction:'incoming',missed:false,video:false,durationSeconds:11,callback:true,reason:0});
});
test('outgoing missed call and video metadata remain distinguishable',()=>{
 const m=normalizeMessage({...raw,message:{action:'recommened.misscall',params:{duration:0,isCaller:1,calltype:1,reason:3,isEnableCallback:1}}});
 assert.equal(m.call.direction,'outgoing');assert.equal(m.call.missed,true);assert.equal(m.call.video,true);assert.equal(m.call.reason,3);
});
test('legacy calling seconds and absent or invalid duration do not invent elapsed time',()=>{
 for(const duration of [undefined,-1,'invalid']) {
  const m=normalizeMessage({...raw,message:{action:'recommened.calling',duration,params:'broken'}});
  assert.equal(m.call.direction,'outgoing');assert.equal(m.call.durationSeconds,null);assert.equal(m.call.callback,false);
 }
 const m=normalizeMessage({...raw,message:{action:'recommened.receivecall',duration:71,params:'{"isEnableCallback":1}'}});
 assert.equal(m.call.durationSeconds,71);assert.equal(m.call.callback,true);
});
test('ordinary messages have no call metadata',()=>assert.equal(normalizeMessage({...raw,type:'MSG_TEXT',message:'hello'}).call,undefined));
test('preserves explicit native call identity without inventing one from message IDs',()=>{
 for(const params of [{callId:123,isCaller:1},{call_id:'123',isCaller:1}]) {
  const m=normalizeMessage({...raw,message:{action:'recommened.calltime',params:JSON.stringify(params)}});
  assert.equal(m.call.id,'123');
 }
 assert.equal(normalizeMessage({...raw,message:{action:'recommened.calltime',params:{duration:6}}}).call.id,undefined);
});
