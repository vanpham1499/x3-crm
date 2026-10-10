import {test} from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import {PortableCall} from './portable-call.mjs';
import {SrtpContext} from './srtp.mjs';
test('full Node voice lifecycle and Opus/SRTP UDP roundtrip against scoped fake peer',async()=>{
 const server=dgram.createSocket('udp4');await new Promise(resolve=>server.bind(0,'127.0.0.1',resolve));
 const master=Buffer.alloc(30,65),rx=new SrtpContext(master),tx=new SrtpContext(master),signals=[];
 const address='127.0.0.1:'+server.address().port;
 server.on('message',(packet,peer)=>{
  if(packet[0]===1) {
   const ack=Buffer.alloc(35);packet.copy(ack,0,0,21);ack[0]=2;ack.writeUInt32LE(packet.readUInt32LE(21),25);ack.writeUInt32LE(123,29);server.send(ack,peer.port,peer.address);
  } else if(packet[0]===3) {
   assert.equal(packet.readUInt32LE(1),123);
   const plain=rx.unprotect(packet.subarray(5));assert.equal(plain.readUInt32BE(8),100001);
   plain.writeUInt32BE(100002,8);server.send(Buffer.concat([Buffer.from([4]),tx.protect(plain)]),peer.port,peer.address);
  }
 });
 let endLog;
 const connector={scope:{conversationId:'999'},prepare:async()=>({local:{id:'111'},peer:{id:'999'}}),poll:async()=>{},close:async()=>{},signal:async packet=>{
  signals.push(packet.command);
  if(packet.command===406)endLog=packet.data;
  return {type:'recvSignal',data:packet.command===401?{status:0,fromId:100001,toId:100002,sessId:'A'.repeat(152),servers:[{rtpaddr:address}],zrtc_config:{audioSampleRate:16000,audioChannel:1,srtpMode:1}}:{status:0}};
 }};
 const call=new PortableCall(connector);let captured=0;call.bridge.open(pcm=>captured+=pcm.length,()=>{});
 try {
  await call.prepare();await call.start();assert.equal(call.state,'ringing');
  await call.control({act:'answer',data:{callId:call.request.data.callId,status:0,params:JSON.stringify({codec:JSON.stringify([{name:'opus/16000/1',payload:112}]),extendData:JSON.stringify({srtpMode:1,packetMode:2})})}});
  assert.equal(call.state,'connected');
  for(let n=0;n<4;n++)call.bridge.write({samples:new Int16Array(480),sampleRate:48000,channelCount:1,bitsPerSample:16});
  await new Promise((resolve,reject)=>{const start=Date.now();const timer=setInterval(()=>{call.bridge.tick();if(captured>=3840){clearInterval(timer);resolve();}else if(Date.now()-start>1500){clearInterval(timer);reject(Error('NO_MEDIA'));}},10);});
  assert.equal(call.stats.authenticated,2);assert.equal(call.stats.received,2);
  call.connectedAt=Date.now()-11200;
  await Promise.all([call.close(),call.close()]);assert.deepEqual(signals,[401,416,408,409,406]);assert.equal(call.endAccepted,true);
  assert.equal(call.historyAccepted,true);assert.equal(endLog.duration,11);assert.equal(endLog.status,50);
  assert.equal(endLog.role,true);assert.equal(endLog.partnerId,'999');
  assert.equal(JSON.parse(endLog.data).CallType,0);
  assert.equal(JSON.parse(endLog.data).RxTotalPkt,2);
  assert.ok(!endLog.data.includes('Session'));
 }finally {await call.close();rx.close();tx.close();server.close();}
});

test('terminal history is scoped, sent once, and cleanup survives log failure',async()=>{
 for(const state of ['cancel','reject','failed-log','not-invited']) {
  const packets=[];let disposed=false;
  const connector={scope:{conversationId:'999'},signal:async p=>{packets.push(p);return {type:p.command===406&&state==='failed-log'?'signalError':'recvSignal',data:{status:0}};},close:async()=>{disposed=true;}};
  const call=new PortableCall(connector);
  call.attempted=true;call.request={data:{callId:123}};call.invitationAccepted=state!=='not-invited';
  if(state==='reject')call.rejectedStatus=3;
  await Promise.all([call.close(),call.close()]);await call.close();
  assert.ok(disposed);assert.equal(call.state,'ended');
  const logs=packets.filter(p=>p.command===406);
  assert.equal(logs.length,state==='not-invited'?0:1);
  if(logs.length){assert.equal(logs[0].data.duration,0);assert.equal(logs[0].data.partnerId,'999');assert.equal(logs[0].data.status,state==='reject'?106:103);}
  if(state==='failed-log')assert.equal(call.historyAccepted,false);
 }
});
