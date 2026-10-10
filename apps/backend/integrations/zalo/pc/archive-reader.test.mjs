import test from 'node:test';
import assert from 'node:assert/strict';
import { projectPcPage, pcMediaPaths, pcDecodeFile } from './archive-reader.mjs';

test('native file decode verifies account before and after local operation',async()=>{
 const old=globalThis.webpackJsonp, cloud=globalThis.$zcloud;
 const req={c:{dThN:{exports:{default:{userId:'123'}}},fdn9:{exports:{a:{userId:'123'}}}},m:{}};
 globalThis.webpackJsonp=[];globalThis.webpackJsonp.push=chunk=>{Object.values(chunk[1])[0]({}, {},req);return Array.prototype.push.call(globalThis.webpackJsonp,chunk);};
 let calls=0;globalThis.$zcloud={denoiseFile:async options=>{calls++;assert.deepEqual(options,{src:'source',dest:'staging',checksum:'abc'});}};
 const options={accountId:'123',src:'source',dest:'staging',checksum:'abc'};
 try{
  await assert.rejects(pcDecodeFile({...options,accountId:'999'}),/ACCOUNT_CHANGED/);assert.equal(calls,0);
  assert.equal(await pcDecodeFile(options),true);assert.equal(calls,1);
  globalThis.$zcloud.denoiseFile=async()=>{req.c.fdn9.exports.a.userId='999';};
  await assert.rejects(pcDecodeFile(options),/ACCOUNT_CHANGED/);
  assert.equal(globalThis.webpackJsonp.length,0);
 }finally{globalThis.webpackJsonp=old;globalThis.$zcloud=cloud;}
});

test('PC media cache keeps video, voice and thumbnail roles separate and scoped to selected messages',async()=>{
 const old=globalThis.webpackJsonp;
 const modules={dThN:{default:{userId:'123'}},fdn9:{a:{userId:'123'}},mE25:{a:999,b:999},wH4e:{c:{PREV:'prev'}},
  '1pet':{MSG_VIDEO:10,MSG_VOICE:11,MSG_PHOTO:2,MSG_FILE:3},
  fsN4:{default:{instance:{Core:{Message:{getAll:async()=>[
   {msgId:'v',toUid:'chat',msgType:10},{msgId:'a',toUid:'chat',msgType:11},{msgId:'other',toUid:'elsewhere',msgType:10},
   {msgId:'f',toUid:'chat',msgType:3,message:{params:'{"checksum":"abc"}'}},
   {msgId:'bad',toUid:'chat',msgType:3,message:{params:'invalid'}}
  ]}}}}},
  MHb6:{a:{getPathsByMessageIfExistSync:()=>[{type:'video',path:'video.mp4'},{type:'videoThumb',path:'preview.jpg'}]}},
  dXpj:{a:{getPathsByMessageIfExistSync:()=>[{type:'voice',path:'voice.aac'}]}},
  gKzZ:{a:{getPathsByMessageIfExistSync:()=>[{type:'fileNoise',path:'local-cache'}]}}};
 const req={c:Object.fromEntries(Object.entries(modules).map(([id,exports])=>[id,{exports}])),m:{}};
 globalThis.webpackJsonp=[];globalThis.webpackJsonp.push=chunk=>{Object.values(chunk[1])[0]({}, {},req);return Array.prototype.push.call(globalThis.webpackJsonp,chunk);};
 try{
  assert.deepEqual(await pcMediaPaths({accountId:'123',conversationId:'chat',messageIds:['v','a','other']}),[
   {messageId:'v',slot:'attachments.0.url',path:'video.mp4'},
   {messageId:'v',slot:'attachments.0.preview',path:'preview.jpg'},
   {messageId:'a',slot:'attachments.0.url',path:'voice.aac'}]);
  await assert.rejects(pcMediaPaths({accountId:'999',conversationId:'chat',messageIds:['v']}),/ACCOUNT_CHANGED/);
  assert.deepEqual(await pcMediaPaths({accountId:'123',conversationId:'chat',messageIds:['f','bad']}),[
   {messageId:'f',slot:'attachments.0.url',path:'local-cache',encoding:'pc-file-noise',checksum:'abc'}]);
  req.c.t77n={exports:{a:{getFileKey:id=>id,get:()=>null}}};
  req.c.C64z={exports:{fileExistsSyncV2:()=>true}};
  let checks=await pcMediaPaths({accountId:'123',conversationId:'chat',messageIds:['bad'],reportMissing:true});
  assert.equal(checks.find(c=>c.slot==='attachments.0.url').sourceState,'found','undecodable cache must not be called absent');
  modules.gKzZ.a.getPathsByMessageIfExistSync=()=>[];
  checks=await pcMediaPaths({accountId:'123',conversationId:'chat',messageIds:['f'],reportMissing:true});
  assert.equal(checks.find(c=>c.slot==='attachments.0.url').sourceState,'missing');
  req.c.t77n.exports.a.get=()=>({extraInfo:{localPath:'outside-managed-root.pdf'}});
  checks=await pcMediaPaths({accountId:'123',conversationId:'chat',messageIds:['f'],reportMissing:true});
  assert.equal(checks.find(c=>c.sourceState && c.slot==='attachments.0.url').sourceState,'found','existing download is retained even if copying might reject its path');
  delete req.c.t77n;
  checks=await pcMediaPaths({accountId:'123',conversationId:'chat',messageIds:['f'],reportMissing:true});
  assert.equal(checks.find(c=>c.slot==='attachments.0.url').sourceState,'unverified','unloaded locator cannot certify absence');
 }finally{globalThis.webpackJsonp=old;}
});

const descriptor = { accountId: '123', constants: [['MSG_TEXT', 1], ['MSG_PHOTO', 2]] };
const snapshot = { sourceAccountId: '123', ownProfile: { userId: '123', displayName: 'Owner' }, profiles: [{ userId: '456', displayName: 'Friend' }], messages: [] };
test('native PC IDs/time and self sender survive projection', () => {
  const page = projectPcPage({ ...snapshot, messages: [{ msgId: '9007199254740993123', cliMsgId: '7788', sendDttm: '1789000000000', fromUid: '0', msgType: 1, message: 'old text' }] }, descriptor);
  assert.equal(page[0].id, '9007199254740993123');
  assert.equal(page[0].clientId, '7788');
  assert.equal(page[0].time, 1789000000000);
  assert.equal(page[0].sender.id, '123');
  assert.equal(page[0].mine, true);
  assert.equal(page[0].archiveOrigin, 'pc');
  assert.equal(page[0].canRecall, false);
});
test('local-only media retains its attachment slot', () => {
  const [m] = projectPcPage({ ...snapshot, messages: [{ msgId: '9', cliMsgId: '10', sendDttm: '1789000000000', fromUid: '456', msgType: 2, message: { title: 'photo.jpg' } }] }, descriptor);
  assert.equal(m.kind, 'media'); assert.equal(m.attachments[0].kind, 'image'); assert.equal(m.sender.name, 'Friend');
});
test('account switch and invalid timestamp fail closed', () => {
  assert.throws(() => projectPcPage({ ...snapshot, sourceAccountId: '999' }, descriptor), /ACCOUNT_CHANGED/);
  assert.throws(() => projectPcPage({ ...snapshot, messages: [{ msgId: '1', sendDttm: 'bad' }] }, descriptor), /IDENTITY_INVALID/);
});
test('PC layout and subtype constants never replace text/photo kinds', () => {
  const collision = { ...descriptor, constants: [...descriptor.constants, ['MSG_SUBTYPE_PHOTO',1],['MSG_BUBBLE_LAYOUT_TYPE_SMALL',2],['MSG_TOPIC',2]] };
  const rows = [{ msgId:'1',cliMsgId:'2',sendDttm:'1789000000000',fromUid:'456',msgType:1,message:'actual text'},
    {msgId:'3',cliMsgId:'4',sendDttm:'1789000000001',fromUid:'456',msgType:2,message:{title:'photo'}}];
  const [text, photo] = projectPcPage({...snapshot,messages:rows},collision);
  assert.equal(text.type,'MSG_TEXT'); assert.equal(text.kind,'text'); assert.equal(text.text,'actual text'); assert.equal(text.attachments.length,0);
  assert.equal(photo.type,'MSG_PHOTO'); assert.equal(photo.attachments[0].kind,'image');
});
